"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiDownload, FiPlus } from "react-icons/fi";

import CustomDatePicker from "@/app/components/atoms/inputs/DatePicker";
import { exportToExcel } from "@/lib/export-to-excel";
import { trpc } from "@/trpc/client";
import type { HrAttendanceCalendarSignal, HrAttendanceStatus } from "@/types/hr-attendance";
import LoadingSpinner from "@/app/components/LoadingSpinner";

type ManualWorkType = "REMOTE" | "ONSITE";

type ManualFormState = {
  employeeId: string;
  checkIn: string;
  checkOut: string;
  workType: ManualWorkType;
};

type DaySignal = HrAttendanceCalendarSignal;

type LogFilters = {
  query: string;
  status: "all" | HrAttendanceStatus;
};

const badgeVariant: Record<HrAttendanceStatus, string> = {
  "On time":
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  Late: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  "On leave": "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200",
  Absent: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
};

const statusColorScale: Record<HrAttendanceStatus, string> = {
  "On time": "#22c55e",
  Late: "#f97316",
  "On leave": "#38bdf8",
  Absent: "#94a3b8",
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const manualWorkTypeLabels: Record<ManualWorkType, string> = {
  ONSITE: "On-site",
  REMOTE: "Remote",
};

const formatDateKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const parseTimeLabelToMinutes = (value: string) => {
  const match = value.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) {
    hours += 12;
  }
  if (period === "AM" && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
};

const calculateWorkingHours = (checkIn: string, checkOut: string) => {
  const start = parseTimeLabelToMinutes(checkIn);
  const end = parseTimeLabelToMinutes(checkOut);

  if (start === null || end === null || end <= start) return "—";

  const diff = end - start;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

const buildMonthInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const parseMonthInputValue = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, 1);
};

const todayRef = new Date();
const startOfToday = new Date(todayRef);
startOfToday.setHours(0, 0, 0, 0);
const startOfCurrentMonth = new Date(todayRef.getFullYear(), todayRef.getMonth(), 1);
const maxMonthValue = buildMonthInputValue(todayRef);

const calendarSignalColor: Record<Exclude<DaySignal, "none">, string> = {
  ontime: "bg-emerald-400",
  late: "bg-amber-400",
  leave: "bg-sky-400",
  absent: "bg-rose-400",
};

const BREAK_PLACEHOLDER = "—";

const formatOrdinalDay = (day: number) => {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
};

const formatAttendanceTitleDate = (date: Date) => {
  const monthLabel = date.toLocaleString("en-US", { month: "long" });
  return `${formatOrdinalDay(date.getDate())} ${monthLabel}, ${date.getFullYear()}`;
};

const formatMonthTitle = (date: Date) =>
  date.toLocaleString("en-US", { month: "long", year: "numeric" });

const buildCalendarCells = (
  referenceDate: Date,
  daySignals: Record<string, DaySignal>,
) => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ date: Date | null; key: string | null; signal: DaySignal }> = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ date: null, key: null, signal: "none" });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateInstance = new Date(year, month, day);
    const key = formatDateKey(dateInstance);
    cells.push({ date: dateInstance, key, signal: getDaySignal(key, daySignals) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: null, signal: "none" });
  }

  return cells;
};

const getDaySignal = (dateKey: string | null, daySignals: Record<string, DaySignal>): DaySignal =>
  dateKey ? daySignals[dateKey] ?? "none" : "none";

const isFutureDate = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized.getTime() > startOfToday.getTime();
};

export default function HrAdminAttendancePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(todayRef);
  const [manualDate, setManualDate] = useState<Date>(todayRef);
  const [manualForm, setManualForm] = useState<ManualFormState>({
    employeeId: "",
    checkIn: "",
    checkOut: "",
    workType: "ONSITE",
  });
  const [formFeedback, setFormFeedback] = useState<string | null>(null);
  const [logFilters, setLogFilters] = useState<LogFilters>({ query: "", status: "all" });
  const [historyEmployeeId, setHistoryEmployeeId] = useState<string>("");
  const [historyMonth, setHistoryMonth] = useState<Date>(startOfCurrentMonth);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!formFeedback) return undefined;
    const timeoutId = window.setTimeout(() => setFormFeedback(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [formFeedback]);

  const selectedDayKey = formatDateKey(selectedDate);
  const overviewQuery = trpc.hrAttendance.overview.useQuery({ date: selectedDayKey });
  const employees = useMemo(
    () => overviewQuery.data?.employees ?? [],
    [overviewQuery.data?.employees],
  );
  const employeeLookup = useMemo(() => {
    const map = new Map<string, (typeof employees)[number]>();
    employees.forEach((employee) => map.set(employee.id, employee));
    return map;
  }, [employees]);
  const dayLogs = useMemo(
    () => overviewQuery.data?.dayLogs ?? [],
    [overviewQuery.data?.dayLogs],
  );
  const statusStats = useMemo(
    () =>
      overviewQuery.data?.statusCounts ?? {
        "On time": 0,
        Late: 0,
        "On leave": 0,
        Absent: 0,
      },
    [overviewQuery.data?.statusCounts],
  );
  const weeklyTrend = overviewQuery.data?.weeklyTrend ?? [];
  const calendarEntries = useMemo(
    () => overviewQuery.data?.calendar ?? [],
    [overviewQuery.data?.calendar],
  );
  const calendarSignalMap = useMemo(() => {
    const map: Record<string, DaySignal> = {};
    calendarEntries.forEach((entry) => {
      map[entry.date] = entry.signal;
    });
    return map;
  }, [calendarEntries]);

  const resolvedManualEmployeeId = useMemo(() => {
    if (manualForm.employeeId && employees.some((employee) => employee.id === manualForm.employeeId)) {
      return manualForm.employeeId;
    }
    return employees[0]?.id ?? "";
  }, [employees, manualForm.employeeId]);

  const resolvedHistoryEmployeeId = useMemo(() => {
    if (historyEmployeeId && employees.some((employee) => employee.id === historyEmployeeId)) {
      return historyEmployeeId;
    }
    return employees[0]?.id ?? "";
  }, [employees, historyEmployeeId]);

  const filteredDayLogs = useMemo(() => {
    return dayLogs.filter((log) => {
      const matchesQuery =
        log.name.toLowerCase().includes(logFilters.query.toLowerCase()) ||
        (log.squad ?? "").toLowerCase().includes(logFilters.query.toLowerCase());
      const matchesStatus =
        logFilters.status === "all" ? true : log.status === logFilters.status;
      return matchesQuery && matchesStatus;
    });
  }, [dayLogs, logFilters]);

  const totalLogs = dayLogs.length;
  const onTimeRate = totalLogs
    ? Math.round((statusStats["On time"] / totalLogs) * 100)
    : 0;
  const manualUpdatesForDay = dayLogs.filter((log) => log.source === "Manual").length;

  const summaryCards = useMemo(
    () => [
      {
        label: "On-time arrivals",
        value: `${onTimeRate}%`,
        detail: `${statusStats["On time"]} of ${totalLogs || 0} employees`,
      },
      {
        label: "Late check-ins",
        value: statusStats.Late.toString(),
        detail: statusStats.Late ? "Flagged for coaching" : "None today",
      },
      {
        label: "On leave",
        value: statusStats["On leave"].toString(),
        detail: "Approved PTO",
      },
      {
        label: "Manual updates",
        value: manualUpdatesForDay.toString(),
        detail: "Adjustments for this day",
      },
    ],
    [manualUpdatesForDay, onTimeRate, statusStats, totalLogs]
  );

  const historyQuery = trpc.hrAttendance.history.useQuery(
    {
      employeeId: resolvedHistoryEmployeeId,
      month: historyMonth.getMonth(),
      year: historyMonth.getFullYear(),
    },
    {
      enabled: Boolean(resolvedHistoryEmployeeId),
    },
  );

  const monthlyHistoryRows = useMemo(() => {
    if (!historyQuery.data) {
      return [] as Array<{
        date: Date;
        checkIn: string;
        checkOut: string;
        status: HrAttendanceStatus;
        source: "Manual" | "System";
        workingHours: string;
      }>;
    }

    return historyQuery.data.rows
      .map((row) => {
        const date = new Date(row.date);
        return {
          date,
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          status: row.status,
          source: row.source,
          workingHours: calculateWorkingHours(row.checkIn, row.checkOut),
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [historyQuery.data]);

  const manualEntryMutation = trpc.hrAttendance.recordManualEntry.useMutation({
    onSuccess: (data) => {
      setFormFeedback(`Manual attendance saved for ${data.name}.`);
      utils.hrAttendance.overview.invalidate({ date: selectedDayKey });
      if (resolvedHistoryEmployeeId === data.employeeId) {
        utils.hrAttendance.history.invalidate({
          employeeId: data.employeeId,
          month: historyMonth.getMonth(),
          year: historyMonth.getFullYear(),
        });
      }
      setManualForm((prev) => ({ ...prev, checkIn: "", checkOut: "" }));
    },
    onError: (error) => {
      setFormFeedback(error.message || "Unable to save manual attendance.");
    },
  });

  const statusBreakdown = useMemo(
    () =>
      (Object.keys(statusStats) as HrAttendanceStatus[]).map((key) => ({
        label: key,
        value: statusStats[key],
        color: statusColorScale[key],
      })),
    [statusStats]
  );

  const statusChartBackground = useMemo(() => {
    const total = statusBreakdown.reduce((acc, entry) => acc + entry.value, 0);
    if (!total) {
      return "conic-gradient(#e2e8f0 0deg 360deg)";
    }

    let currentAngle = 0;
    const segments: string[] = [];

    statusBreakdown.forEach((segment) => {
      if (!segment.value) return;
      const angle = (segment.value / total) * 360;
      segments.push(
        `${segment.color} ${currentAngle}deg ${currentAngle + angle}deg`
      );
      currentAngle += angle;
    });

    return `conic-gradient(${segments.join(", ")})`;
  }, [statusBreakdown]);

  const calendarCells = useMemo(
    () => buildCalendarCells(selectedDate, calendarSignalMap),
    [calendarSignalMap, selectedDate],
  );

  const selectedDateLabel = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const trendMax =
    weeklyTrend.reduce(
      (max, entry) => Math.max(max, entry.presentPercentage),
      0,
    ) || 1;
  const trendSteps = Math.max(weeklyTrend.length - 1, 1);
  const trendPoints = weeklyTrend.map((entry, index) => {
    const x = (index / trendSteps) * 100;
    const y = 100 - (entry.presentPercentage / trendMax) * 100;
    return `${x},${y}`;
  });
  const areaPathD = `M0,100 ${trendPoints.join(" ")} L100,100 Z`;
  const polylinePoints = trendPoints.join(" ");

  const historyMonthLabel = historyMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const updateSelectedDate = (date: Date) => {
    setSelectedDate(date);
    setManualDate(date);
  };

  const handleSelectedDateChange = (date: Date | null) => {
    if (date && !isFutureDate(date)) {
      updateSelectedDate(date);
    }
  };

  const handleManualDateChange = (date: Date | null) => {
    if (date && !isFutureDate(date)) {
      setManualDate(date);
    }
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedManualEmployeeId || !manualDate || manualEntryMutation.isPending) {
      return;
    }
    if (!manualForm.checkIn) {
      setFormFeedback("Check-in time is required to log attendance.");
      return;
    }

    await manualEntryMutation.mutateAsync({
      employeeId: resolvedManualEmployeeId,
      date: formatDateKey(manualDate),
      checkIn: manualForm.checkIn,
      checkOut: manualForm.checkOut || undefined,
      workType: manualForm.workType,
    });
  };

  const handleExport = () => {
    if (!filteredDayLogs.length) return;

    const title = `Attendance Record of ${formatAttendanceTitleDate(selectedDate)}`;
    exportToExcel(
      filteredDayLogs.map((log, index) => {
        const employeeMeta = employeeLookup.get(log.employeeId);
        return {
          sl: index + 1,
          employeeId: log.employeeId,
          employeeName: log.name,
          department: log.department ?? employeeMeta?.department ?? "—",
          team: log.squad ?? employeeMeta?.squad ?? "—",
          checkIn: log.checkIn,
          checkOut: log.checkOut,
          breakStart: BREAK_PLACEHOLDER,
          breakEnd: BREAK_PLACEHOLDER,
          totalHours: calculateWorkingHours(log.checkIn, log.checkOut),
          status: log.status,
          source: log.source,
        };
      }),
      {
        fileName: `attendance-${selectedDayKey}`,
        sheetName: "Attendance Log",
        title,
        autoFilter: true,
        columns: [
          { key: "sl", label: "SL", width: 6 },
          { key: "employeeId", label: "Employee ID", width: 18 },
          { key: "employeeName", label: "Employee Name", width: 28 },
          { key: "department", label: "Department", width: 20 },
          { key: "team", label: "Team", width: 18 },
          { key: "checkIn", label: "Check-in", width: 16 },
          { key: "checkOut", label: "Check-out", width: 16 },
          { key: "breakStart", label: "Break Start Time", width: 18 },
          { key: "breakEnd", label: "Break End Time", width: 18 },
          { key: "totalHours", label: "Total Working Hour", width: 20 },
          { key: "status", label: "Status", width: 14 },
          { key: "source", label: "Source", width: 14 },
        ],
      },
    );
  };

  const handleMonthlyExport = () => {
    if (!monthlyHistoryRows.length) return;

    const employee = resolvedHistoryEmployeeId
      ? employeeLookup.get(resolvedHistoryEmployeeId)
      : undefined;
    const title = `Attendance Record of ${employee?.name ?? "Employee"} for ${formatMonthTitle(historyMonth)}`;

    exportToExcel(
      monthlyHistoryRows.map((row, index) => ({
        sl: index + 1,
        employeeId: resolvedHistoryEmployeeId ?? "—",
        employeeName: employee?.name ?? "—",
        department: employee?.department ?? "—",
        team: employee?.squad ?? "—",
        date: row.date.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        breakStart: BREAK_PLACEHOLDER,
        breakEnd: BREAK_PLACEHOLDER,
        totalHours: row.workingHours,
        status: row.status,
        source: row.source,
      })),
      {
        fileName: `attendance-${employee?.name ?? "employee"}-${buildMonthInputValue(historyMonth)}`,
        sheetName: "Monthly Attendance",
        title,
        autoFilter: true,
        columns: [
          { key: "sl", label: "SL", width: 6 },
          { key: "employeeId", label: "Employee ID", width: 18 },
          { key: "employeeName", label: "Employee Name", width: 28 },
          { key: "department", label: "Department", width: 20 },
          { key: "team", label: "Team", width: 18 },
          { key: "date", label: "Date", width: 16 },
          { key: "checkIn", label: "Check-in", width: 16 },
          { key: "checkOut", label: "Check-out", width: 16 },
          { key: "breakStart", label: "Break Start Time", width: 18 },
          { key: "breakEnd", label: "Break End Time", width: 18 },
          { key: "totalHours", label: "Total Working Hour", width: 20 },
          { key: "status", label: "Status", width: 14 },
          { key: "source", label: "Source", width: 14 },
        ],
      },
    );
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <LoadingSpinner label="Loading attendance record..." helper=""/>
      </div>
    );
  }

  if (overviewQuery.isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center text-slate-600">
        <p>We couldn&apos;t load the attendance dashboard right now.</p>
        <button
          type="button"
          onClick={() => overviewQuery.refetch()}
          className="inline-flex items-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="rounded-[32px] border border-white/60 bg-white/90 p-8 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
              HR admin • Attendance
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
              Attendance operations overview
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Monitor daily check-ins, make manual corrections, explore history, and export what you need.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <FiCalendar className="text-slate-500" />
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Viewing</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedDateLabel}
                </p>
              </div>
            </div>
            <CustomDatePicker
              label=""
              value={selectedDate}
              onChange={handleSelectedDateChange}
              className="sm:min-w-[220px]"
            />
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-lg dark:border-slate-700/70 dark:bg-slate-900/80"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">
              {card.value}
            </p>
            <p className="text-sm text-slate-400">{card.detail}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <section className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Attendance log
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {filteredDayLogs.length} of {dayLogs.length} records for {selectedDateLabel}.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={!filteredDayLogs.length}
              className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
            >
              <FiDownload />
              Export Excel
            </button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-400">
              Search
              <input
                type="text"
                value={logFilters.query}
                placeholder="Name or squad"
                onChange={(event) =>
                  setLogFilters((prev) => ({ ...prev, query: event.target.value }))
                }
                className="mt-2 h-[44px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status filter
              <select
                value={logFilters.status}
                onChange={(event) =>
                  setLogFilters((prev) => ({
                    ...prev,
                    status: event.target.value as LogFilters["status"],
                  }))
                }
                className="mt-2 h-[44px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="all">All statuses</option>
                <option value="On time">On time</option>
                <option value="Late">Late</option>
                <option value="On leave">On leave</option>
                <option value="Absent">Absent</option>
              </select>
            </label>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Squad</th>
                  <th className="px-4 py-3 font-semibold">Check-in</th>
                  <th className="px-4 py-3 font-semibold">Check-out</th>
                  <th className="px-4 py-3 font-semibold">Total working hour</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDayLogs.length ? (
                  filteredDayLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/70 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-4 py-4 font-semibold">
                        <div className="flex items-center gap-2">
                          {log.name}
                          {log.source === "Manual" && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:bg-amber-500/10 dark:text-amber-200">
                              Manual
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">{log.squad ?? "—"}</td>
                      <td className="px-4 py-4">{log.checkIn}</td>
                      <td className="px-4 py-4">{log.checkOut}</td>
                      <td className="px-4 py-4">
                        {calculateWorkingHours(log.checkIn, log.checkOut)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeVariant[log.status]}`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                    >
                      {dayLogs.length
                        ? "No records match the current filters."
                        : "No attendance data for this date yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl dark:border-slate-700/70 dark:bg-slate-900/80">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Attendance calendar
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Tap a date to quickly load its log.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
              {weekdayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell, index) => {
                if (!cell.date) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="h-14 rounded-2xl border border-transparent"
                    />
                  );
                }

                const isSelected = formatDateKey(cell.date) === selectedDayKey;
                const future = isFutureDate(cell.date);

                return (
                  <button
                    type="button"
                    key={cell.key}
                    onClick={() => {
                      if (!future && cell.date) {
                        updateSelectedDate(cell.date);
                      }
                    }}
                    disabled={future}
                    className={`flex h-14 flex-col items-center justify-center rounded-2xl border text-sm font-semibold transition ${
                      future
                        ? "cursor-not-allowed border-dashed border-slate-200 bg-slate-50 text-slate-300 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-600"
                        : isSelected
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-200"
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
                    }`}
                  >
                    {cell.date.getDate()}
                    {!future && cell.signal !== "none" && (
                      <span
                        className={`mt-1 h-2.5 w-2.5 rounded-full ${calendarSignalColor[cell.signal]}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl dark:border-slate-700/70 dark:bg-slate-900/80">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Charts & insights
            </h3>
            <div className="mt-4 space-y-6">
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
                    Status breakdown
                  </p>
                  <div className="mt-3 flex items-center gap-6">
                    <div
                      className="h-32 w-32 rounded-full border border-slate-100 shadow-inner dark:border-slate-700"
                      style={{ background: statusChartBackground }}
                    >
                      <div className="m-3 flex h-20 w-20 items-center justify-center rounded-full bg-white text-center text-xs font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                        {totalLogs ? `${onTimeRate}% on-time` : "No data"}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      {statusBreakdown.map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            {item.label}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
                    Weekly reliability
                  </p>
                  <div className="mt-3 rounded-2xl border border-slate-100 bg-gradient-to-b from-indigo-50 via-white to-white p-4 dark:border-slate-800 dark:from-slate-800/40 dark:via-slate-900">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-32 w-full">
                      <defs>
                        <linearGradient id="attendanceTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={areaPathD} fill="url(#attendanceTrend)" stroke="none" />
                      <polyline
                        points={polylinePoints}
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="mt-2 grid grid-cols-5 gap-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-300">
                      {weeklyTrend.length ? (
                        weeklyTrend.map((entry) => (
                          <div key={entry.date}>
                            <p>{entry.label}</p>
                            <p className="text-sm text-slate-900 dark:text-slate-100">
                              {entry.presentPercentage}%
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="col-span-5 text-center text-xs text-slate-400">
                          No trend data yet
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
              Monthly employee history
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Review an individual&apos;s attendance for {historyMonthLabel} and download the report.
            </p>
          </div>
          <button
            type="button"
            onClick={handleMonthlyExport}
            disabled={!monthlyHistoryRows.length || historyQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
          >
            <FiDownload />
            {historyQuery.isFetching ? "Preparing..." : "Export Excel"}
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-400">
            Employee
            <select
              value={resolvedHistoryEmployeeId}
              disabled={!employees.length}
              onChange={(event) => setHistoryEmployeeId(event.target.value)}
              className="mt-2 h-[46px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {employees.length ? (
                employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {employee.squad ? ` — ${employee.squad}` : ""}
                  </option>
                ))
              ) : (
                <option value="">No employees available</option>
              )}
            </select>
          </label>

          <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-400">
            Month
            <input
              type="month"
              max={maxMonthValue}
              value={buildMonthInputValue(historyMonth)}
              onChange={(event) => {
                const parsed = parseMonthInputValue(event.target.value);
                if (parsed && !isFutureDate(parsed)) {
                  setHistoryMonth(parsed);
                }
              }}
              className="mt-2 h-[46px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Check-in</th>
                <th className="px-4 py-3 font-semibold">Check-out</th>
                <th className="px-4 py-3 font-semibold">Total working hour</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {historyQuery.isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Loading history...
                  </td>
                </tr>
              ) : monthlyHistoryRows.length ? (
                monthlyHistoryRows.map((row) => (
                  <tr
                    key={row.date.toISOString()}
                    className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/70 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-4 font-semibold">
                      {row.date.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-4">{row.checkIn}</td>
                    <td className="px-4 py-4">{row.checkOut}</td>
                    <td className="px-4 py-4">{row.workingHours}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeVariant[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">{row.source}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    No records for this employee in {historyMonthLabel} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
              Manual attendance entry
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Log a check-in manually when an employee misses or needs a correction.
            </p>
          </div>
          {formFeedback && (
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
              {formFeedback}
            </span>
          )}
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4" onSubmit={handleManualSubmit}>
          <label className="flex flex-col text-sm font-semibold text-slate-600 dark:text-slate-300">
            Employee
            <select
              className="mt-2 h-[46px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={resolvedManualEmployeeId}
              disabled={!employees.length}
              onChange={(event) =>
                setManualForm((prev) => ({ ...prev, employeeId: event.target.value }))
              }
            >
              {employees.length ? (
                employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {employee.squad ? ` — ${employee.squad}` : ""}
                  </option>
                ))
              ) : (
                <option value="">No employees available</option>
              )}
            </select>
          </label>

          <div className="md:col-span-2 lg:col-span-1">
            <CustomDatePicker
              label="Date"
              value={manualDate}
              onChange={handleManualDateChange}
            />
          </div>

          <label className="flex flex-col text-sm font-semibold text-slate-600 dark:text-slate-300">
            Check-in
            <input
              type="time"
              value={manualForm.checkIn}
              onChange={(event) =>
                setManualForm((prev) => ({ ...prev, checkIn: event.target.value }))
              }
              required
              className="mt-2 h-[46px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <span className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">
              Status is inferred from this time against the selected work type.
            </span>
          </label>

          <label className="flex flex-col text-sm font-semibold text-slate-600 dark:text-slate-300">
            Check-out
            <input
              type="time"
              value={manualForm.checkOut}
              onChange={(event) =>
                setManualForm((prev) => ({ ...prev, checkOut: event.target.value }))
              }
              className="mt-2 h-[46px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="flex flex-col text-sm font-semibold text-slate-600 dark:text-slate-300">
            Work type
            <select
              className="mt-2 h-[46px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={manualForm.workType}
              onChange={(event) =>
                setManualForm((prev) => ({
                  ...prev,
                  workType: event.target.value as ManualWorkType,
                }))
              }
            >
              {Object.entries(manualWorkTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">
              Determines whether onsite or remote start time thresholds apply.
            </span>
          </label>

          <div className="md:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={!resolvedManualEmployeeId || manualEntryMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <FiPlus />
              {manualEntryMutation.isPending ? "Saving..." : "Save manual attendance"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
