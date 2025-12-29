"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import TextArea from "@/app/components/atoms/inputs/TextArea";
import SelectBox from "@/app/components/atoms/selectBox/SelectBox";
import CustomDatePicker from "@/app/components/atoms/inputs/DatePicker";
import { Modal } from "@/app/components/atoms/frame/Modal";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { InvoiceDetailCard } from "@/app/components/invoices/InvoiceDetailCard";

import { trpc } from "@/trpc/client";
import type { InvoiceDetail } from "@/types/invoice";
import { downloadInvoicePdf, renderInvoicePdfBlob } from "@/app/lib/downloadInvoicePdf";

type LineItemKind = "EARNING" | "DEDUCTION";

type LineItem = {
  id: string;
  kind: LineItemKind;
  description: string;
  quantity: number;
  unitPrice: number;
};

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  label: new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2020, index, 1)),
  value: String(index + 1),
}));

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, index) => ({
  label: String(currentYear + index),
  value: String(currentYear + index),
}));

const DEFAULT_CURRENCY = "BDT";
const LUNCH_DAILY_RATE = 400;
const payrollDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
});
const reviewDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatPayrollRange = (start: Date, end: Date) =>
  `${payrollDateFormatter.format(start)} – ${payrollDateFormatter.format(end)}`;

const getPayrollWindow = (periodMonth: number, periodYear: number) => {
  const now = new Date();
  const normalizedMonth = Number.isFinite(periodMonth) && periodMonth >= 1 ? periodMonth : now.getMonth() + 1;
  const normalizedYear = Number.isFinite(periodYear) ? periodYear : now.getFullYear();
  const zeroBasedMonth = normalizedMonth - 1;
  const end = new Date(normalizedYear, zeroBasedMonth, 15);
  const start = new Date(normalizedYear, zeroBasedMonth - 1, 16);
  return { start, end };
};

const countWorkingDays = (start: Date, end: Date) => {
  const cursor = new Date(start);
  let count = 0;
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(count, 1);
};

const buildPayrollLineItems = ({
  employee,
  periodMonth,
  periodYear,
}: {
  employee?: { grossSalary: number; incomeTax: number };
  periodMonth: number;
  periodYear: number;
}): LineItem[] => {
  const { start, end } = getPayrollWindow(periodMonth, periodYear);
  const windowLabel = formatPayrollRange(start, end);
  const workingDays = countWorkingDays(start, end);
  const grossSalary = employee?.grossSalary ?? 0;
  const incomeTax = employee?.incomeTax ?? 0;

  return [
    buildLineItem({
      description: `Gross Salary (${windowLabel})`,
      quantity: 1,
      unitPrice: grossSalary,
    }),
    buildLineItem({
      description: `Lunch & Conveyance Allowance (${windowLabel})`,
      quantity: workingDays,
      unitPrice: LUNCH_DAILY_RATE,
    }),
    buildLineItem({
      description: `Income Tax (${windowLabel})`,
      quantity: 1,
      unitPrice: incomeTax,
      kind: "DEDUCTION",
    }),
  ];
};

const lineItemTypeOptions = [
  { label: "Earning", value: "EARNING" },
  { label: "Deduction", value: "DEDUCTION" },
];

const statusBadgeClass: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300",
  PENDING_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200",
  CHANGES_REQUESTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
  READY_TO_DELIVER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
};

const createLineItemId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const buildLineItem = (overrides?: Partial<LineItem>): LineItem => ({
  id: createLineItemId(),
  kind: "EARNING",
  description: "",
  quantity: 1,
  unitPrice: 0,
  ...overrides,
});

const currencyFormatter = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch (error) {
    void error;
    return `${currency} ${value.toFixed(2)}`;
  }
};

function HrInvoiceManagementPage() {
  const utils = trpc.useUtils();
  const dashboardQuery = trpc.hrInvoices.dashboard.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const createMutation = trpc.hrInvoices.create.useMutation({
    onSuccess: () => {
      utils.hrInvoices.dashboard.invalidate();
      resetForm();
      setIsCreateModalOpen(false);
    },
  });
  const sendMutation = trpc.hrInvoices.send.useMutation({
    onSuccess: () => {
      utils.hrInvoices.dashboard.invalidate();
    },
  });
  const updateMutation = trpc.hrInvoices.update.useMutation({
    onSuccess: () => {
      utils.hrInvoices.dashboard.invalidate();
      resetForm();
      setEditingInvoiceId(null);
      setIsCreateModalOpen(false);
    },
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [isEditingLoading, setIsEditingLoading] = useState(false);
  const [editingError, setEditingError] = useState<string | null>(null);
  const invoiceDetailQuery = trpc.hrInvoices.detail.useQuery(
    { invoiceId: previewInvoiceId ?? "" },
    { enabled: Boolean(previewInvoiceId) },
  );
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const batchDownloadRef = useRef<HTMLDivElement | null>(null);
  const [batchInvoiceDetail, setBatchInvoiceDetail] = useState<InvoiceDetail | null>(null);

  const [form, setForm] = useState({
    employeeId: "",
    title: "Monthly Invoice",
    periodMonth: String(new Date().getMonth() + 1),
    periodYear: String(currentYear),
    currency: DEFAULT_CURRENCY,
    taxRate: "0",
    notes: "",
  });
  const [dueDate, setDueDate] = useState<Date | null>(new Date());
  const [lineItems, setLineItems] = useState<LineItem[]>([buildLineItem()]);
  const previewContentRef = useRef<HTMLDivElement | null>(null);
  const [hasManualLineItems, setHasManualLineItems] = useState(false);
  const [activeReviewContext, setActiveReviewContext] = useState<{
    comment: string;
    requestedAt: string | null;
  } | null>(null);

  const invoices = dashboardQuery.data?.invoices ?? [];
  const employeeOptions = dashboardQuery.data?.employeeOptions ?? [];
  const pendingReview = dashboardQuery.data?.pendingReview ?? 0;
  const selectedEmployee = useMemo(
    () => employeeOptions.find((employee) => employee.id === form.employeeId),
    [employeeOptions, form.employeeId],
  );
  const reviewRequestedLabel = useMemo(() => {
    if (!activeReviewContext?.requestedAt) {
      return null;
    }
    try {
      return reviewDateTimeFormatter.format(new Date(activeReviewContext.requestedAt));
    } catch (error) {
      void error;
      return null;
    }
  }, [activeReviewContext?.requestedAt]);
  const filterYearOptions = useMemo(() => {
    const yearSet = new Set(invoices.map((invoice) => invoice.periodYear));
    const parsedFilterYear = Number(filterYear);
    if (!Number.isNaN(parsedFilterYear)) {
      yearSet.add(parsedFilterYear);
    }
    if (!yearSet.size) {
      yearSet.add(currentYear);
    }
    return Array.from(yearSet)
      .sort((a, b) => a - b)
      .map((year) => ({
        label: String(year),
        value: String(year),
      }));
  }, [filterYear, invoices]);
  const filteredInvoices = useMemo(() => {
    const monthNumber = Number(filterMonth);
    const yearNumber = Number(filterYear);
    if (Number.isNaN(monthNumber) || Number.isNaN(yearNumber)) {
      return [];
    }
    return invoices.filter((invoice) => invoice.periodMonth === monthNumber && invoice.periodYear === yearNumber);
  }, [filterMonth, filterYear, invoices]);
  const readyToDeliverInvoices = useMemo(
    () => filteredInvoices.filter((invoice) => invoice.status === "READY_TO_DELIVER"),
    [filteredInvoices],
  );
  const readyToDeliverCount = readyToDeliverInvoices.length;
  const selectedPeriodLabel = useMemo(() => {
    const monthLabel = monthOptions.find((option) => option.value === filterMonth)?.label ?? "Selected";
    return `${monthLabel} ${filterYear}`;
  }, [filterMonth, filterYear]);

  const totals = useMemo(() => {
    const earnings = lineItems.reduce((sum, item) => {
      const amount = item.quantity * item.unitPrice;
      return item.kind === "DEDUCTION" ? sum : sum + amount;
    }, 0);
    const deductions = lineItems.reduce((sum, item) => {
      const amount = item.quantity * item.unitPrice;
      return item.kind === "DEDUCTION" ? sum + amount : sum;
    }, 0);
    const subtotal = earnings - deductions;
    const taxRateNumber = Number(form.taxRate ?? 0);
    const tax = subtotal * (taxRateNumber / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total, earnings, deductions };
  }, [lineItems, form.taxRate]);
  const waitForRenderCycle = useCallback(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
    [],
  );

  function resetForm() {
    setForm({
      employeeId: "",
      title: "Monthly Invoice",
      periodMonth: String(new Date().getMonth() + 1),
      periodYear: String(currentYear),
      currency: DEFAULT_CURRENCY,
      taxRate: "0",
      notes: "",
    });
    setDueDate(new Date());
    setLineItems([buildLineItem()]);
    setHasManualLineItems(false);
    setEditingInvoiceId(null);
    setEditingError(null);
    setIsEditingLoading(false);
    setActiveReviewContext(null);
  }

  const handleCloseFormModal = () => {
    setIsCreateModalOpen(false);
    resetForm();
  };

  const updateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    setHasManualLineItems(true);
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, buildLineItem()]);
    setHasManualLineItems(true);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      setHasManualLineItems(true);
      return prev.filter((item) => item.id !== id);
    });
  };

  const applyPayrollDefaults = (employeeIdValue: string, monthValue: string, yearValue: string) => {
    const employee = employeeOptions.find((option) => option.id === employeeIdValue);
    const periodMonthNumber = Number(monthValue);
    const periodYearNumber = Number(yearValue);
    if (!employee || Number.isNaN(periodMonthNumber) || Number.isNaN(periodYearNumber)) {
      setLineItems([buildLineItem()]);
      return;
    }
    setLineItems(buildPayrollLineItems({ employee, periodMonth: periodMonthNumber, periodYear: periodYearNumber }));
  };

  const handleResetLineItems = () => {
    if (!selectedEmployee) {
      return;
    }
    const periodMonthNumber = Number(form.periodMonth);
    const periodYearNumber = Number(form.periodYear);
    if (Number.isNaN(periodMonthNumber) || Number.isNaN(periodYearNumber)) {
      return;
    }
    setHasManualLineItems(false);
    applyPayrollDefaults(selectedEmployee.id, form.periodMonth, form.periodYear);
  };

  const hydrateFormFromInvoice = useCallback((invoice: InvoiceDetail) => {
    const calculatedTaxRate =
      invoice.subtotal > 0 ? ((invoice.tax / invoice.subtotal) * 100).toFixed(2) : "0";
    setForm({
      employeeId: invoice.employee.id,
      title: invoice.title,
      periodMonth: String(invoice.periodMonth),
      periodYear: String(invoice.periodYear),
      currency: invoice.currency,
      taxRate: calculatedTaxRate,
      notes: invoice.notes ?? "",
    });
    setDueDate(invoice.dueDate ? new Date(invoice.dueDate) : null);
    setLineItems(
      invoice.items.map((item) =>
        buildLineItem({
          kind: item.unitPrice < 0 ? "DEDUCTION" : "EARNING",
          description: item.description,
          quantity: item.quantity,
          unitPrice: Math.abs(item.unitPrice),
        }),
      ),
    );
    setHasManualLineItems(true);
    setActiveReviewContext(
      invoice.reviewRequest.comment
        ? {
            comment: invoice.reviewRequest.comment,
            requestedAt: invoice.reviewRequest.requestedAt,
          }
        : null,
    );
  }, []);

  const handleEditInvoice = useCallback(
    async (invoiceId: string) => {
      try {
        setEditingError(null);
        setIsEditingLoading(true);
        const data = await utils.hrInvoices.detail.fetch({ invoiceId });
        hydrateFormFromInvoice(data.invoice);
        setEditingInvoiceId(invoiceId);
        setIsCreateModalOpen(true);
      } catch (error) {
        setEditingError(error instanceof Error ? error.message : "Failed to load invoice.");
      } finally {
        setIsEditingLoading(false);
      }
    },
    [hydrateFormFromInvoice, utils],
  );

  const handleDownloadPreview = async () => {
    if (!previewContentRef.current || !invoiceDetailQuery.data?.invoice) {
      return;
    }
    await downloadInvoicePdf(previewContentRef.current, invoiceDetailQuery.data.invoice.title);
  };

  const handleDownloadReadyInvoices = useCallback(async () => {
    setDownloadError(null);
    const monthNumber = Number(filterMonth);
    const yearNumber = Number(filterYear);
    if (Number.isNaN(monthNumber) || Number.isNaN(yearNumber)) {
      setDownloadError("Select a valid month and year.");
      return;
    }
    if (!readyToDeliverInvoices.length) {
      setDownloadError("No ready-to-deliver invoices for this period.");
      return;
    }
    setIsBatchDownloading(true);
    try {
      const jszipModule = await import("jszip");
      const zip = new jszipModule.default();
      for (const invoice of readyToDeliverInvoices) {
        const detail = await utils.hrInvoices.detail.fetch({ invoiceId: invoice.id });
        setBatchInvoiceDetail(detail.invoice);
        await waitForRenderCycle();
        if (!batchDownloadRef.current) {
          throw new Error("Unable to prepare invoice layout.");
        }
        const filenameSeed = `${detail.invoice.title}-${detail.invoice.employee.employeeCode ?? detail.invoice.employee.name}-${detail.invoice.id.slice(0, 6)}`;
        const { blob, filename } = await renderInvoicePdfBlob(batchDownloadRef.current, filenameSeed);
        zip.file(`${filename}.pdf`, blob);
      }
      const formattedMonth = String(monthNumber).padStart(2, "0");
      const archiveName = `ready-invoices-${yearNumber}-${formattedMonth}`;
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${archiveName}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Failed to download invoices.");
    } finally {
      setIsBatchDownloading(false);
      setBatchInvoiceDetail(null);
    }
  }, [filterMonth, filterYear, readyToDeliverInvoices, utils, waitForRenderCycle]);

  const handleSaveInvoice = () => {
    const payloadItems = lineItems.map((item) => {
      const quantity = Math.max(1, Math.floor(item.quantity));
      const normalizedUnitPrice = Math.max(0, item.unitPrice);
      const unitPrice = item.kind === "DEDUCTION" ? -normalizedUnitPrice : normalizedUnitPrice;
      return {
        description: item.description,
        quantity,
        unitPrice,
      };
    });
    const payload = {
      employeeId: form.employeeId,
      title: form.title,
      periodMonth: Number(form.periodMonth),
      periodYear: Number(form.periodYear),
      currency: form.currency,
      dueDate: dueDate ? dueDate.toISOString() : null,
      taxRate: Number(form.taxRate ?? 0),
      notes: form.notes || null,
      items: payloadItems,
    };
    if (editingInvoiceId) {
      updateMutation.mutate({
        invoiceId: editingInvoiceId,
        ...payload,
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isCreateDisabled =
    !form.employeeId ||
    !form.title.trim() ||
    lineItems.some((item) => !item.description.trim() || item.unitPrice <= 0);
  const isSaving = editingInvoiceId ? updateMutation.isPending : createMutation.isPending;
  const disableSubmit = isCreateDisabled || isSaving;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
            Invoice Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Invoice Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Draft, send, and review employee invoices with clear status tracking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            {pendingReview} pending review
          </div>
          <Button
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
          >
            New invoice
          </Button>
        </div>
      </header>

      <section className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60">
        {dashboardQuery.isLoading ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <LoadingSpinner label="Loading invoices..."/>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 text-center text-slate-500 dark:text-slate-300">
            <p className="text-lg font-semibold">No invoices created yet</p>
            <p className="text-sm">Start by creating your first invoice for the team.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="grid gap-4 sm:grid-cols-2 md:flex md:flex-wrap md:items-end">
                <SelectBox
                  label="Filter month"
                  value={filterMonth}
                  includePlaceholder={false}
                  options={monthOptions}
                  onChange={(event) => {
                    setFilterMonth(event.target.value);
                    setDownloadError(null);
                  }}
                />
                <SelectBox
                  label="Filter year"
                  value={filterYear}
                  includePlaceholder={false}
                  options={filterYearOptions}
                  onChange={(event) => {
                    setFilterYear(event.target.value);
                    setDownloadError(null);
                  }}
                />
              </div>
              <div className="flex flex-col gap-2 md:w-64">
                <Button
                  theme="secondary"
                  onClick={() => void handleDownloadReadyInvoices()}
                  disabled={isBatchDownloading || readyToDeliverCount === 0}
                >
                  {isBatchDownloading
                    ? "Preparing zip..."
                    : readyToDeliverCount > 0
                      ? `Download ${readyToDeliverCount} ready invoice${readyToDeliverCount > 1 ? "s" : ""}`
                      : "Download ready invoices"}
                </Button>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {readyToDeliverCount > 0
                    ? `${readyToDeliverCount} ready to deliver for ${selectedPeriodLabel}.`
                    : `No ready-to-deliver invoices for ${selectedPeriodLabel}.`}
                </p>
                {downloadError && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">{downloadError}</p>
                )}
              </div>
            </div>
            {filteredInvoices.length === 0 ? (
              <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                <p className="font-semibold">No invoices for {selectedPeriodLabel}</p>
                <p className="text-sm">Try a different month or year.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <div className="grid grid-cols-6 gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  <span>Invoice</span>
                  <span>Employee</span>
                  <span>Period</span>
                  <span>Due</span>
                  <span>Total</span>
                  <span>Status</span>
                </div>
                {filteredInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="grid grid-cols-6 items-center gap-4 px-4 py-4 text-sm text-slate-700 transition-colors duration-200 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    <div className="truncate font-semibold text-slate-900 dark:text-white">{invoice.title}</div>
                    <div className="truncate text-slate-500 dark:text-slate-400">{invoice.employeeName}</div>
                    <div>{invoice.periodLabel}</div>
                    <div>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Not set"}</div>
                    <div className="font-semibold text-blue-600 dark:text-sky-400">{invoice.totalFormatted}</div>
                    <div className="flex flex-col gap-2">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass[invoice.status] ?? "bg-slate-100"}`}
                      >
                        {invoice.statusLabel}
                      </span>
                      {invoice.reviewComment && (
                        <p className="text-xs text-rose-600 dark:text-rose-300">
                          “{invoice.reviewComment}”
                          {invoice.reviewRequestedAt
                            ? ` · ${reviewDateTimeFormatter.format(new Date(invoice.reviewRequestedAt))}`
                            : ""}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          theme="secondary"
                          className="text-xs"
                          onClick={() => setPreviewInvoiceId(invoice.id)}
                        >
                          Preview
                        </Button>
                        {invoice.status === "CHANGES_REQUESTED" && (
                          <Button
                            theme="secondary"
                            className="text-xs"
                            onClick={() => void handleEditInvoice(invoice.id)}
                            disabled={isEditingLoading}
                          >
                            Edit
                          </Button>
                        )}
                        {invoice.canSend && (
                          <Button
                            className="text-xs"
                            disabled={sendMutation.isPending && sendMutation.variables?.invoiceId === invoice.id}
                            onClick={() => sendMutation.mutate({ invoiceId: invoice.id })}
                          >
                            {sendMutation.isPending && sendMutation.variables?.invoiceId === invoice.id
                              ? "Sending..."
                              : invoice.status === "CHANGES_REQUESTED"
                                ? "Resend"
                                : "Send"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <Modal
        title={editingInvoiceId ? "Edit invoice" : "Create invoice"}
        open={isCreateModalOpen}
        setOpen={(value) => {
          if (!value) {
            handleCloseFormModal();
          } else {
            setIsCreateModalOpen(true);
          }
        }}
        isDoneButton={false}
        isCancelButton={false}
        doneButtonText=""
        minWidthModal="300px"
        className="max-h-[80vh] overflow-y-auto"
      >
        <div className="space-y-6">
          {editingError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {editingError}
            </p>
          )}
          {isEditingLoading && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200">
              Loading invoice details...
            </div>
          )}
          {activeReviewContext && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
              <p className="font-semibold">Requested changes</p>
              <p className="mt-1 whitespace-pre-line">{activeReviewContext.comment}</p>
              {reviewRequestedLabel && (
                <p className="mt-1 text-xs opacity-80">Requested {reviewRequestedLabel}</p>
              )}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <SelectBox
              label="Employee"
              value={form.employeeId}
              options={employeeOptions.map((employee) => ({
                label: employee.employeeCode
                  ? `${employee.name} (${employee.employeeCode})`
                  : employee.name,
                value: employee.id,
              }))}
              isDisabled={Boolean(editingInvoiceId)}
              onChange={(event) => {
                const nextEmployeeId = event.target.value;
                setForm((prev) => ({ ...prev, employeeId: nextEmployeeId }));
                setHasManualLineItems(false);
                if (!nextEmployeeId) {
                  setLineItems([buildLineItem()]);
                  return;
                }
                applyPayrollDefaults(nextEmployeeId, form.periodMonth, form.periodYear);
              }}
            />
            <TextInput
              label="Invoice title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <SelectBox
              label="Month"
              value={form.periodMonth}
              options={monthOptions}
              onChange={(event) => {
                const nextMonth = event.target.value;
                setForm((prev) => ({ ...prev, periodMonth: nextMonth }));
                if (!hasManualLineItems && form.employeeId) {
                  applyPayrollDefaults(form.employeeId, nextMonth, form.periodYear);
                }
              }}
            />
            <SelectBox
              label="Year"
              value={form.periodYear}
              options={yearOptions}
              onChange={(event) => {
                const nextYear = event.target.value;
                setForm((prev) => ({ ...prev, periodYear: nextYear }));
                if (!hasManualLineItems && form.employeeId) {
                  applyPayrollDefaults(form.employeeId, form.periodMonth, nextYear);
                }
              }}
            />
            <CustomDatePicker
              label="Due date"
              value={dueDate}
              onChange={(date) => setDueDate(date)}
            />
          </div>
          <TextArea
            label="Notes"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
          <div className="rounded-2xl border border-white/60 bg-white/90 p-4 text-sm shadow-inner shadow-white/30 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/40">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900 dark:text-white">Line items</p>
                <div className="flex flex-wrap gap-2">
                  <Button theme="secondary" onClick={addLineItem}>
                    Add line
                  </Button>
                  <Button
                    theme="secondary"
                    disabled={!selectedEmployee}
                    onClick={handleResetLineItems}
                  >
                    Reset to payroll defaults
                  </Button>
                </div>
              </div>
              {lineItems.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-xl border border-slate-100/80 p-3 dark:border-slate-700/60 md:grid-cols-5">
                  <TextInput
                    label="Description"
                    value={item.description}
                    onChange={(event) => updateLineItem(item.id, { description: event.target.value })}
                    className="md:col-span-2"
                  />
                  <SelectBox
                    label="Type"
                    value={item.kind}
                    includePlaceholder={false}
                    options={lineItemTypeOptions}
                    onChange={(event) =>
                      updateLineItem(item.id, {
                        kind: event.target.value as LineItemKind,
                      })
                    }
                  />
                  <TextInput
                    label="Quantity"
                    type="number"
                    value={String(item.quantity)}
                    onChange={(event) =>
                      updateLineItem(item.id, {
                        quantity: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                  <div className="flex items-end gap-2">
                    <TextInput
                      label="Unit price (BDT)"
                      type="number"
                      value={String(item.unitPrice)}
                      onChange={(event) =>
                        updateLineItem(item.id, {
                          unitPrice: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                      className="flex-1"
                    />
                    <Button theme="cancel-secondary" onClick={() => removeLineItem(item.id)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <TextInput
              label="Currency"
              value={form.currency}
              readOnly
            />
            <TextInput
              label="Tax rate (%)"
              type="number"
              value={form.taxRate}
              onChange={(event) => setForm((prev) => ({ ...prev, taxRate: event.target.value }))}
            />
            <div className="rounded-xl border border-slate-100/70 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-200">
              Net payable preview: {currencyFormatter(totals.total, form.currency)}
            </div>
          </div>
          {createMutation.error && (
            <p className="text-sm text-rose-500">{createMutation.error.message}</p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button theme="secondary" onClick={handleCloseFormModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveInvoice} disabled={disableSubmit}>
              {isSaving ? (editingInvoiceId ? "Saving..." : "Creating...") : editingInvoiceId ? "Save changes" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="Invoice preview"
        open={Boolean(previewInvoiceId)}
        setOpen={(value) => {
          if (!value) {
            setPreviewInvoiceId(null);
          }
        }}
        isDoneButton={false}
        isCancelButton={false}
        doneButtonText=""
        minWidthModal=""
        className="max-h-[90vh] overflow-y-auto"
      >
        {invoiceDetailQuery.isLoading ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : invoiceDetailQuery.data ? (
          <>
            <div ref={previewContentRef}>
              <InvoiceDetailCard
                invoice={invoiceDetailQuery.data.invoice}
                footnote={
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                    Created by {invoiceDetailQuery.data.invoice.createdBy.name} · {invoiceDetailQuery.data.invoice.createdBy.email}
                  </p>
                }
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button theme="secondary" onClick={handleDownloadPreview}>
                Download PDF
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            {invoiceDetailQuery.error?.message ?? "Select an invoice to preview."}
          </p>
        )}
      </Modal>

      <div
        aria-hidden="true"
        style={{ position: "fixed", left: "-9999px", top: 0, width: "900px", pointerEvents: "none" }}
      >
        <div ref={batchDownloadRef}>{batchInvoiceDetail && <InvoiceDetailCard invoice={batchInvoiceDetail} />}</div>
      </div>
    </div>
  );
}

export default HrInvoiceManagementPage;
