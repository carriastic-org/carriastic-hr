"use client";

import { ReactElement, useMemo, useState } from "react";
import { IoEye } from "react-icons/io5";
import { useRouter } from "next/navigation";

import { trpc } from "@/trpc/client";
import {
  getNotificationTypeLabel,
  notificationTypeLabels,
  type NotificationTypeValue,
} from "@/lib/notification";
import { EmployeeHeader } from "../../components/layouts/EmployeeHeader";
import Table from "../../components/atoms/tables/Table";
import Pagination from "../../components/pagination/Pagination";
import Button from "../../components/atoms/buttons/Button";
import Text from "../../components/atoms/Text/Text";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const notificationTableHeader = ["Date", "Notification", "From", "Action"];

const EMPTY_NOTIFICATIONS: [] = [];

type FilterValue = "ALL" | NotificationTypeValue;

interface Row extends Record<string, string | number | ReactElement> {
  id: string;
  Date: string;
  Notification: ReactElement;
  From: string;
  Action: ReactElement;
}

function NotificationPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterValue>("ALL");
  const [currentPageData, setCurrentPageData] = useState<Row[]>([]);

  const queryInput = filter === "ALL" ? undefined : { type: filter };
  const notificationsQuery = trpc.notification.list.useQuery(queryInput);
  const utils = trpc.useContext();
  const markAsSeenMutation = trpc.notification.markAsSeen.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.notification.list.invalidate(),
        utils.notification.unseenCount.invalidate(),
        utils.dashboard.notifications.invalidate(),
      ]);
    },
  });

  const notifications = notificationsQuery.data?.notifications ?? EMPTY_NOTIFICATIONS;
  const rows = useMemo<Row[]>(
    () =>
      notifications.map((notification) => ({
        id: notification.id,
        Date: dateTimeFormatter.format(new Date(notification.timestamp)),
        Notification: (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p
                className={`text-sm font-semibold ${
                  notification.isSeen
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-indigo-600 dark:text-indigo-200"
                }`}
              >
                {notification.title}
              </p>
              {!notification.isSeen && (
                <span
                  className="h-2 w-2 rounded-full bg-indigo-500"
                  aria-label="Unseen notification"
                />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <span>{getNotificationTypeLabel(notification.type) || notification.type}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span>{notification.status.toLowerCase()}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{notification.body}</p>
          </div>
        ),
        From: notification.sourceLabel,
        Action: (
          <IoEye
            className={`text-lg ${
              notification.isSeen ? "text-slate-400" : "text-indigo-500"
            }`}
          />
        ),
      })),
    [notifications],
  );

  const filterOptions = useMemo(() => {
    const counts = notificationsQuery.data?.counts;
    const options: Array<{ id: FilterValue; label: string; count: number }> = [
      {
        id: "ALL",
        label: "All",
        count: counts?.overall ?? 0,
      },
    ];

    Object.entries(notificationTypeLabels).forEach(([key, label]) => {
      options.push({
        id: key as NotificationTypeValue,
        label,
        count: counts?.perType[key as NotificationTypeValue] ?? 0,
      });
    });

    return options;
  }, [notificationsQuery.data?.counts]);

  const handleRowClick = (row: Record<string, string | number | ReactElement>) => {
    const id = row.id;
    if (typeof id !== "string") {
      return;
    }
    const target = notifications.find((notification) => notification.id === id);
    if (target && !target.isSeen) {
      markAsSeenMutation.mutate({ id });
    }
    if (target?.actionUrl) {
      router.push(target.actionUrl);
      return;
    }
    router.push(`/notification/${id}`);
  };

  const handleRetry = () => {
    void notificationsQuery.refetch();
  };

  const isLoading = notificationsQuery.isLoading;
  const isError = notificationsQuery.isError;
  const showTable = rows.length > 0 && !isLoading && !isError;

  return (
    <div className="flex w-full flex-col gap-10">
      <EmployeeHeader />

      <div className="flex w-full flex-col gap-6 rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-xl shadow-indigo-100 transition-colors duration-200 md:min-h-[500px] xl:min-h-[680px] dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Text text="Notifications" className="text-2xl text-slate-900 dark:text-slate-100" isBold />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Stay on top of announcements, leave decisions, attendance alerts, and report reminders.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              const isActive = option.id === filter;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "border-transparent bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 text-white shadow"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  <span>{option.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive
                        ? "bg-white/20"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
        </header>

        {isLoading && (
          <div className="flex flex-1 items-center justify-center rounded-[24px] border border-white/60 bg-white/80 p-10 text-sm text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300">
            Loading notifications...
          </div>
        )}

        {isError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[24px] border border-rose-200 bg-rose-50/80 p-8 text-center text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            <p>We couldn&apos;t load your notifications.</p>
            <Button onClick={handleRetry} disabled={notificationsQuery.isFetching}>
              {notificationsQuery.isFetching ? "Refreshing..." : "Retry"}
            </Button>
          </div>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[24px] border border-white/60 bg-white/80 p-10 text-center text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300">
            <p className="text-base font-semibold">You&apos;re all caught up</p>
            <p className="text-sm">There are no notifications to review right now.</p>
          </div>
        )}

        {showTable && (
          <>
            <Table
              headers={notificationTableHeader}
              rows={currentPageData}
              onRowClick={handleRowClick}
            />
            <Pagination
              data={rows}
              postsPerPage={10}
              setCurrentPageData={setCurrentPageData}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default NotificationPage;
