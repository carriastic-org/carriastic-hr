"use client";

import Button from "../../components/atoms/buttons/Button";
import Text from "../../components/atoms/Text/Text";
import LoadingSpinner from "../../components/LoadingSpinner";
import { trpc } from "@/trpc/client";

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDateValue = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return fullDateFormatter.format(parsed);
};

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatCountdown = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const today = startOfDay(new Date());
  const target = startOfDay(parsed);
  const diffDays = Math.round((target.getTime() - today.getTime()) / DAY_MS);

  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Tomorrow";
  }
  if (diffDays > 1) {
    return `In ${diffDays} days`;
  }
  if (diffDays === -1) {
    return "Yesterday";
  }
  if (diffDays < -1) {
    return `${Math.abs(diffDays)} days ago`;
  }
  return null;
};

const getHolidayState = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      label: "Unknown",
      className:
        "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300",
    };
  }
  const today = startOfDay(new Date());
  const target = startOfDay(parsed);
  if (target.getTime() === today.getTime()) {
    return {
      label: "Today",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
    };
  }
  if (target.getTime() < today.getTime()) {
    return {
      label: "Past",
      className:
        "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300",
    };
  }
  return {
    label: "Upcoming",
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200",
  };
};

const HolidaysPage = () => {
  const { data, isLoading, isError, isFetching, refetch } =
    trpc.dashboard.holidays.useQuery();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner label="Loading holidays..." />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-slate-500">
          We couldn&apos;t load your holiday calendar right now.
        </p>
        <Button onClick={() => void refetch()} disabled={isFetching}>
          <Text text={isFetching ? "Refreshing..." : "Retry"} className="font-semibold" />
        </Button>
      </div>
    );
  }

  const today = startOfDay(new Date());
  const upcomingCount = data.holidays.filter((holiday) => {
    const parsed = new Date(holiday.date);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }
    return startOfDay(parsed).getTime() >= today.getTime();
  }).length;

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-white/60 bg-gradient-to-br from-indigo-600 via-sky-500 to-cyan-400 p-8 text-white shadow-2xl dark:border-slate-800/60 dark:shadow-slate-950/60">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-white/70">
              {data.workspaceName}
            </p>
            <Text text="Holiday Calendar" className="text-3xl font-semibold text-white" />
            <p className="text-white/80">Plan your time off with the latest schedule.</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-center">
            <p className="text-4xl font-semibold">{upcomingCount}</p>
            <p className="text-sm uppercase tracking-[0.3em] text-white/70">
              Upcoming
            </p>
            <p className="text-xs text-white/60">holidays remaining</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {data.holidays.length === 0 ? (
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 text-center text-slate-500 shadow-lg dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
            No holidays have been scheduled yet.
          </div>
        ) : (
          data.holidays.map((holiday) => {
            const countdown = formatCountdown(holiday.date);
            const status = getHolidayState(holiday.date);
            const shortDate = shortDateFormatter.format(new Date(holiday.date));

            return (
              <div
                key={holiday.id}
                className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-lg shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/50"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">
                      {shortDate}
                    </p>
                    <Text
                      text={holiday.title}
                      className="text-2xl font-semibold text-slate-900 dark:text-slate-100"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {formatDateValue(holiday.date)}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span
                      className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide ${status.className}`}
                    >
                      {status.label}
                    </span>
                    {countdown ? (
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {countdown}
                      </span>
                    ) : null}
                  </div>
                </div>
                {holiday.description ? (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                    {holiday.description}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HolidaysPage;
