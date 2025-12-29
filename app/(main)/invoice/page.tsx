"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { IoEye } from "react-icons/io5";

import Table from "../../components/atoms/tables/Table";
import { Modal } from "../../components/atoms/frame/Modal";
import PasswordInput from "../../components/atoms/inputs/PasswordInput";
import { EmployeeHeader } from "../../components/layouts/EmployeeHeader";
import Pagination from "../../components/pagination/Pagination";
import LoadingSpinner from "../../components/LoadingSpinner";
import Button from "../../components/atoms/buttons/Button";

import { trpc } from "@/trpc/client";
import { invoiceStatusMeta } from "@/types/invoice";

const headers = ["Invoice", "Due Date", "Amount", "Status", "Action"];

const statusTextColors = [
  { text: invoiceStatusMeta.DRAFT.label, color: "#475569" },
  { text: invoiceStatusMeta.PENDING_REVIEW.label, color: "#b45309" },
  { text: invoiceStatusMeta.READY_TO_DELIVER.label, color: "#047857" },
];

const dynamicColorValues = [{ columnName: "Status", textColors: statusTextColors }];

const tokenKey = (invoiceId: string) => `ndi.invoice.token:${invoiceId}`;

const formatDate = (value: string | null) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch (error) {
    void error;
    return value;
  }
};

type TableRow = Record<string, string | number | ReactNode>;

function InvoicePage() {
  const router = useRouter();
  const [currentInvoices, setCurrentInvoices] = useState<typeof invoices>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [selection, setSelection] = useState<{ id: string; title: string } | null>(null);

  const invoiceQuery = trpc.invoice.list.useQuery(undefined, {
    staleTime: 30_000,
  });

  const invoices = invoiceQuery.data?.invoices ?? [];

  const buildRowsForPage = (pageData: typeof invoices) =>
    pageData.map((invoice) => ({
      Invoice: (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 dark:text-white">{invoice.title}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{invoice.periodLabel}</span>
        </div>
      ),
      "Due Date": formatDate(invoice.dueDate),
      Amount: invoice.totalFormatted,
      Status: invoice.statusLabel,
      Action: (
        <button
          type="button"
          className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 p-2 text-white shadow-sm shadow-indigo-500/40 transition hover:scale-105"
          onClick={(event) => {
            event.stopPropagation();
            setSelection({ id: invoice.id, title: invoice.title });
            setPassword("");
            setIsModalOpen(true);
          }}
          aria-label="View invoice"
        >
          <IoEye />
        </button>
      ),
    }));

  const unlockMutation = trpc.invoice.unlock.useMutation({
    onSuccess: ({ token }) => {
      if (!selection) return;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(tokenKey(selection.id), token);
      }
      setIsModalOpen(false);
      setPassword("");
      const encodedToken = encodeURIComponent(token);
      router.push(`/invoice/${selection.id}?token=${encodedToken}`);
    },
  });

  const tableRows = useMemo(() => buildRowsForPage(currentInvoices), [currentInvoices]);

  const handlePageDataChange = useCallback(
    (pageData: typeof invoices) => {
      setCurrentInvoices(pageData);
    },
    [],
  );

  const handlePasswordConfirm = () => {
    if (!selection) return;
    unlockMutation.mutate({ invoiceId: selection.id, password });
  };

  return (
    <div className="flex w-full flex-col gap-10">
      <EmployeeHeader />

      <div className="flex w-full flex-col gap-6 rounded-[32px] border border-white/60 bg-white/85 py-8 shadow-xl shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60">
        {invoiceQuery.isError ? (
          <div className="flex min-h-[8rem] flex-col items-center justify-center gap-3 px-6 text-center text-slate-500 dark:text-slate-300">
            <p>We couldn’t load your invoices right now.</p>
            <Button theme="secondary" onClick={() => invoiceQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : invoiceQuery.isLoading ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <LoadingSpinner label="Loading invoices..." helper="Fetching your invoice records"/>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 px-6 text-center text-slate-500 dark:text-slate-300">
            <p className="text-lg font-semibold">No invoices yet</p>
            <p className="text-sm">HR will publish invoices here once they send one your way.</p>
          </div>
        ) : (
          <Table
            headers={headers}
            rows={tableRows}
            dynamicColorValues={dynamicColorValues}
          />
        )}

        {invoices.length > 0 && (
          <Pagination
            data={invoices}
            postsPerPage={10}
            setCurrentPageData={handlePageDataChange}
          />
        )}
      </div>

      <Modal
        title={selection ? `Unlock ${selection.title}` : "Enter Password"}
        className="w-[min(90vw,480px)]"
        open={isModalOpen}
        setOpen={setIsModalOpen}
        isDoneButton={false}
        isCancelButton={false}
        doneButtonText=""
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Confirm your account password to open this invoice.
          </p>
          <PasswordInput
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {unlockMutation.error && (
            <p className="text-sm text-rose-500">{unlockMutation.error.message}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              className="flex-1"
              onClick={handlePasswordConfirm}
              disabled={!password || unlockMutation.isPending}
            >
              {unlockMutation.isPending ? "Unlocking..." : "Confirm"}
            </Button>
            <Button
              theme="secondary"
              className="flex-1"
              onClick={() => setIsModalOpen(false)}
              disabled={unlockMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default InvoicePage;
