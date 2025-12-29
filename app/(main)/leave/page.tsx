"use client";

import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";
import { useRouter } from "next/navigation";

import Table from "../../components/atoms/tables/Table";
import { EmployeeHeader } from "../../components/layouts/EmployeeHeader";
import {
  leaveTypeOptionMap,
  leaveTypeValues,
  type LeaveTypeValue,
} from "@/lib/leave-types";
import { trpc } from "@/trpc/client";
import { Card } from "@/app/components/atoms/frame/Card";

const headers = [
  "Application ID",
  "Applied On",
  "Leave Type",
  "From",
  "To",
  "Days",
  "Status",
];

const backendStatuses = [
  "PENDING",
  "PROCESSING",
  "APPROVED",
  "DENIED",
  "CANCELLED",
  "DRAFT",
] as const;

type BackendLeaveStatus = (typeof backendStatuses)[number];
type StatusFilter = BackendLeaveStatus | "All";

const statusFilters: StatusFilter[] = ["All", ...backendStatuses];

const statusMeta: Record<BackendLeaveStatus, { label: string; chipClass: string }> = {
  PENDING: {
    label: "Pending",
    chipClass: "bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200",
  },
  PROCESSING: {
    label: "Processing",
    chipClass: "bg-sky-50 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200",
  },
  APPROVED: {
    label: "Approved",
    chipClass:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  DENIED: {
    label: "Denied",
    chipClass: "bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200",
  },
  CANCELLED: {
    label: "Cancelled",
    chipClass: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-200",
  },
  DRAFT: {
    label: "Draft",
    chipClass: "bg-slate-50 text-slate-500 dark:bg-slate-800/30 dark:text-slate-200",
  },
};

const isBackendStatus = (status: string): status is BackendLeaveStatus =>
  backendStatuses.includes(status as BackendLeaveStatus);

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatApplicationId = (id: string) =>
  `APP-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

const getYearFromIso = (iso: string) => {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
};

type TableRow = Record<string, string | number | ReactElement>;

export default function EmployeeLeavePage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchTerm, setSearchTerm] = useState("");

  const summaryQuery = trpc.leave.summary.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const balances = summaryQuery.data?.balances ?? [];

  const filteredRequests = useMemo(
    () =>
      (summaryQuery.data?.requests ?? [])
        .filter((request) => getYearFromIso(request.startDate) === year)
        .filter((request) =>
          statusFilter === "All" ? true : request.status === statusFilter,
        )
        .filter((request) => {
          const value = searchTerm.trim().toLowerCase();
          if (!value) return true;
          return (
            formatApplicationId(request.id).toLowerCase().includes(value) ||
            request.leaveTypeLabel.toLowerCase().includes(value) ||
            (request.reason ?? "").toLowerCase().includes(value)
          );
        }),
    [summaryQuery.data?.requests, year, statusFilter, searchTerm],
  );

  const tableRows = useMemo<TableRow[]>(
    () =>
      filteredRequests.map((request) => {
        const normalizedStatus = isBackendStatus(request.status)
          ? request.status
          : "PENDING";
        const status = statusMeta[normalizedStatus];
        const leaveType =
          leaveTypeOptionMap[request.leaveType as LeaveTypeValue]?.shortLabel ??
          request.leaveTypeLabel;

        return {
          "Application ID": formatApplicationId(request.id),
          "Applied On": formatDate(request.createdAt),
          "Leave Type": leaveType,
          From: formatDate(request.startDate),
          To: formatDate(request.endDate),
          Days: `${request.totalDays} day${request.totalDays > 1 ? "s" : ""}`,
          Status: (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status.chipClass}`}
            >
              {status.label}
            </span>
          ),
        };
      }),
    [filteredRequests],
  );

  const upcoming = useMemo(
    () =>
      filteredRequests
        .filter((request) => {
          if (!isBackendStatus(request.status)) return false;
          const status = request.status;
          if (status !== "PENDING" && status !== "PROCESSING") {
            return false;
          }
          const start = new Date(request.startDate);
          return start.getFullYear() === year;
        })
        .slice(0, 4),
    [filteredRequests, year],
  );

  const decrementYear = () => setYear((prevYear) => prevYear - 1);
  const incrementYear = () => setYear((prevYear) => prevYear + 1);

  return (
    <div>
      <div className="space-y-6">
        <EmployeeHeader
          hasRightButton
          buttonText="New application"
          onButtonClick={() => router.push("/leave/application")}
        />

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
                Leave balance
              </p>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                Track allocations at a glance
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Balances sync automatically whenever you submit a request.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={decrementYear}
                className="rounded-full p-2 text-slate-500 transition-colors duration-150 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <MdKeyboardArrowLeft size={20} />
              </button>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {year}
              </span>
              <button
                type="button"
                onClick={incrementYear}
                className="rounded-full p-2 text-slate-500 transition-colors duration-150 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <MdKeyboardArrowRight size={20} />
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {leaveTypeValues.map((type) => {
              const option = leaveTypeOptionMap[type];
              const balance = balances.find(
                (entry) => (entry.type as LeaveTypeValue) === type,
              );
              const allocation = option.defaultAllocationDays;
              const remaining = balance?.remaining ?? allocation;
              const used = Math.max(0, allocation - remaining);

              return (
                <div
                  key={type}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70"
                >
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
                    {option.shortLabel}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
                    {remaining}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    of {allocation} days · {used} used
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Leave history
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Search by ID, filter by status, and keep an eye on approvals.
                </p>
              </div>
              <div className="flex min-w-[220px] flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search ID or purpose"
                  className="w-full bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    statusFilter === filter
                      ? "bg-primary_dark text-white shadow dark:bg-sky-600"
                      : "border border-slate-200 bg-white text-slate-600 transition-colors duration-150 hover:border-primary_dark/40 hover:text-primary_dark dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-sky-500/50 dark:hover:text-sky-400"
                  }`}
                >
                  {filter === "All" ? "All" : statusMeta[filter].label}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-slate-100 bg-white transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/70">
              {summaryQuery.isLoading ? (
                <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  Loading leave applications…
                </div>
              ) : tableRows.length > 0 ? (
                <Table headers={headers} rows={tableRows} />
              ) : (
                <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  No leave applications match these filters.
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Upcoming decisions
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Requests waiting on manager or HR approval.
              </p>
            </div>
            <ul className="space-y-3">
              {upcoming.map((request) => {
                const normalizedStatus = isBackendStatus(request.status)
                  ? request.status
                  : "PENDING";
                const status = statusMeta[normalizedStatus];
                return (
                  <li
                    key={request.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {request.leaveTypeLabel}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${status.chipClass}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(request.startDate)} → {formatDate(request.endDate)} ·{" "}
                      {request.totalDays} day{request.totalDays > 1 ? "s" : ""}
                    </p>
                    {request.reason && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {request.reason}
                      </p>
                    )}
                  </li>
                );
              })}
              {!summaryQuery.isLoading && upcoming.length === 0 && (
                <li className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 transition-colors duration-200 dark:border-slate-700/60 dark:text-slate-400">
                  You have no pending requests this year.
                </li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
