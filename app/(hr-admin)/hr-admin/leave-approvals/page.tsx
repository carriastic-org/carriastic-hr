'use client';

import { useEffect, useMemo, useState } from "react";
import { BiChevronDown, BiChevronUp, BiDownload } from "react-icons/bi";
import { FiCheck, FiEye, FiSearch, FiX } from "react-icons/fi";
import ApplicationPreview from "@/app/components/Preview";
import { Modal } from "@/app/components/atoms/frame/Modal";
import { leaveTypeOptions, leaveTypeValues } from "@/lib/leave-types";
import { exportToExcel } from "@/lib/export-to-excel";
import type { HrLeaveRequest } from "@/types/hr-leave";
import { trpc } from "@/trpc/client";

const statusMeta: Record<
  HrLeaveRequest["status"] | "DRAFT" | "CANCELLED",
  { label: string; chipClass: string }
> = {
  PENDING: {
    label: "Pending",
    chipClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  },
  PROCESSING: {
    label: "Processing",
    chipClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200",
  },
  APPROVED: {
    label: "Approved",
    chipClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  },
  DENIED: {
    label: "Denied",
    chipClass: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
  },
  CANCELLED: {
    label: "Cancelled",
    chipClass: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-200",
  },
  DRAFT: {
    label: "Draft",
    chipClass: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-200",
  },
};

const statusFilters = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Denied", value: "DENIED" },
] as const;

const leaveTypeFilterOptions = ["ALL", ...leaveTypeValues] as const;

type StatusFilter = (typeof statusFilters)[number]["value"];
type LeaveTypeFilterValue = (typeof leaveTypeFilterOptions)[number];
type HrActionStatus = "APPROVED" | "DENIED";
type SortField = "submittedAt" | "startDate" | "leaveType" | "status";
type SortOrder = "asc" | "desc";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return dateFormatter.format(parsed);
};

const formatDays = (value: number) => `${value} day${value === 1 ? "" : "s"}`;

const formatStatus = (status: HrLeaveRequest["status"]) =>
  statusMeta[status]?.label ?? status;

const formatMonthInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const parseMonthInput = (
  value: string,
): { month?: number; year?: number; label: string } => {
  const [yearStr, monthStr] = value.split("-");
  const parsedYear = Number(yearStr);
  const parsedMonth = Number(monthStr);
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) {
    return { label: "All time" };
  }
  const label = monthFormatter.format(new Date(parsedYear, parsedMonth - 1, 1));
  return { month: parsedMonth, year: parsedYear, label };
};

const SortButton = ({
  field,
  activeField,
  order,
  onChange,
  children,
}: {
  field: SortField;
  activeField: SortField;
  order: SortOrder;
  onChange: (field: SortField) => void;
  children: React.ReactNode;
}) => {
  const isActive = activeField === field;
  return (
    <button
      type="button"
      onClick={() => onChange(field)}
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
    >
      {children}
      {isActive ? (
        order === "asc" ? (
          <BiChevronUp className="text-base" />
        ) : (
          <BiChevronDown className="text-base" />
        )
      ) : (
        <span className="text-slate-400">•</span>
      )}
    </button>
  );
};

export default function HrAdminLeaveManagementPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [leaveTypeFilter, setLeaveTypeFilter] =
    useState<LeaveTypeFilterValue>("ALL");
  const [selectedMonth, setSelectedMonth] = useState(() => formatMonthInput(new Date()));
  const [{ month, year, label: monthLabel }, setMonthMeta] = useState(() =>
    parseMonthInput(formatMonthInput(new Date())),
  );
  const [sortField, setSortField] = useState<SortField>("submittedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState<string | undefined>(undefined);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchValue(trimmed.length > 0 ? trimmed : undefined);
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setMonthMeta(parseMonthInput(selectedMonth));
  }, [selectedMonth]);

  useEffect(() => {
    if (previewOpen && selectedRequestId === null) {
      setPreviewOpen(false);
    }
  }, [previewOpen, selectedRequestId]);

  const toggleSort = (field: SortField) => {
    setSortField((currentField) => {
      if (currentField === field) {
        setSortOrder((currentOrder) => (currentOrder === "asc" ? "desc" : "asc"));
        return currentField;
      }
      setSortOrder(field === "submittedAt" ? "desc" : "asc");
      return field;
    });
  };

  const listInput = useMemo(
    () => ({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      leaveType: leaveTypeFilter === "ALL" ? undefined : leaveTypeFilter,
      search: searchValue,
      month,
      year,
      sortField,
      sortOrder,
      limit: 200,
    }),
    [statusFilter, leaveTypeFilter, searchValue, month, year, sortField, sortOrder],
  );

  const utils = trpc.useUtils();
  const listQuery = trpc.hrLeave.list.useQuery(listInput);
  const requests = listQuery.data?.requests ?? [];

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  useEffect(() => {
    if (previewOpen && !selectedRequest) {
      setPreviewOpen(false);
    }
  }, [previewOpen, selectedRequest]);

  const updateStatus = trpc.hrLeave.updateStatus.useMutation({
    onMutate: ({ requestId }) => {
      setUpdatingRequestId(requestId);
      setActionMessage(null);
    },
    onSuccess: async (updated) => {
      setActionMessage({
        type: "success",
        text: `Updated ${updated.employee.name}'s request to ${formatStatus(
          updated.status,
        )}.`,
      });
      await listQuery.refetch();
      await utils.hrLeave.pendingCount.invalidate();
    },
    onError: (error) => {
      setActionMessage({
        type: "error",
        text: error.message,
      });
    },
    onSettled: () => {
      setUpdatingRequestId(null);
    },
  });

  const handleStatusChange = (requestId: string, status: HrActionStatus) => {
    updateStatus.mutate({ requestId, status });
  };

  const handleViewApplication = (requestId: string) => {
    setSelectedRequestId(requestId);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setSelectedRequestId(null);
    setPreviewOpen(false);
  };

  const handleExport = () => {
    if (!requests.length) return;

    const title =
      monthLabel && monthLabel !== "All time"
        ? `Leave requests for ${monthLabel}`
        : "Leave requests overview";

    exportToExcel(
      requests.map((request, index) => ({
        sl: index + 1,
        submittedOn: formatDate(request.submittedAt),
        employee: request.employee.name,
        employeeId: request.employee.employeeCode ?? "—",
        department: request.employee.department ?? "—",
        leaveType: request.leaveTypeLabel,
        from: formatDate(request.startDate),
        to: formatDate(request.endDate),
        days: formatDays(request.totalDays),
        status: formatStatus(request.status),
        remainingQuota: `${request.remainingBalance.remaining} / ${request.remainingBalance.label}`,
        reason: request.reason ?? "—",
      })),
      {
        fileName: `leave-requests-${selectedMonth || "all"}`,
        sheetName: "Leave Requests",
        title,
        autoFilter: true,
        columns: [
          { key: "sl", label: "SL", width: 6 },
          { key: "submittedOn", label: "Submitted On", width: 16 },
          { key: "employee", label: "Employee", width: 24 },
          { key: "employeeId", label: "Employee ID", width: 18 },
          { key: "department", label: "Department", width: 18 },
          { key: "leaveType", label: "Leave Type", width: 18 },
          { key: "from", label: "From", width: 14 },
          { key: "to", label: "To", width: 14 },
          { key: "days", label: "Days", width: 12 },
          { key: "status", label: "Status", width: 14 },
          { key: "remainingQuota", label: "Remaining Quota", width: 22 },
          { key: "reason", label: "Reason", width: 32 },
        ],
      },
    );
  };

  const previewData = selectedRequest
    ? {
        name: selectedRequest.employee.name,
        email: selectedRequest.employee.email,
        phone: selectedRequest.employee.phone ?? "—",
        employeeId: selectedRequest.employee.employeeCode ?? "—",
        department: selectedRequest.employee.department ?? "—",
        designation: selectedRequest.employee.designation ?? "—",
        leaveType: selectedRequest.leaveTypeLabel,
        reason: selectedRequest.reason ?? "—",
        note: selectedRequest.note ?? undefined,
        from: formatDate(selectedRequest.startDate),
        to: formatDate(selectedRequest.endDate),
        date: formatDate(selectedRequest.submittedAt),
        organization: selectedRequest.employee.organization ?? "—",
      }
    : null;

  const isExportDisabled = requests.length === 0;

  return (
    <div className="space-y-8">
      <header className="rounded-[32px] border border-white/60 bg-white/90 p-8 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
              HR admin • Leave management
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
              Monthly leave applications
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Filter, review, and act on every request—then export to share with leadership.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExportDisabled}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <BiDownload className="text-lg" />
            Export to Excel
          </button>
        </div>
        {actionMessage && (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
              actionMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
            }`}
          >
            {actionMessage.text}
          </div>
        )}
        {listQuery.error && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
            {listQuery.error.message}
          </div>
        )}
      </header>

      <section className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-lg shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 min-w-[220px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900/80">
            <FiSearch className="text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, email, or employee ID"
              className="w-full bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex flex-1 flex-col text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Month
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="mt-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-1 flex-col text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Leave type
              <select
                value={leaveTypeFilter}
                onChange={(event) =>
                  setLeaveTypeFilter(event.target.value as LeaveTypeFilterValue)
                }
                className="mt-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {leaveTypeFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL"
                      ? "All types"
                      : leaveTypeOptions.find((entry) => entry.value === option)?.label ??
                        option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                statusFilter === filter.value
                  ? "bg-slate-900 text-white shadow dark:bg-sky-500"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
            <p>
              Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{requests.length}</span>{" "}
              request{requests.length === 1 ? "" : "s"} for {monthLabel}.
            </p>
            {listQuery.isFetching && (
              <p className="text-xs text-slate-400 dark:text-slate-500">Refreshing…</p>
            )}
          </div>
          <div className="mt-3 overflow-x-auto rounded-3xl border border-slate-100 dark:border-slate-800/60">
            <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800/60">
              <thead className="bg-slate-50/80 text-left text-slate-500 dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                    Leave Type
                  </th>
                  <th className="px-4 py-3">
                    <SortButton
                      field="startDate"
                      activeField={sortField}
                      order={sortOrder}
                      onChange={toggleSort}
                    >
                      From
                    </SortButton>
                  </th>
                  <th className="px-4 py-3">
                    <SortButton
                      field="submittedAt"
                      activeField={sortField}
                      order={sortOrder}
                      onChange={toggleSort}
                    >
                      Submitted
                    </SortButton>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                    Days
                  </th>
                  <th className="px-4 py-3">
                    <SortButton
                      field="status"
                      activeField={sortField}
                      order={sortOrder}
                      onChange={toggleSort}
                    >
                      Status
                    </SortButton>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800/60 dark:bg-slate-900/40">
                {listQuery.isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                      Loading leave requests…
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                      No leave applications match these filters.
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => {
                    const status = statusMeta[request.status] ?? statusMeta.PENDING;
                    const isUpdating = updatingRequestId === request.id || updateStatus.isPending;
                    const isFinalized =
                      request.status === "APPROVED" || request.status === "DENIED";
                    return (
                      <tr key={request.id} className="text-slate-700 dark:text-slate-200">
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold">{request.employee.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {request.employee.department ?? "—"} ·{" "}
                            {request.employee.employeeCode ?? "No ID"}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold">{request.leaveTypeLabel}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-sm">
                          <p>{formatDate(request.startDate)}</p>
                          <p className="text-xs text-slate-500">
                            to {formatDate(request.endDate)}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top text-sm">
                          <p>{formatDate(request.submittedAt)}</p>
                          <p className="text-xs text-slate-500">at {new Date(request.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-sm font-semibold">
                          {formatDays(request.totalDays)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status.chipClass}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-nowrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewApplication(request.id)}
                              title="View application"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
                            >
                              <FiEye className="text-lg" />
                              <span className="sr-only">View application</span>
                            </button>
                            {!isFinalized && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(request.id, "APPROVED")}
                                  disabled={isUpdating}
                                  title="Approve request"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                                >
                                  <FiCheck className="text-lg" />
                                  <span className="sr-only">Approve request</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(request.id, "DENIED")}
                                  disabled={isUpdating}
                                  title="Reject request"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                                >
                                  <FiX className="text-lg" />
                                  <span className="sr-only">Reject request</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Modal
        title="Leave application preview"
        open={previewOpen && Boolean(selectedRequest)}
        setOpen={(next) => {
          if (!next) {
            closePreview();
          } else {
            setPreviewOpen(true);
          }
        }}
        titleTextSize="text-lg"
        doneButtonText="Close"
        isDoneButton={false}
        isCancelButton={false}
        className="max-w-4xl"
      >
        {selectedRequest && previewData ? (
          <div className="space-y-4">
            <ApplicationPreview
              userData={previewData}
              attachments={selectedRequest.attachments.map((attachment) => ({
                id: attachment.id,
                name: attachment.name,
                downloadUrl: attachment.downloadUrl ?? attachment.dataUrl ?? undefined,
              }))}
            />
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600 dark:border-slate-800/70 dark:bg-slate-900/70 dark:text-slate-300">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Remaining quota
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {selectedRequest.remainingBalance.remaining} day
                {selectedRequest.remainingBalance.remaining === 1 ? "" : "s"} of{" "}
                {selectedRequest.remainingBalance.label}
              </p>
            </div>
            {selectedRequest.attachments.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Attachments</p>
                <ul className="mt-2 space-y-2">
                  {selectedRequest.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={attachment.downloadUrl ?? attachment.dataUrl ?? "#"}
                        download={attachment.name}
                        className="text-sm font-semibold text-primary_dark hover:underline dark:text-sky-400"
                      >
                        {attachment.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a request to view its application.
          </p>
        )}
      </Modal>
    </div>
  );
}
