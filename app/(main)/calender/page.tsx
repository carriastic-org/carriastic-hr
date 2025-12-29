"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiSun,
} from "react-icons/fi";
import type { AttendanceStatus, LeaveStatus } from "@prisma/client";

import { trpc } from "@/trpc/client";
import { EmployeeHeader } from "@/app/components/layouts/EmployeeHeader";
import { Card } from "@/app/components/atoms/frame/Card";
import Text from "@/app/components/atoms/Text/Text";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import type { WeekdayOption } from "@/types/hr-work";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type WeekSchedule = {
  workingDays: WeekdayOption[];
  weekendDays: WeekdayOption[];
};

const fallbackPolicy: WeekSchedule = {
  workingDays: [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
  ] as WeekdayOption[],
  weekendDays: ["SATURDAY", "SUNDAY"] as WeekdayOption[],
  // Used if no organization work policy is configured yet.
};

const legendItems = [
  {
    label: "Workday",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-50",
  },
  {
    label: "Weekend",
    className:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100",
  },
  {
    label: "Holiday",
    className:
      "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100",
  },
  {
    label: "Leave",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-50",
  },
  {
    label: "Attendance",
    className:
      "bg-emerald-500 text-white dark:bg-emerald-500/80 dark:text-white",
  },
];

const workedStatuses = new Set<AttendanceStatus>([
  "PRESENT",
  "LATE",
  "HALF_DAY",
  "REMOTE",
]);

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "numeric",
});

const startOfDay = (value: Date) => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

const formatDateKey = (value: Date) => startOfDay(value).toISOString().split("T")[0]!;

const toDayIndex = (weekday: WeekdayOption) => {
  switch (weekday) {
    case "MONDAY":
      return 1;
    case "TUESDAY":
      return 2;
    case "WEDNESDAY":
      return 3;
    case "THURSDAY":
      return 4;
    case "FRIDAY":
      return 5;
    case "SATURDAY":
      return 6;
    default:
      return 0;
  }
};

const getMonthMeta = (year: number, month: number) => {
  const monthStart = startOfDay(new Date(year, month, 1));
  const monthEnd = startOfDay(new Date(year, month + 1, 0));
  const daysInMonth = monthEnd.getDate();
  const firstDayIndex = monthStart.getDay();
  const leadingNulls = (firstDayIndex + 6) % 7;
  const totalCells = Math.ceil((leadingNulls + daysInMonth) / 7) * 7;
  return { monthStart, monthEnd, daysInMonth, leadingNulls, totalCells };
};

const formatTimeValue = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return timeFormatter.format(parsed);
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds) return "0h";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (!hours) {
    return minutes ? `${minutes}m` : "0h";
  }
  if (!minutes) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
};

const buildRangeLabel = (start: Date, end: Date) => {
  const startLabel = shortDateFormatter.format(start);
  const endLabel = shortDateFormatter.format(end);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
};

type AttendanceRecord = {
  id: string;
  attendanceDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  totalWorkSeconds: number;
  totalBreakSeconds: number;
  status: AttendanceStatus;
  note: string | null;
  source: string | null;
  location: string | null;
};

type CalendarCell = {
  key: string;
  date: Date | null;
  dayNumber: number | null;
  isWeekend: boolean;
  isWorkingDay: boolean;
  isHoliday: boolean;
  isToday: boolean;
  attendance?: AttendanceRecord;
  leaves: Array<{ id: string; label: string; status: LeaveStatus }>;
  holiday?: { id: string; title: string };
};

type CalendarEventSummary = {
  id: string;
  date: Date;
  title: string;
  helper: string;
  type: "leave" | "holiday";
  status?: LeaveStatus;
};

const attendanceStatusMeta: Record<AttendanceStatus | "UNRECORDED", { label: string; badgeClass: string; dotClass: string; description: string }> = {
  PRESENT: {
    label: "Present",
    badgeClass:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
    dotClass: "bg-emerald-500",
    description: "You were on time and checked in normally.",
  },
  LATE: {
    label: "Late",
    badgeClass:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
    dotClass: "bg-amber-500",
    description: "Marked late relative to scheduled work hours.",
  },
  HALF_DAY: {
    label: "Half Day",
    badgeClass:
      "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200",
    dotClass: "bg-sky-500",
    description: "Only half-day attendance was logged.",
  },
  ABSENT: {
    label: "Absent",
    badgeClass:
      "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
    dotClass: "bg-rose-500",
    description: "No attendance record was filed for this day.",
  },
  REMOTE: {
    label: "Remote",
    badgeClass:
      "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200",
    dotClass: "bg-indigo-500",
    description: "Work-from-home attendance was recorded.",
  },
  HOLIDAY: {
    label: "Holiday",
    badgeClass:
      "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200",
    dotClass: "bg-violet-500",
    description: "Holiday was scheduled for this date.",
  },
  UNRECORDED: {
    label: "Not logged",
    badgeClass:
      "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
    dotClass: "bg-slate-400",
    description: "No attendance entry found for this date.",
  },
};

const leaveStatusMeta: Record<LeaveStatus, { label: string; chipClass: string }> = {
  PENDING: {
    label: "Pending",
    chipClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-50",
  },
  PROCESSING: {
    label: "Processing",
    chipClass:
      "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100",
  },
  APPROVED: {
    label: "Approved",
    chipClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-50",
  },
  DENIED: {
    label: "Denied",
    chipClass:
      "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-50",
  },
  CANCELLED: {
    label: "Cancelled",
    chipClass:
      "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-200",
  },
  DRAFT: {
    label: "Draft",
    chipClass:
      "bg-slate-50 text-slate-600 dark:bg-slate-800/30 dark:text-slate-200",
  },
};

const CalenderPage = () => {
  const { today, todayKey } = useMemo(() => {
    const current = startOfDay(new Date());
    return {
      today: current,
      todayKey: formatDateKey(current),
    };
  }, []);
  const yesterday = useMemo(
    () => startOfDay(new Date(today.getTime() - 24 * 60 * 60 * 1000)),
    [today],
  );
  const [viewDate, setViewDate] = useState(() => startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const viewMonth = viewDate.getMonth();
  const viewYear = viewDate.getFullYear();
  const monthMeta = useMemo(() => getMonthMeta(viewYear, viewMonth), [viewMonth, viewYear]);
  const { monthStart, monthEnd, daysInMonth, leadingNulls, totalCells } = monthMeta;

  const calendarHistoryQuery = trpc.attendance.history.useQuery(
    { month: viewMonth, year: viewYear },
    { placeholderData: keepPreviousData },
  );
  const leaveSummaryQuery = trpc.leave.summary.useQuery({ limit: 50 });
  const holidaysQuery = trpc.dashboard.holidays.useQuery();

  const yesterdayMonthMatchesView =
    yesterday.getMonth() === viewMonth && yesterday.getFullYear() === viewYear;
  const yesterdayHistoryQuery = trpc.attendance.history.useQuery(
    { month: yesterday.getMonth(), year: yesterday.getFullYear() },
    { enabled: !yesterdayMonthMatchesView },
  );

  const weekSchedule = calendarHistoryQuery.data?.weekSchedule ?? fallbackPolicy;

  const workingDaySet = useMemo<Set<number>>(
    () => new Set<number>(weekSchedule.workingDays.map(toDayIndex)),
    [weekSchedule.workingDays],
  );
  const weekendDaySet = useMemo<Set<number>>(
    () => new Set<number>(weekSchedule.weekendDays.map(toDayIndex)),
    [weekSchedule.weekendDays],
  );

  const attendanceRecords = useMemo(
    () => calendarHistoryQuery.data?.records ?? [],
    [calendarHistoryQuery.data?.records],
  );
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceRecords.forEach((record) => {
      const key = record.attendanceDate.split("T")[0] ?? record.attendanceDate;
      map.set(key, record as AttendanceRecord);
    });
    return map;
  }, [attendanceRecords]);

  const leaveRequests = useMemo(
    () => leaveSummaryQuery.data?.requests ?? [],
    [leaveSummaryQuery.data?.requests],
  );
  const activeLeaves = useMemo(
    () =>
      leaveRequests.filter((request) => {
        if (
          request.status !== "APPROVED" &&
          request.status !== "PROCESSING" &&
          request.status !== "PENDING"
        ) {
          return false;
        }
        const start = startOfDay(new Date(request.startDate));
        const end = startOfDay(new Date(request.endDate));
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return false;
        }
        return end >= monthStart && start <= monthEnd;
      }),
    [leaveRequests, monthEnd, monthStart],
  );

  const leaveDayMap = useMemo(() => {
    const map = new Map<string, Array<{ id: string; label: string; status: LeaveStatus }>>();
    activeLeaves.forEach((request) => {
      const rangeStart = startOfDay(new Date(request.startDate));
      const rangeEnd = startOfDay(new Date(request.endDate));
      const clampedStart = rangeStart.getTime() < monthStart.getTime()
        ? monthStart
        : rangeStart;
      const clampedEnd = rangeEnd.getTime() > monthEnd.getTime()
        ? monthEnd
        : rangeEnd;

      for (
        let cursor = new Date(clampedStart);
        cursor.getTime() <= clampedEnd.getTime();
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const key = formatDateKey(cursor);
        const existing = map.get(key) ?? [];
        existing.push({
          id: request.id,
          label: request.leaveTypeLabel,
          status: request.status,
        });
        map.set(key, existing);
      }
    });
    return map;
  }, [activeLeaves, monthEnd, monthStart]);

  const monthHolidays = useMemo(() => {
    const holidays = holidaysQuery.data?.holidays ?? [];
    return holidays.filter((holiday) => {
      const date = startOfDay(new Date(holiday.date));
      if (Number.isNaN(date.getTime())) {
        return false;
      }
      return date.getTime() >= monthStart.getTime() && date.getTime() <= monthEnd.getTime();
    });
  }, [holidaysQuery.data?.holidays, monthEnd, monthStart]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    monthHolidays.forEach((holiday) => {
      const key = holiday.date.split("T")[0] ?? holiday.date;
      map.set(key, { id: holiday.id, title: holiday.title });
    });
    return map;
  }, [monthHolidays]);

  const calendarCells: CalendarCell[] = useMemo(() => {
    const cells: CalendarCell[] = [];
    for (let index = 0; index < totalCells; index += 1) {
      const dayNumber = index - leadingNulls + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cells.push({
          key: `empty-${index}`,
          date: null,
          dayNumber: null,
          isWeekend: false,
          isWorkingDay: false,
          isHoliday: false,
          isToday: false,
          leaves: [],
        });
        continue;
      }

      const date = new Date(viewYear, viewMonth, dayNumber);
      const key = formatDateKey(date);
      const dayIndex = date.getDay();
      const isWeekend = weekendDaySet.has(dayIndex);
      const holiday = holidayMap.get(key);
      const isHoliday = Boolean(holiday);
      const isWorkingDay = !isHoliday && workingDaySet.has(dayIndex);
      const isToday = key === todayKey;

      cells.push({
        key,
        date,
        dayNumber,
        isWeekend,
        isWorkingDay,
        isHoliday,
        isToday,
        attendance: attendanceMap.get(key),
        leaves: leaveDayMap.get(key) ?? [],
        holiday,
      });
    }
    return cells;
  }, [
    attendanceMap,
    holidayMap,
    leaveDayMap,
    daysInMonth,
    leadingNulls,
    totalCells,
    todayKey,
    viewMonth,
    viewYear,
    weekendDaySet,
    workingDaySet,
  ]);
  const selectedCell = useMemo(
    () => calendarCells.find((cell) => cell.key === selectedDateKey && cell.date) ?? null,
    [calendarCells, selectedDateKey],
  );
  const selectedCellAttendanceMeta = selectedCell?.attendance
    ? attendanceStatusMeta[selectedCell.attendance.status]
    : null;

  const workdayCount = useMemo(() => {
    let count = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(viewYear, viewMonth, day);
      if (workingDaySet.has(date.getDay())) {
        count += 1;
      }
    }
    return count;
  }, [daysInMonth, viewMonth, viewYear, workingDaySet]);

  const leaveDayCount = leaveDayMap.size;
  const holidayCount = monthHolidays.length;
  const attendedDays = attendanceRecords.filter((record) =>
    workedStatuses.has(record.status),
  ).length;

  const upcomingEvents = useMemo<CalendarEventSummary[]>(() => {
    const events: CalendarEventSummary[] = [];
    monthHolidays.forEach((holiday) => {
      const date = startOfDay(new Date(holiday.date));
      events.push({
        id: `holiday-${holiday.id}`,
        date,
        title: holiday.title,
        helper: "Company holiday",
        type: "holiday",
      });
    });
    activeLeaves.forEach((leave) => {
      const start = startOfDay(new Date(leave.startDate));
      const end = startOfDay(new Date(leave.endDate));
      events.push({
        id: `leave-${leave.id}`,
        date: start,
        title: leave.leaveTypeLabel,
        helper: buildRangeLabel(start, end),
        type: "leave",
        status: leave.status,
      });
    });
    return events
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 6);
  }, [activeLeaves, monthHolidays]);

  const yesterdayRecords = yesterdayMonthMatchesView
    ? attendanceRecords
    : yesterdayHistoryQuery.data?.records ?? [];
  const yesterdayKey = formatDateKey(yesterday);
  const yesterdayRecord = yesterdayRecords.find(
    (record) => record.attendanceDate.split("T")[0] === yesterdayKey,
  ) as AttendanceRecord | undefined;
  const yesterdayStatus = yesterdayRecord
    ? attendanceStatusMeta[yesterdayRecord.status]
    : attendanceStatusMeta.UNRECORDED;

  const changeMonth = (delta: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  if (calendarHistoryQuery.isLoading && !calendarHistoryQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner label="Loading calendar" />
      </div>
    );
  }

  const calendarError = calendarHistoryQuery.isError;

  return (
    <div className="space-y-6">
      <EmployeeHeader />

      {calendarError ? (
        <Card>
          <div className="flex flex-col items-center gap-3 text-center">
            <Text
              text="We couldn’t load your calendar"
              className="text-2xl font-semibold text-slate-900 dark:text-slate-100"
            />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Please refresh the page or try again in a moment.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
                  Work calendar
                </p>
                <Text
                  text={monthFormatter.format(viewDate)}
                  className="text-3xl font-semibold text-slate-900 dark:text-slate-100"
                />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Weekdays, weekends, holidays, and leave plans at a glance.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-900/60">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="Previous month"
                >
                  <FiChevronLeft />
                </button>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {monthFormatter.format(viewDate)}
                </span>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="Next month"
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {legendItems.map((item) => (
                <span
                  key={item.label}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.className}`}
                >
                  {item.label}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              {weekdayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell) => {
                if (!cell.date || !cell.dayNumber) {
                  return <div key={cell.key} className="min-h-[120px]" />;
                }

                const hasHoliday = cell.isHoliday;
                const hasLeave = cell.leaves.length > 0;
                const isSelected = cell.key === selectedDateKey;
                let stateClass =
                  "border border-white/60 bg-white/80 text-slate-600 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200";
                if (hasHoliday) {
                  stateClass =
                    "border-rose-200 bg-gradient-to-br from-rose-500/90 to-orange-400 text-white shadow-lg dark:border-rose-500/40";
                } else if (hasLeave) {
                  stateClass =
                    "border-amber-200 bg-amber-50 text-amber-900 shadow dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-50";
                } else if (cell.isToday) {
                  stateClass =
                    "border-emerald-200 bg-emerald-500/90 text-white shadow-lg dark:border-emerald-400/50";
                } else if (cell.isWeekend && !hasHoliday && !hasLeave) {
                  stateClass =
                    "border-indigo-100 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/20 dark:text-indigo-100";
                }

                const attendanceMeta = cell.attendance
                  ? attendanceStatusMeta[cell.attendance.status]
                  : null;
                const statusBadge = (() => {
                  if (hasLeave) {
                    return {
                      label: "Leave",
                      className:
                        "bg-amber-100 text-amber-700 dark:bg-amber-500/30 dark:text-amber-50",
                    };
                  }
                  if (hasHoliday) {
                    return {
                      label: "Holiday",
                      className:
                        "bg-rose-100 text-rose-700 dark:bg-rose-500/30 dark:text-rose-100",
                    };
                  }
                  if (!cell.isWorkingDay && !cell.isWeekend) {
                    return {
                      label: "Off",
                      className:
                        "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-200",
                    };
                  }
                  return null;
                })();

                return (
                  <div
                    key={cell.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDateKey(cell.key)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedDateKey(cell.key);
                      }
                    }}
                    className={`min-h-[120px] rounded-2xl px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${stateClass} ${
                      isSelected ? "ring-2 ring-emerald-400 dark:ring-emerald-300" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{cell.dayNumber}</span>
                      {cell.isToday ? (
                        <span className="rounded-full bg-white/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                          Today
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] font-normal">
                      {statusBadge ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge.className}`}
                        >
                          {statusBadge.label}
                        </span>
                      ) : null}
                      {cell.holiday ? (
                        <span className="flex items-center gap-1">
                          <FiSun className="text-base" />
                          <span className="truncate">{cell.holiday.title}</span>
                        </span>
                      ) : null}
                      {hasLeave ? (
                        <span className="flex items-center gap-1 text-xs">
                          <FiCalendar className="text-base" />
                          <span className="truncate">
                            {cell.leaves[0]?.label}
                            {cell.leaves.length > 1 ? ` +${cell.leaves.length - 1}` : ""}
                          </span>
                        </span>
                      ) : null}
                      {attendanceMeta ? (
                        <span className="flex items-center gap-1 text-xs">
                          <span className={`h-2 w-2 rounded-full ${attendanceMeta.dotClass}`} />
                          {attendanceMeta.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <div className="flex items-center gap-3">
                <FiCalendar className="text-xl text-slate-500" />
                <div>
                  <p className="text-xs uppercase text-slate-400 dark:text-slate-500">
                    Selected day
                  </p>
                  <Text
                    text={selectedCell?.date ? dateFormatter.format(selectedCell.date) : "Choose a date"}
                    className="text-xl font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              {selectedCell ? (
                <div className="mt-4 space-y-3 text-sm">
                  {selectedCell.holiday ? (
                    <div className="rounded-2xl border border-rose-200/60 bg-rose-50/80 p-3 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
                      <p className="text-xs font-semibold uppercase tracking-wide">Holiday</p>
                      <p className="text-base font-semibold">{selectedCell.holiday.title}</p>
                    </div>
                  ) : null}
                  {selectedCell.leaves.length > 0 ? (
                    <div className="space-y-2">
                      {selectedCell.leaves.map((leave) => (
                        <div
                          key={leave.id}
                          className="rounded-2xl border border-amber-200/60 bg-amber-50/70 p-3 dark:border-amber-500/40 dark:bg-amber-500/10"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-amber-900 dark:text-amber-50">{leave.label}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${leaveStatusMeta[leave.status].chipClass}`}
                            >
                              {leaveStatusMeta[leave.status].label}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {selectedCellAttendanceMeta ? (
                    <div className="rounded-2xl border border-slate-200/80 p-3 dark:border-slate-700/60">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${selectedCellAttendanceMeta.badgeClass}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${selectedCellAttendanceMeta.dotClass}`} />
                        {selectedCellAttendanceMeta.label}
                      </span>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs uppercase text-slate-400 dark:text-slate-500">
                        <div>
                          <p>Check-in</p>
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100 normal-case">
                            {formatTimeValue(selectedCell.attendance?.checkInAt)}
                          </p>
                        </div>
                        <div>
                          <p>Check-out</p>
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100 normal-case">
                            {formatTimeValue(selectedCell.attendance?.checkOutAt)}
                          </p>
                        </div>
                        <div>
                          <p>Worked</p>
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100 normal-case">
                            {formatDuration(selectedCell.attendance?.totalWorkSeconds)}
                          </p>
                        </div>
                        <div>
                          <p>Breaks</p>
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100 normal-case">
                            {formatDuration(selectedCell.attendance?.totalBreakSeconds)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {!selectedCell.holiday &&
                  selectedCell.leaves.length === 0 &&
                  !selectedCellAttendanceMeta ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No events logged for this day.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Select any date on the calendar to see details here.
                </p>
              )}
            </Card>
            <Card>
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-indigo-500/10 p-3 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                  <FiClock className="text-2xl" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                    Yesterday
                  </p>
                  <Text
                    text={dateFormatter.format(yesterday)}
                    className="text-xl font-semibold text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {yesterdayStatus.description}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-slate-200/80 p-4 dark:border-slate-700/60">
                {yesterdayHistoryQuery.isLoading && !yesterdayMonthMatchesView ? (
                  <div className="flex items-center justify-center">
                    <LoadingSpinner label="Loading record" />
                  </div>
                ) : yesterdayRecord ? (
                  <div className="space-y-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${yesterdayStatus.badgeClass}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${yesterdayStatus.dotClass}`} />
                      {yesterdayStatus.label}
                    </span>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs uppercase text-slate-400 dark:text-slate-500">
                          Check-in
                        </p>
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          {formatTimeValue(yesterdayRecord.checkInAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-400 dark:text-slate-500">
                          Check-out
                        </p>
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          {formatTimeValue(yesterdayRecord.checkOutAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-400 dark:text-slate-500">
                          Worked
                        </p>
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          {formatDuration(yesterdayRecord.totalWorkSeconds)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-400 dark:text-slate-500">
                          Breaks
                        </p>
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          {formatDuration(yesterdayRecord.totalBreakSeconds)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No attendance record was filed for yesterday.
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
                  This month
                </p>
                <Text
                  text="Snapshot"
                  className="text-2xl font-semibold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4 text-sm dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-xs uppercase text-slate-400 dark:text-slate-500">
                    Scheduled workdays
                  </p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {workdayCount}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Based on work policy
                  </p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4 text-sm dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-xs uppercase text-slate-400 dark:text-slate-500">
                    Leave days
                  </p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {leaveDayCount}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Approved or pending
                  </p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4 text-sm dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-xs uppercase text-slate-400 dark:text-slate-500">
                    Holidays
                  </p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {holidayCount}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Organization wide
                  </p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4 text-sm dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-xs uppercase text-slate-400 dark:text-slate-500">
                    Days attended
                  </p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {attendedDays}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Present, late, remote, or half-day
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <FiCalendar className="text-xl text-slate-500" />
                <div>
                  <p className="text-xs uppercase text-slate-400 dark:text-slate-500">
                    Upcoming events
                  </p>
                  <Text
                    text="Holidays & leave"
                    className="text-xl font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="space-y-4">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No holidays or leave plans in this month.
                  </p>
                ) : (
                  upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-white/60 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60"
                    >
                      <p className="text-xs uppercase text-slate-400 dark:text-slate-500">
                        {shortDateFormatter.format(event.date)}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <Text
                          text={event.title}
                          className="text-base font-semibold text-slate-900 dark:text-slate-100"
                        />
                        {event.type === "leave" && event.status ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${leaveStatusMeta[event.status].chipClass}`}>
                            {leaveStatusMeta[event.status].label}
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-100">
                            Holiday
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {event.helper}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalenderPage;
