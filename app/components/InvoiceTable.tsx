import type { InvoiceLineItem } from "@/types/invoice";

const cellBorder = "border-slate-200 dark:border-slate-700/70";

const formatCurrency = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    void error;
    return `${currency} ${value.toFixed(2)}`;
  }
};

type InvoiceTableProps = {
  items: InvoiceLineItem[];
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
};

export function InvoiceTable({ items, currency, subtotal, tax, total }: InvoiceTableProps) {
  const resolvedItems = items.length
    ? items
    : [{ id: "empty", description: "No line items added", quantity: 0, unitPrice: 0, amount: 0 }];

  return (
    <div className="grid w-full grid-cols-11 overflow-hidden rounded-[28px] border border-white/60 bg-white/85 shadow-inner shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/75 dark:shadow-slate-900/60">
      <div className={`col-span-5 flex flex-col gap-0 border-r ${cellBorder}`}>
        <p className={`w-full border-b ${cellBorder} py-2 text-center text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100`}>
          Description
        </p>
        {resolvedItems.map((item) => (
          <div
            key={item.id}
            className={`grid w-full grid-cols-4 border-b ${cellBorder} px-6 py-3 text-sm text-slate-700 dark:text-slate-300`}
          >
            <div className="col-span-4">
              <p className="font-medium text-slate-800 dark:text-slate-100">{item.description}</p>
              {item.quantity > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Qty {item.quantity}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={`col-span-2 flex flex-col gap-0 border-r ${cellBorder}`}>
        <p className={`w-full border-b ${cellBorder} py-2 text-center text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100`}>
          Unit price
        </p>
        {resolvedItems.map((item) => (
          <p
            key={item.id}
            className={`w-full border-b ${cellBorder} py-3 text-center text-sm font-semibold text-blue-600 dark:text-sky-400`}
          >
            {item.quantity > 0 ? formatCurrency(item.unitPrice, currency) : "—"}
          </p>
        ))}
      </div>

      <div className={`col-span-2 flex flex-col gap-0 border-r ${cellBorder}`}>
        <p className={`w-full border-b ${cellBorder} py-2 text-center text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100`}>
          Quantity
        </p>
        {resolvedItems.map((item) => (
          <p
            key={item.id}
            className={`w-full border-b ${cellBorder} py-3 text-center text-sm font-semibold text-blue-600 dark:text-sky-400`}
          >
            {item.quantity > 0 ? item.quantity : "—"}
          </p>
        ))}
      </div>

      <div className="col-span-2 flex flex-col gap-0">
        <p className={`w-full border-b ${cellBorder} py-2 text-center text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100`}>
          Amount
        </p>
        {resolvedItems.map((item) => (
          <p
            key={item.id}
            className={`w-full border-b ${cellBorder} py-3 text-center text-sm font-semibold text-blue-600 dark:text-sky-400`}
          >
            {item.quantity > 0 ? formatCurrency(item.amount, currency) : "—"}
          </p>
        ))}
      </div>

      <p
        className={`col-span-9 w-full border-b border-r ${cellBorder} px-6 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
      >
        Subtotal
      </p>
      <p className={`col-span-2 w-full border-b ${cellBorder} py-3 text-center text-sm font-semibold text-blue-600 dark:text-sky-400`}>
        {formatCurrency(subtotal, currency)}
      </p>

      <p
        className={`col-span-9 w-full border-b border-r ${cellBorder} px-6 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
      >
        Tax
      </p>
      <p className={`col-span-2 w-full border-b ${cellBorder} py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-300`}>
        {tax ? formatCurrency(tax, currency) : "—"}
      </p>

      <p
        className={`col-span-9 w-full border-b border-r ${cellBorder} px-6 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
      >
        Total
      </p>
      <p className={`col-span-2 w-full border-b ${cellBorder} py-3 text-center text-base font-semibold text-blue-600 dark:text-sky-400`}>
        {formatCurrency(total, currency)}
      </p>
    </div>
  );
}
