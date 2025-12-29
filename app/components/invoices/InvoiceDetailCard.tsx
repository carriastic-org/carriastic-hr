"use client";

import { useMemo, type ReactNode } from "react";

import type { InvoiceDetail } from "@/types/invoice";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const payrollDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

type Props = {
  invoice: InvoiceDetail;
  actionSlot?: ReactNode;
  footnote?: ReactNode;
};

const formatDate = (value: string | null) => {
  if (!value) return "Not set";
  try {
    return dateFormatter.format(new Date(value));
  } catch (error) {
    void error;
    return value;
  }
};

const formatDateTime = (value: string | null) => {
  if (!value) return "Not set";
  try {
    return dateTimeFormatter.format(new Date(value));
  } catch (error) {
    void error;
    return value;
  }
};

const getPayrollWindow = (month: number, year: number) => {
  const zeroBased = month - 1;
  const end = new Date(year, zeroBased, 15);
  const start = new Date(year, zeroBased - 1, 16);
  return { start, end };
};

const formatPayrollRange = (start: Date, end: Date) =>
  `${payrollDateFormatter.format(start)} – ${payrollDateFormatter.format(end)}`;

const createMoneyFormatter = (currency: string) => {
  if (currency === "BDT") {
    return (value: number) =>
      `৳${Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
  }
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  return (value: number) => formatter.format(Math.abs(value));
};

export function InvoiceDetailCard({ invoice, actionSlot, footnote }: Props) {
  const dueLabel = formatDate(invoice.dueDate);
  const sentLabel = formatDate(invoice.timestamps.sentAt);
  const confirmedLabel = formatDate(invoice.timestamps.confirmedAt);
  const issuedLabel = formatDate(invoice.timestamps.createdAt);
  const { start: payrollStart, end: payrollEnd } = useMemo(
    () => getPayrollWindow(invoice.periodMonth, invoice.periodYear),
    [invoice.periodMonth, invoice.periodYear],
  );
  const payrollWindowLabel = formatPayrollRange(payrollStart, payrollEnd);
  const formatMoney = useMemo(() => createMoneyFormatter(invoice.currency), [invoice.currency]);
  const earningItems = invoice.items.filter((item) => item.amount >= 0);
  const deductionItems = invoice.items.filter((item) => item.amount < 0);
  const earningTotal = earningItems.reduce((sum, item) => sum + item.amount, 0);
  const deductionTotal = deductionItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const netPayable = invoice.total;
  const hasDeductions = deductionItems.length > 0;

  return (
    <div className="flex w-full flex-col gap-6 rounded-[32px] border border-white/60 bg-white/85 py-8 shadow-2xl shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60">
      <div className="flex flex-col gap-4 px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">{invoice.title}</p>
          <p className="text-sm text-slate-500 dark:text-slate-300">{invoice.periodLabel}</p>
          <span className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {invoice.statusLabel}
          </span>
          {invoice.reviewRequest.comment && (
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
              Change requested
            </p>
          )}
        </div>
        {actionSlot}
      </div>

      <div className="px-8">
        <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-inner shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/40">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Project</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">{invoice.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{invoice.periodLabel}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                Total (incl. tax)
              </p>
              <p className="text-2xl font-semibold text-blue-600 dark:text-sky-400">
                {invoice.totalFormatted}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Payment due {dueLabel} · Issued {issuedLabel}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                Payroll window
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{payrollWindowLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-100/70 bg-white/90 p-4 shadow-inner shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/60 dark:shadow-slate-900/30">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Address</p>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {invoice.employee.address ?? "Not provided"}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Tel</p>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {invoice.employee.phone ?? "Not provided"}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Name</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {invoice.employee.name}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                Employee ID
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {invoice.employee.employeeCode ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-inner shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/40">
          <div className="bg-slate-50 px-6 py-4 text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
            Consignment fee
          </div>
          <div className="grid grid-cols-12 border-b border-slate-100/70 bg-white/70 px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.3em] text-slate-400 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-500">
            <p className="col-span-6">Description</p>
            <p className="col-span-2 text-center">Unit price</p>
            <p className="col-span-2 text-center">Quantity</p>
            <p className="col-span-2 text-right">Amount</p>
          </div>
          {earningItems.length ? (
            earningItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 border-b border-slate-100/70 px-6 py-4 text-sm text-slate-700 dark:border-slate-800/60 dark:text-slate-200"
              >
                <div className="col-span-6 pr-4">
                  <p className="font-semibold text-slate-900 dark:text-white">{item.description}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{payrollWindowLabel}</p>
                </div>
                <p className="col-span-2 text-center font-semibold">{formatMoney(item.unitPrice)}</p>
                <p className="col-span-2 text-center font-semibold">{item.quantity}</p>
                <p className="col-span-2 text-right font-semibold text-slate-900 dark:text-white">
                  {formatMoney(item.amount)}
                </p>
              </div>
            ))
          ) : (
            <p className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
              No earnings were added to this invoice.
            </p>
          )}
          <div className="grid grid-cols-12 bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-900 dark:bg-slate-800/60 dark:text-white">
            <p className="col-span-10">Subtotal payment</p>
            <p className="col-span-2 text-right">{formatMoney(earningTotal)}</p>
          </div>
          <div className="border-t border-slate-100/70 bg-slate-100 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-300">
            Deduction
          </div>
          {hasDeductions ? (
            deductionItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 border-b border-slate-100/70 px-6 py-4 text-sm text-slate-700 dark:border-slate-800/60 dark:text-slate-200"
              >
                <div className="col-span-6 pr-4">
                  <p className="font-semibold text-slate-900 dark:text-white">{item.description}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{payrollWindowLabel}</p>
                </div>
                <p className="col-span-2 text-center font-semibold">{formatMoney(item.unitPrice)}</p>
                <p className="col-span-2 text-center font-semibold">{item.quantity}</p>
                <p className="col-span-2 text-right font-semibold text-slate-900 dark:text-white">
                  {formatMoney(Math.abs(item.amount))}
                </p>
              </div>
            ))
          ) : (
            <p className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">No deductions recorded.</p>
          )}
          <div className="grid grid-cols-12 bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-900 dark:bg-slate-800/60 dark:text-white">
            <p className="col-span-10">Subtotal deduction</p>
            <p className="col-span-2 text-right">{formatMoney(deductionTotal)}</p>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <div className="rounded-3xl border border-white/60 bg-gradient-to-r from-sky-50 to-blue-100 p-6 shadow-inner shadow-blue-200/50 transition-colors duration-200 dark:border-slate-700/70 dark:from-slate-900/60 dark:to-slate-900/40 dark:shadow-slate-900/30">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Net payable
                </p>
                <p className="text-3xl font-bold text-blue-600 dark:text-sky-400">
                  {formatMoney(netPayable)}
                </p>
                {invoice.tax > 0 && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Includes tax {invoice.taxFormatted}
                  </p>
                )}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300 md:max-w-md">
                <p>Thank you for your business.</p>
                <p className="mt-1">
                  If you have any questions about this invoice, please contact{" "}
                  <span className="font-semibold text-blue-700 dark:text-sky-300">
                    {invoice.createdBy.email}
                  </span>
                  .
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-white/60 bg-white/80 p-4 text-sm text-slate-700 shadow-inner shadow-white/30 dark:border-slate-800/60 dark:bg-slate-900/50 dark:text-slate-200">
              {invoice.bankAccount ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                    Transfer Account (please pay the transfer fee at your company)
                  </p>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Beneficiary bank</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {invoice.bankAccount.bankName}
                        {invoice.bankAccount.branch ? ` · ${invoice.bankAccount.branch}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Account name</dt>
                      <dd>{invoice.bankAccount.accountHolder}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Account number</dt>
                      <dd>{invoice.bankAccount.accountNumber}</dd>
                    </div>
                    {invoice.bankAccount.swiftCode && (
                      <div>
                        <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">SWIFT</dt>
                        <dd>{invoice.bankAccount.swiftCode}</dd>
                      </div>
                    )}
                  </dl>
                </>
              ) : (
                <p>No payout account on file for this employee.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-inner shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-slate-900/40">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Notes & Timeline</p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {invoice.notes || "No additional notes were provided."}
            </p>
            <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-200">Sent:</span> {sentLabel}
              </p>
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-200">Confirmed:</span> {confirmedLabel}
              </p>
            </div>
            {invoice.reviewRequest.comment && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
                <p className="font-semibold">Feedback</p>
                <p className="mt-1 whitespace-pre-line">{invoice.reviewRequest.comment}</p>
                <p className="mt-2 text-xs opacity-80">
                  {invoice.reviewRequest.requestedBy ? `By ${invoice.reviewRequest.requestedBy.name}` : "Requested changes"}
                  {invoice.reviewRequest.requestedAt ? ` · ${formatDateTime(invoice.reviewRequest.requestedAt)}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>

        {footnote}
      </div>
    </div>
  );
}
