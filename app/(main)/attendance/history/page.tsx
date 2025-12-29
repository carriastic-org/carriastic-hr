"use client";

import { ReactElement, useMemo, useState } from "react";
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";

import Table from "../../../components/atoms/tables/Table";
import Pagination from "../../../components/pagination/Pagination";
import { months } from "../../../utils/dateAndMonth";
import { trpc } from "@/trpc/client";
import { EmployeeHeader } from "@/app/components/layouts/EmployeeHeader";
import { Card } from "@/app/components/atoms/frame/Card";

const backendStatuses = [
  "PRESENT",
  "LATE",
  "HALF_DAY",
  "ABSENT",
  "REMOTE",
  "HOLIDAY",
] as const;

type BackendAttendanceStatus = (typeof backendStatuses)[number];
type StatusFilter = "All" | BackendAttendanceStatus;

const headers = [
  "Date",
  "Day",
  "Check-in",
  "Check-out",
  "Working Hours",
  "Status",
];

const statusMeta: Record<
  BackendAttendanceStatus,
  { label: string; chipClass: string }
> = {
  PRESENT: {
    label: "Present",
    chipClass:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  LATE: {
    label: "Late",
    chipClass:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200",
  },
  HALF_DAY: {
    label: "Half Day",
    chipClass: "bg-sky-50 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200",
  },
  ABSENT: {
    label: "Absent",
    chipClass:
      "bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200",
  },
  REMOTE: {
    label: "Remote",
    chipClass:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200",
  },
  HOLIDAY: {
    label: "Holiday",
    chipClass:
      "bg-violet-50 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200",
  },
};

const statusFilters: StatusFilter[] = ["All", ...backendStatuses];

const isBackendStatus = (status: string): status is BackendAttendanceStatus =>
  backendStatuses.includes(status as BackendAttendanceStatus);

const formatDateLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

const formatDayLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);

const formatTimeLabel = (isoDate: string | null) => {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDuration = (seconds: number) => {
  if (!seconds) return "0h";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  return parts.length > 0 ? parts.join(" ") : "0m";
};

type DisplayRecord = {
  id: string;
  dateLabel: string;
  dayLabel: string;
  checkIn: string;
  checkOut: string;
  hoursLabel: string;
  hoursValue: number;
  status: BackendAttendanceStatus;
  statusLabel: string;
  chipClass: string;
  note: string | null;
};

export default function AttendanceHistory() {
  const today = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState(() => ({
    month: today.getMonth(),
    year: today.getFullYear(),
  }));
  const selectedMonth = selectedPeriod.month;
  const selectedYear = selectedPeriod.year;
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPageData, setCurrentPageData] = useState<
    Array<Record<string, string | number | ReactElement>>
  >([]);

  const historyQuery = trpc.attendance.history.useQuery({
    month: selectedMonth,
    year: selectedYear,
  });

  const displayRecords = useMemo<DisplayRecord[]>(() => {
    const records = historyQuery.data?.records ?? [];
    return records.map((record) => {
      const attendanceDate = new Date(record.attendanceDate);
      const normalizedStatus = isBackendStatus(record.status)
        ? record.status
        : "PRESENT";
      const meta = statusMeta[normalizedStatus];
      const totalWorkSeconds = Math.max(0, record.totalWorkSeconds ?? 0);

      return {
        id: record.id,
        dateLabel: formatDateLabel(attendanceDate),
        dayLabel: formatDayLabel(attendanceDate),
        checkIn: formatTimeLabel(record.checkInAt),
        checkOut: formatTimeLabel(record.checkOutAt),
        hoursLabel: formatDuration(totalWorkSeconds),
        hoursValue: totalWorkSeconds / 3600,
        status: normalizedStatus,
        statusLabel: meta.label,
        chipClass: meta.chipClass,
        note: record.note ?? null,
      };
    });
  }, [historyQuery.data?.records]);

  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return displayRecords.filter((record) => {
      const matchesStatus =
        selectedStatus === "All" || record.status === selectedStatus;
      const matchesSearch = term
        ? `${record.dateLabel} ${record.dayLabel}`.toLowerCase().includes(term)
        : true;
      return matchesStatus && matchesSearch;
    });
  }, [displayRecords, searchTerm, selectedStatus]);

  const tableRows = useMemo(
    () =>
      filteredRecords.map((record) => ({
        Date: record.dateLabel,
        Day: record.dayLabel,
        "Check-in": record.checkIn,
        "Check-out": record.checkOut,
        "Working Hours": record.hoursLabel,
        Status: (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${record.chipClass}`}
          >
            {record.statusLabel}
          </span>
        ),
      })),
    [filteredRecords]
  );

  const presentDays = displayRecords.filter(
    (record) => record.status === "PRESENT" || record.status === "REMOTE"
  ).length;
  const lateDays = displayRecords.filter(
    (record) => record.status === "LATE"
  ).length;
  const halfDays = displayRecords.filter(
    (record) => record.status === "HALF_DAY"
  ).length;
  const absentDays = displayRecords.filter(
    (record) => record.status === "ABSENT"
  ).length;
  const totalHours = displayRecords.reduce(
    (sum, record) => sum + record.hoursValue,
    0
  );

  const summaryCards = [
    {
      label: "Present days",
      value: `${presentDays} days`,
      helper: "Includes WFH + on-site",
    },
    {
      label: "Late / Half day",
      value: `${lateDays + halfDays} days`,
      helper: "Auto-flagged for managers",
    },
    {
      label: "Absences",
      value: `${absentDays} days`,
      helper: "Includes approved leave",
    },
    {
      label: "Logged hours",
      value: `${totalHours.toFixed(1)} hrs`,
      helper: "Goal · 160 hrs / month",
    },
  ];

  const timelineEntries = displayRecords.slice(0, 6);

  const shiftMonth = (direction: "prev" | "next") => {
    setSelectedPeriod((prev) => {
      const { month, year } = prev;
      if (direction === "prev") {
        if (month === 0) {
          return { month: 11, year: year - 1 };
        }
        return { month: month - 1, year };
      }
      if (month === 11) {
        return { month: 0, year: year + 1 };
      }
      return { month: month + 1, year };
    });
  };

  const isLoading = historyQuery.isLoading;
  const hasError = Boolean(historyQuery.error);

  return (
    <div className="space-y-6">
      <EmployeeHeader />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
              Attendance
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              History & shift log
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Monitor check-ins, hours, and exceptions for each month.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70">
            <button
              type="button"
              onClick={() => shiftMonth("prev")}
              className="rounded-full p-2 text-slate-500 transition-colors duration-150 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <MdKeyboardArrowLeft size={20} />
            </button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {months[selectedMonth]} {selectedYear}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth("next")}
              className="rounded-full p-2 text-slate-500 transition-colors duration-150 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <MdKeyboardArrowRight size={20} />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {card.value}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {card.helper}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex min-w-[220px] flex-1 items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by date or weekday"
              className="w-full bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => {
              const isActive = selectedStatus === filter;
              const label = filter === "All" ? "All" : statusMeta[filter].label;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSelectedStatus(filter)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-primary_dark text-white shadow dark:bg-sky-600"
                      : "border border-slate-200 bg-white text-slate-600 transition-colors duration-150 hover:border-primary_dark/40 hover:text-primary_dark dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-sky-500/50 dark:hover:text-sky-400"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-100 bg-white shadow-sm transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/60">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading attendance history...
            </div>
          ) : hasError ? (
            <div className="p-10 text-center text-sm text-rose-500">
              Unable to load attendance history. Please try again.
            </div>
          ) : filteredRecords.length > 0 ? (
            <>
              <Table
                headers={headers}
                rows={currentPageData}
                isTextCenter={false}
                className="rounded-3xl"
              />
              <Pagination
                key={`${selectedYear}-${selectedMonth}-${selectedStatus}-${searchTerm}`}
                data={tableRows}
                postsPerPage={6}
                setCurrentPageData={setCurrentPageData}
              />
            </>
          ) : (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No attendance entries match the current filters.
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
              Highlights
            </p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Recent check-ins
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Quick view of the last 6 attendance updates.
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          {timelineEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              {isLoading
                ? "Loading timeline..."
                : "No attendance records found for this month."}
            </div>
          ) : (
            timelineEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {entry.dateLabel}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {entry.dayLabel}
                  </p>
                </div>
                <div className="flex flex-col text-sm text-slate-600 dark:text-slate-300">
                  <span>
                    Check-in: <strong>{entry.checkIn}</strong>
                  </span>
                  <span>
                    Check-out: <strong>{entry.checkOut}</strong>
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {entry.hoursLabel}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${entry.chipClass}`}
                >
                  {entry.statusLabel}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
