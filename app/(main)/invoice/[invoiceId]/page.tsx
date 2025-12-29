"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

import Button from "@/app/components/atoms/buttons/Button";
import PasswordInput from "@/app/components/atoms/inputs/PasswordInput";
import TextArea from "@/app/components/atoms/inputs/TextArea";
import { EmployeeHeader } from "@/app/components/layouts/EmployeeHeader";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { InvoiceDetailCard } from "@/app/components/invoices/InvoiceDetailCard";
import { trpc } from "@/trpc/client";
import { Modal } from "@/app/components/atoms/frame/Modal";
import { downloadInvoicePdf } from "@/app/lib/downloadInvoicePdf";

const tokenKey = (invoiceId: string) => `ndi.invoice.token:${invoiceId}`;

const resolveInvoiceId = (
  params?: Record<string, string | string[]> | null,
  fallbackPath?: string | null,
) => {
  if (params) {
    const raw = params.invoiceId;
    if (Array.isArray(raw)) {
      if (raw[0]) return raw[0];
    } else if (raw) {
      return raw;
    }
  }
  if (fallbackPath) {
    const lastSegment = fallbackPath.split("/").filter(Boolean).at(-1);
    return lastSegment ?? "";
  }
  return "";
};

function InvoiceDetailsPage() {
  const params = useParams<Record<string, string | string[]>>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const invoiceId = useMemo(
    () => resolveInvoiceId(params, pathname),
    [params, pathname],
  );
  const tokenQueryValue = searchParams?.get("token") ?? null;
  const searchParamsString = searchParams?.toString() ?? "";
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const invoiceContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!invoiceId || typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(tokenKey(invoiceId));
    if (stored) {
      setToken(stored);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (!invoiceId || typeof window === "undefined" || !tokenQueryValue) return;
    window.sessionStorage.setItem(tokenKey(invoiceId), tokenQueryValue);
    setToken(tokenQueryValue);
    setPassword("");
    setUnlockError(null);
    const paramsCopy = new URLSearchParams(searchParamsString);
    paramsCopy.delete("token");
    const nextUrl = `${pathname}${paramsCopy.toString() ? `?${paramsCopy.toString()}` : ""}`;
    router.replace(nextUrl, { scroll: false });
  }, [invoiceId, pathname, router, searchParamsString, tokenQueryValue]);

  const detailQuery = trpc.invoice.detail.useQuery(
    { invoiceId, token: token ?? "" },
    {
      enabled: Boolean(token && invoiceId),
    },
  );

  const unlockMutation = trpc.invoice.unlock.useMutation({
    onSuccess: ({ token: unlockedToken }) => {
      if (typeof window !== "undefined" && invoiceId) {
        window.sessionStorage.setItem(tokenKey(invoiceId), unlockedToken);
      }
      setToken(unlockedToken);
      setPassword("");
      setUnlockError(null);
      detailQuery.refetch();
    },
    onError: (error) => setUnlockError(error.message),
  });

  const confirmMutation = trpc.invoice.confirm.useMutation({
    onSuccess: () => {
      detailQuery.refetch();
    },
  });
  const requestReviewMutation = trpc.invoice.requestReview.useMutation({
    onSuccess: () => {
      detailQuery.refetch();
      setReviewComment("");
      setRequestError(null);
      setIsRequestModalOpen(false);
    },
    onError: (error) => setRequestError(error.message),
  });

  const handleUnlock = () => {
    if (!invoiceId || !password) return;
    unlockMutation.mutate({ invoiceId, password });
  };

  const handleConfirm = () => {
    if (!invoiceId || !token) return;
    confirmMutation.mutate({ invoiceId, token });
  };

  const handleSubmitReviewRequest = () => {
    if (!invoiceId || !token) return;
    const trimmed = reviewComment.trim();
    if (trimmed.length < 5) {
      setRequestError("Describe the changes you need.");
      return;
    }
    requestReviewMutation.mutate({ invoiceId, token, comment: trimmed });
  };

  const handleDownloadInvoice = async () => {
    if (!invoiceContentRef.current || !detailQuery.data?.invoice) {
      return;
    }
    await downloadInvoicePdf(invoiceContentRef.current, detailQuery.data.invoice.title);
  };

  const handleReset = () => {
    if (!invoiceId) return;
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(tokenKey(invoiceId));
    }
    setToken(null);
    setPassword("");
    setUnlockError(null);
    setIsRequestModalOpen(false);
    setReviewComment("");
    setRequestError(null);
  };

  return (
    <>
    <div className="flex w-full flex-col gap-10">
      <EmployeeHeader />

      {!token ? (
        <div className="rounded-[32px] border border-white/60 bg-white/90 p-8 text-slate-700 shadow-xl shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-200 dark:shadow-slate-900/60">
          <p className="text-xl font-semibold text-slate-900 dark:text-white">Unlock invoice</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            This invoice is protected. Enter your account password to continue.
          </p>
          <div className="mt-6 max-w-md">
            <PasswordInput
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {unlockError && (
            <p className="text-sm text-rose-500">{unlockError}</p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={handleUnlock} disabled={!password || unlockMutation.isPending}>
              {unlockMutation.isPending ? "Unlocking..." : "Unlock & View"}
            </Button>
            <Button theme="secondary" onClick={() => router.push("/invoice")}>Back to list</Button>
          </div>
        </div>
      ) : detailQuery.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : detailQuery.isError ? (
        <div className="rounded-[32px] border border-white/60 bg-white/90 p-8 text-center text-slate-600 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-200">
          <p className="text-lg font-semibold">We couldn’t open this invoice.</p>
          <p className="mt-2 text-sm">{detailQuery.error?.message ?? "Try unlocking again."}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button onClick={() => detailQuery.refetch()}>Retry</Button>
            <Button theme="secondary" onClick={handleReset}>Enter password again</Button>
          </div>
        </div>
      ) : detailQuery.data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button theme="secondary" onClick={() => router.push("/invoice")}>Back to invoices</Button>
          </div>
          <div ref={invoiceContentRef}>
            <InvoiceDetailCard
              invoice={detailQuery.data.invoice}
              actionSlot=
                {detailQuery.data.invoice.canConfirm ? (
                  <Button onClick={handleConfirm} disabled={confirmMutation.isPending}>
                    {confirmMutation.isPending ? "Confirming..." : "Confirm & ready to deliver"}
                  </Button>
                ) : null}
              footnote={
                <div className="mt-6 rounded-3xl border border-white/60 bg-white/90 p-4 text-sm text-slate-600 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300">
                  <p>If you have any questions about this invoice, please contact:</p>
                  <p className="mt-1 text-base font-semibold text-blue-600 dark:text-sky-400">
                    {detailQuery.data.invoice.createdBy.email}
                  </p>
                </div>
              }
            />
          </div>
          {confirmMutation.error && (
            <p className="text-sm text-rose-500">{confirmMutation.error.message}</p>
          )}
          <div className="flex flex-wrap gap-3">
            {detailQuery.data.invoice.canRequestChanges && (
              <Button
                theme="secondary"
                onClick={() => {
                  setIsRequestModalOpen(true);
                  setRequestError(null);
                }}
              >
                Request changes
              </Button>
            )}
            <Button theme="secondary" onClick={handleDownloadInvoice}>
              Download PDF
            </Button>
            <Button theme="secondary" onClick={handleReset}>
              Use a different password
            </Button>
          </div>
        </div>
      ) : null}
    </div>
      <Modal
        title="Request invoice changes"
        open={isRequestModalOpen}
        setOpen={(open) => {
          if (!open) {
            setIsRequestModalOpen(false);
            setReviewComment("");
            setRequestError(null);
          } else {
            setIsRequestModalOpen(true);
          }
        }}
        isDoneButton={false}
        isCancelButton={false}
        doneButtonText=""
        className="w-[min(90vw,520px)]"
      >
        <div className="space-y-4">
          <TextArea
            label="Describe the changes"
            value={reviewComment}
            onChange={(event) => {
              setReviewComment(event.target.value);
              setRequestError(null);
            }}
            height="120px"
            placeholder="Provide specific feedback so HR can adjust the invoice."
          />
          {requestError && <p className="text-sm text-rose-500">{requestError}</p>}
          <div className="flex justify-end gap-3">
            <Button
              theme="secondary"
              onClick={() => {
                setIsRequestModalOpen(false);
                setReviewComment("");
                setRequestError(null);
              }}
              disabled={requestReviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitReviewRequest} disabled={requestReviewMutation.isPending}>
              {requestReviewMutation.isPending ? "Sending..." : "Submit request"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default InvoiceDetailsPage;
