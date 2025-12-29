"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { trpc } from "@/trpc/client";
import { getNotificationTypeLabel } from "@/lib/notification";
import { EmployeeHeader } from "../../../components/layouts/EmployeeHeader";
import Button from "../../../components/atoms/buttons/Button";
import Text from "../../../components/atoms/Text/Text";

const detailDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeStyle: "short",
});

function NotificationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawNotificationId = params?.notificationId;
  const notificationId =
    typeof rawNotificationId === "string"
      ? rawNotificationId
      : Array.isArray(rawNotificationId)
        ? rawNotificationId[0]
        : "";
  const isIdReady = notificationId.length > 0;
  const utils = trpc.useContext();
  const notificationQuery = trpc.notification.detail.useQuery(
    { id: notificationId },
    { enabled: isIdReady },
  );
  const markAsSeenMutation = trpc.notification.markAsSeen.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.notification.list.invalidate(),
        utils.notification.unseenCount.invalidate(),
        utils.dashboard.notifications.invalidate(),
      ]);
    },
  });

  const markAsSeen = markAsSeenMutation.mutate;

  useEffect(() => {
    if (notificationQuery.data && !notificationQuery.data.isSeen) {
      markAsSeen({ id: notificationQuery.data.id });
    }
  }, [markAsSeen, notificationQuery.data]);

  const handleBack = () => router.push("/notification");
  const handleOpenAction = () => {
    const url = notificationQuery.data?.actionUrl;
    if (url) {
      router.push(url);
    }
  };

  const isLoading = !isIdReady || notificationQuery.isLoading;
  const isError = isIdReady && (notificationQuery.isError || (!notificationQuery.isLoading && !notificationQuery.data));
  const notification = notificationQuery.data;

  return (
    <div className="flex w-full flex-col gap-10">
      <EmployeeHeader />

      <div className="flex w-full flex-col gap-6 rounded-[32px] border border-white/60 bg-white/85 p-8 shadow-xl shadow-indigo-100 transition-colors duration-200 md:min-h-[500px] xl:min-h-[680px] dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60">
        {isLoading && (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
            Loading notification...
          </div>
        )}

        {isError && !isLoading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-slate-500 dark:text-slate-300">
            <p>We couldn&apos;t find that notification.</p>
            <Button theme="secondary" onClick={handleBack}>
              Back to notifications
            </Button>
          </div>
        )}

        {!isLoading && notification && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Text
                    text={notification.title}
                    className="text-2xl text-slate-900 dark:text-slate-100"
                    isBold
                  />
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {detailDateFormatter.format(new Date(notification.timestamp))}
                  </div>
                </div>
                <span className="rounded-full bg-amber-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-600 dark:bg-amber-500/10 dark:text-amber-200">
                  {getNotificationTypeLabel(notification.type) || notification.type}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                <span>From {notification.sourceLabel}</span>
                <span>Audience: {notification.audienceLabel}</span>
                {notification.sender && <span>Sender: {notification.sender.name}</span>}
              </div>
            </div>

            <p className="text-base text-slate-700 dark:text-slate-200">{notification.body}</p>

            {notification.highlights.length > 0 && (
              <div className="grid gap-4 rounded-[24px] border border-white/60 bg-white/80 p-6 dark:border-slate-700/70 dark:bg-slate-900/60 md:grid-cols-2">
                {notification.highlights.map((highlight) => (
                  <div key={`${highlight.label}-${highlight.value}`} className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm text-slate-600 shadow-inner dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                      {highlight.label}
                    </p>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {highlight.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-[24px] border border-slate-100 bg-white/80 p-5 text-sm text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                Delivery
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {notification.audienceLabel}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button theme="secondary" onClick={handleBack}>
                Back to notifications
              </Button>
              {notification.actionUrl && (
                <Button onClick={handleOpenAction}>
                  View related action
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationDetailPage;
