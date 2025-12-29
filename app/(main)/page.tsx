"use client";

import Image from "next/image";
import { trpc } from "@/trpc/client";
import type { EmployeeDashboardResponse } from "@/types/employee-dashboard";
import { getNotificationTypeLabel } from "@/lib/notification";
import Button from "../components/atoms/buttons/Button";
import { CardWithHeader } from "../components/atoms/frame/CardWithHeader";
import LoadingSpinner from "../components/LoadingSpinner";
import Text from "../components/atoms/Text/Text";

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

const DAY_MS = 24 * 60 * 60 * 1000;

const leaveColorMap: Record<string, string> = {
  CASUAL: "#0ea5e9",
  SICK: "#14b8a6",
  ANNUAL: "#f59e0b",
  PATERNITY_MATERNITY: "#8b5cf6",
};

const statusColorMap: Record<
  string,
  { bg: string; text: string; accent: string; badge: string }
> = {
  PRESENT: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-200",
    accent: "bg-emerald-400",
    badge: "bg-emerald-500",
  },
  LATE: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-200",
    accent: "bg-amber-400",
    badge: "bg-amber-500",
  },
  HALF_DAY: {
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    text: "text-indigo-700 dark:text-indigo-200",
    accent: "bg-indigo-400",
    badge: "bg-indigo-500",
  },
  ABSENT: {
    bg: "bg-rose-50 dark:bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-200",
    accent: "bg-rose-400",
    badge: "bg-rose-500",
  },
  REMOTE: {
    bg: "bg-sky-50 dark:bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-200",
    accent: "bg-sky-400",
    badge: "bg-sky-500",
  },
  HOLIDAY: {
    bg: "bg-purple-50 dark:bg-purple-500/10",
    text: "text-purple-700 dark:text-purple-200",
    accent: "bg-purple-400",
    badge: "bg-purple-500",
  },
};

const statusLabelMap: Record<string, string> = {
  PRESENT: "On time",
  LATE: "Late",
  HALF_DAY: "Half day",
  ABSENT: "Absent",
  REMOTE: "Remote",
  HOLIDAY: "Holiday",
};

const formatDateValue = (
  value?: string | null,
  formatter: Intl.DateTimeFormat = longDateFormatter,
) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return formatter.format(parsed);
};

const formatDuration = (seconds: number) => {
  if (!seconds) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (!hours && !minutes) {
    return "< 1m";
  }
  return `${hours ? `${hours}h` : ""}${minutes ? ` ${minutes}m` : ""}`.trim();
};

const formatHoursValue = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0h";
  }
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}h`;
};

const formatTextValue = (value?: string | null) =>
  value && value.trim().length > 0 ? value : "—";

const formatDaysUntil = (value?: string | null) => {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return null;
  }
  const normalizedTarget = new Date(target);
  normalizedTarget.setHours(0, 0, 0, 0);
  const normalizedToday = new Date();
  normalizedToday.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (normalizedTarget.getTime() - normalizedToday.getTime()) / DAY_MS,
  );
  if (diffDays <= 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Tomorrow";
  }
  return `In ${diffDays} days`;
};

const humanizeStatus = (status: string) =>
  status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const buildAttendanceChart = (
  points: EmployeeDashboardResponse["attendanceTrend"],
) => {
  if (!points.length) {
    return {
      areaPath: "",
      linePath: "",
      markers: [] as Array<{
        x: number;
        y: number;
        status: string;
        label: string;
        workedHours: number;
      }>,
      maxHours: 1,
    };
  }
  const maxSeconds =
    points.reduce((max, point) => Math.max(max, point.workedSeconds), 0) || 1;
  const lastIndex = Math.max(points.length - 1, 1);
  const markers = points.map((point, index) => {
    const x = lastIndex === 0 ? 0 : (index / lastIndex) * 100;
    const y = 100 - (point.workedSeconds / maxSeconds) * 100;
    return {
      x,
      y,
      status: point.status,
      label: formatDateValue(point.date, shortDateFormatter),
      workedHours: Math.round((point.workedSeconds / 3600) * 10) / 10,
    };
  });
  const linePath = markers
    .map((marker, index) => `${index === 0 ? "M" : "L"}${marker.x},${marker.y}`)
    .join(" ");
  const areaPath = `M0,100 ${markers
    .map((marker) => `${marker.x},${marker.y}`)
    .join(" ")} L100,100 Z`;

  return {
    areaPath,
    linePath,
    markers,
    maxHours: Math.round((maxSeconds / 3600) * 10) / 10 || 1,
  };
};

const buildLeaveChart = (balances: EmployeeDashboardResponse["leaveBalances"]) => {
  const total = balances.reduce((sum, entry) => sum + entry.remaining, 0);
  if (!total) {
    return {
      background: "conic-gradient(#e2e8f0 0deg 360deg)",
      legend: balances.map((entry) => ({
        ...entry,
        color: leaveColorMap[entry.type] ?? "#818cf8",
      })),
    };
  }
  let currentAngle = 0;
  const segments: string[] = [];
  balances.forEach((entry) => {
    if (!entry.remaining) return;
    const angle = (entry.remaining / total) * 360;
    const color = leaveColorMap[entry.type] ?? "#818cf8";
    segments.push(`${color} ${currentAngle}deg ${currentAngle + angle}deg`);
    currentAngle += angle;
  });
  return {
    background: `conic-gradient(${segments.join(", ")})`,
    legend: balances.map((entry) => ({
      ...entry,
      color: leaveColorMap[entry.type] ?? "#818cf8",
    })),
  };
};

function HomePage() {
  const profileQuery = trpc.dashboard.profile.useQuery();
  const summaryQuery = trpc.dashboard.summary.useQuery();
  const attendanceQuery = trpc.dashboard.attendance.useQuery();
  const timeOffQuery = trpc.dashboard.timeOff.useQuery();
  const notificationsQuery = trpc.dashboard.notifications.useQuery();

  const queries = [
    profileQuery,
    summaryQuery,
    attendanceQuery,
    timeOffQuery,
    notificationsQuery,
  ];

  const isLoading = queries.some((query) => query.isLoading);
  const isFetching = queries.some((query) => query.isFetching);
  const showFetchingIndicator = !isLoading && isFetching;

  if (isLoading) {
    return (
      <LoadingSpinner
        fullscreen
        label="Loading your dashboard..."
        helper="We are fetching your attendance, leave, and notifications."
      />
    );
  }

  const hasError = queries.some((query) => query.isError || !query.data);
  const refetchAll = () => {
    queries.forEach((query) => {
      void query.refetch();
    });
  };

  if (hasError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-slate-500">
          We couldn&apos;t load your dashboard right now.
        </p>
        <Button onClick={refetchAll} disabled={isFetching}>
          <Text text={isFetching ? "Refreshing..." : "Retry"} className="font-semibold" />
        </Button>
      </div>
    );
  }

  const profileSection = profileQuery.data!;
  const summarySection = summaryQuery.data!;
  const attendanceSection = attendanceQuery.data!;
  const timeOffSection = timeOffQuery.data!;
  const notificationsSection = notificationsQuery.data!;

  const data: EmployeeDashboardResponse = {
    profile: profileSection.profile,
    monthSnapshot: summarySection.monthSnapshot,
    quickStats: summarySection.quickStats,
    personalDetails: profileSection.personalDetails,
    companyDetails: profileSection.companyDetails,
    attendanceSummary: attendanceSection.attendanceSummary,
    attendanceTrend: attendanceSection.attendanceTrend,
    leaveBalances: timeOffSection.leaveBalances,
    leaveHighlights: timeOffSection.leaveHighlights,
    upcomingHolidays: timeOffSection.upcomingHolidays,
    notifications: notificationsSection.notifications,
  };
  const profile = data.profile;
  const avatarSrc = profile.avatarUrl ?? "/dp.png";
  const attendanceChart = buildAttendanceChart(data.attendanceTrend);
  const leaveChart = buildLeaveChart(data.leaveBalances);
  const monthSnapshotCards = [
    {
      label: "Days worked",
      value: data.monthSnapshot.daysWorked.toString(),
      helper: data.attendanceSummary.monthLabel,
    },
    {
      label: "Hours logged",
      value: formatHoursValue(data.monthSnapshot.hoursLogged),
      helper: "Tracked hours",
    },
    {
      label: "Leaves taken",
      value: data.monthSnapshot.leavesTaken.toString(),
      helper: "Approved days",
    },
  ];

  const attendanceBadges = Object.entries(data.attendanceSummary.statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status,
      count,
      label: statusLabelMap[status] ?? humanizeStatus(status),
    }));

  const upcomingHolidays = data.upcomingHolidays.map((holiday) => ({
    ...holiday,
    formattedDate: formatDateValue(holiday.date, longDateFormatter),
    countdown: formatDaysUntil(holiday.date),
  }));

  return (
    <div className="relative space-y-8">
      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 via-sky-500 to-cyan-400 p-8 text-white shadow-2xl dark:shadow-slate-950/60">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <div className="relative h-28 w-28 rounded-[32px] border-4 border-white/40 shadow-xl shadow-indigo-300 dark:border-slate-900/60 dark:shadow-slate-950/60">
                <Image
                  src={avatarSrc}
                  alt={profile.fullName}
                  fill
                  sizes="112px"
                  className="rounded-[28px] object-cover"
                  priority
                />
              </div>
              <div>
                <Text
                  text={profile.preferredName ?? profile.fullName}
                  className="text-3xl font-semibold text-white"
                />
                <p className="text-sm text-white/80">
                  {formatTextValue(profile.designation)}
                </p>
                <p className="text-sm text-white/70">
                  Joined {formatDateValue(profile.joiningDate, shortDateFormatter)}
                </p>
              </div>
            </div>
            <div className="grid flex-1 gap-4 sm:grid-cols-3">
              {monthSnapshotCards.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/40 bg-white/10 p-4 text-center backdrop-blur dark:border-slate-900/60 dark:bg-slate-900/40"
                >
                  <p className="text-3xl font-semibold text-white">{item.value}</p>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                    {item.label}
                  </p>
                  <p className="text-xs text-white/60">{item.helper}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/40 px-4 py-1 text-[11px] dark:border-slate-900/60"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {data.quickStats.map((stat) => (
            <div
              key={stat.id}
              className="rounded-[28px] border border-white/60 bg-white/90 p-5 shadow-xl shadow-indigo-100 backdrop-blur transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
                {stat.label}
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
                {stat.value}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{stat.helper}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <CardWithHeader title="Personal Details" titleColor="bg-sky-500" className="h-full">
          <div className="grid gap-3">
            {data.personalDetails.map((detail, index) => (
              <div
                key={`${detail.label}-${index}`}
                className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/60"
              >
                <span className="text-slate-500 dark:text-slate-400">{detail.label}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {detail.label === "Date of Birth"
                    ? formatDateValue(detail.value, shortDateFormatter)
                    : formatTextValue(detail.value)}
                </span>
              </div>
            ))}
          </div>
        </CardWithHeader>

        <CardWithHeader title="Company Details" titleColor="bg-indigo-500" className="h-full">
          <div className="grid gap-3">
            {data.companyDetails.map((detail, index) => (
              <div
                key={`${detail.label}-${index}`}
                className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/60"
              >
                <span className="text-slate-500 dark:text-slate-400">{detail.label}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {detail.label === "Joined"
                    ? formatDateValue(detail.value, shortDateFormatter)
                    : formatTextValue(detail.value)}
                </span>
              </div>
            ))}
          </div>
        </CardWithHeader>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <CardWithHeader title="Upcoming Holidays" titleColor="bg-purple-500">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Stay ahead of organization-wide breaks.
              </p>
              <Button
                href="/holidays"
                theme="secondary"
                className="text-xs font-semibold uppercase tracking-wide"
              >
                See more
              </Button>
            </div>
            {upcomingHolidays.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No upcoming holidays have been scheduled yet.
              </p>
            ) : (
              <div className="space-y-4">
                {upcomingHolidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="rounded-2xl border border-white/60 bg-white/80 px-5 py-4 text-slate-600 shadow-sm transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          {holiday.title}
                        </p>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                          {holiday.formattedDate}
                        </p>
                      </div>
                      {holiday.countdown ? (
                        <span className="rounded-full border border-purple-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-purple-600 dark:border-purple-500/40 dark:text-purple-200">
                          {holiday.countdown}
                        </span>
                      ) : null}
                    </div>
                    {holiday.description ? (
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        {holiday.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardWithHeader>

        <CardWithHeader title="Notifications" titleColor="bg-amber-500">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">Your latest workspace updates.</p>
              <Button
                href="/notification"
                theme="secondary"
                className="text-xs font-semibold uppercase tracking-wide"
              >
                See all
              </Button>
            </div>
            {data.notifications.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No notifications from your workspace just yet.
              </p>
            ) : (
              <div className="space-y-3">
                {data.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`rounded-2xl border px-5 py-4 text-sm shadow-sm transition-colors duration-200 ${
                      notification.isSeen
                        ? "border-white/60 bg-white/80 text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300"
                        : "border-indigo-200 bg-white text-slate-700 shadow-indigo-100 dark:border-sky-500/50 dark:bg-slate-900/70 dark:text-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-semibold ${
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
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {getNotificationTypeLabel(notification.type)}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">{notification.body}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                      {formatDateValue(notification.timestamp, dateTimeFormatter)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardWithHeader>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <CardWithHeader title="Attendance Trend" titleColor="bg-cyan-500">
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-white/60 bg-gradient-to-b from-white to-white/40 p-6 shadow-inner transition dark:border-slate-700/60 dark:from-slate-900 dark:to-slate-900/40">
              {attendanceChart.markers.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No attendance records for this period.
                </p>
              ) : (
              <div className="space-y-4">
                <div className="relative h-48 w-full">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                    <path d={attendanceChart.areaPath} fill="url(#attendanceGradient)" opacity="0.25" />
                    <defs>
                      <linearGradient id="attendanceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.1" />
                      </linearGradient>
                    </defs>
                    <path
                      d={attendanceChart.linePath}
                      fill="none"
                      stroke="#0ea5e9"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    {attendanceChart.markers.map((marker, index) => {
                      const color = statusColorMap[marker.status]?.badge ?? "#0ea5e9";
                      return (
                        <circle
                          key={`${marker.status}-${index}`}
                          cx={marker.x}
                          cy={marker.y}
                          r={1.6}
                          fill={color}
                        />
                      );
                    })}
                  </svg>
                </div>
                <div className="grid gap-4 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                      On-time rate
                    </p>
                    <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {Math.round(data.attendanceSummary.onTimePercentage)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                      Avg check-in
                    </p>
                    <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {data.attendanceSummary.averageCheckIn ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                      Avg hours/day
                    </p>
                    <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {formatDuration(data.attendanceSummary.averageWorkSeconds)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {attendanceBadges.map((badge) => {
                    const palette = statusColorMap[badge.status] ?? statusColorMap.PRESENT;
                    return (
                      <span
                        key={badge.status}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${palette.bg} ${palette.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${palette.accent}`} />
                        {badge.label}: {badge.count}
                      </span>
                    );
                  })}
                </div>
              </div>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
              <Button
                href="/attendance/history"
                theme="secondary"
                className="text-xs font-semibold uppercase tracking-wide"
              >
                Attendance history
              </Button>
            </div>
          </div>
        </CardWithHeader>

        <CardWithHeader title="Leave Balance" titleColor="bg-rose-500">
          <div className="flex flex-col gap-4">
            
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
              <div className="flex flex-1 flex-col items-center gap-3">
                <div
                  className="h-40 w-40 rounded-full border-8 border-white/70 bg-white/70 shadow-inner dark:border-slate-800/70 dark:bg-slate-900/60"
                  style={{ backgroundImage: leaveChart.background }}
                />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Total balance: {data.quickStats.find((stat) => stat.id === "leave-balance")?.value ?? "0d"}
                </p>
              </div>
              <div className="flex-1 space-y-3">
                {leaveChart.legend.map((entry) => (
                  <div
                    key={entry.type}
                    className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {entry.label}
                      </span>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {entry.remaining} day{entry.remaining === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
              <Button
                href="/leave"
                theme="secondary"
                className="text-xs font-semibold uppercase tracking-wide"
              >
                Leave history
              </Button>
            </div>
          </div>
        </CardWithHeader>
      </section>
    </div>
  );
}

export default HomePage;
