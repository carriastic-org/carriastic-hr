"use client";

import { useMemo, useState } from "react";

import Button from "@/app/components/atoms/buttons/Button";
import { trpc } from "@/trpc/client";
import type {
  HrDashboardAttendanceState,
  HrDashboardResponse,
} from "@/types/hr-dashboard";
import LoadingSpinner from "@/app/components/LoadingSpinner";

type WorkforcePoint = HrDashboardResponse["workforceCapacity"][number];
type WorkforceMetricKey = "plan" | "actual";
type WorkingFormatStat = HrDashboardResponse["attendanceBreakdown"][number] & {
  percent: number;
  color: string;
};
type TeamShareStat = {
  label: string;
  value: number;
  percent: number;
  color: string;
};
type ManageableLeaveStatus = "PROCESSING" | "APPROVED" | "DENIED" | "CANCELLED";
type DashboardActionFeedback = { type: "success" | "error"; text: string };

type Normalizer = {
  min: number;
  range: number;
};

const attendanceStateStyles: Record<HrDashboardAttendanceState, string> = {
  "on-time":
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  late: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  remote: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200",
  missing: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
};

const numberFormatter = new Intl.NumberFormat("en-US");
const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

const getWorkforceNormalizer = (points: WorkforcePoint[]): Normalizer => {
  if (!points.length) {
    return { min: 0, range: 1 };
  }
  const values = points.flatMap((point) => [point.plan, point.actual]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, range: max - min || 1 };
};

const buildLinePath = (
  points: WorkforcePoint[],
  key: WorkforceMetricKey,
  normalizer: Normalizer,
) =>
  points
    .map((point, index) => {
      if (points.length === 1) {
        return `M0,${50}`;
      }
      const x = (index / (points.length - 1)) * 100;
      const normalized = ((point[key] - normalizer.min) / normalizer.range) * 100;
      const y = 100 - normalized;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

const buildPlotPoints = (
  points: WorkforcePoint[],
  key: WorkforceMetricKey,
  normalizer: Normalizer,
) =>
  points.map((point, index) => {
    const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 100;
    const normalized = ((point[key] - normalizer.min) / normalizer.range) * 100;
    const y = 100 - normalized;
    return { ...point, x, y, value: point[key] };
  });

const formatFullDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return fullDateFormatter.format(parsed);
};

const leaveStatusLabelMap: Record<ManageableLeaveStatus, string> = {
  PROCESSING: "sent for escalation",
  APPROVED: "approved",
  DENIED: "denied",
  CANCELLED: "cancelled",
};

const REJECTION_NOTE = "Rejected from dashboard overview";

export default function HrAdminDashboardPage() {
  const queryDate = useMemo(() => new Date().toISOString(), []);

  const dashboardQuery = trpc.hrDashboard.overview.useQuery({
    date: queryDate,
  });
  const utils = trpc.useUtils();
  const [leaveActionMessage, setLeaveActionMessage] = useState<DashboardActionFeedback | null>(
    null,
  );
  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);
  const [processingLeaveStatus, setProcessingLeaveStatus] =
    useState<ManageableLeaveStatus | null>(null);
  const leaveApprovals = dashboardQuery.data?.leaveApprovals ?? [];
  const findLeaveRequestName = (requestId: string) =>
    leaveApprovals.find((request) => request.id === requestId)?.name ?? "Leave request";
  const leaveStatusMutation = trpc.hrLeave.updateStatus.useMutation({
    onMutate: ({ requestId, status }) => {
      setProcessingLeaveId(requestId);
      setProcessingLeaveStatus(status);
      setLeaveActionMessage(null);
    },
    onSuccess: async (_data, variables) => {
      setLeaveActionMessage({
        type: "success",
        text: `${findLeaveRequestName(variables.requestId)} ${leaveStatusLabelMap[variables.status]}.`,
      });
      await dashboardQuery.refetch();
      await utils.hrLeave.pendingCount.invalidate();
    },
    onError: (error) => {
      setLeaveActionMessage({
        type: "error",
        text: error.message || "Unable to update leave request.",
      });
    },
    onSettled: () => {
      setProcessingLeaveId(null);
      setProcessingLeaveStatus(null);
    },
  });

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <LoadingSpinner label="Loading dashboard..." helper="Crunching attendance, leave, and notifications in one place."/>
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center text-slate-600">
        <p>We couldn&apos;t load the dashboard summary right now.</p>
        <Button
          onClick={() => dashboardQuery.refetch()}
          disabled={dashboardQuery.isFetching}
          className="px-6 py-3 text-sm"
        >
          {dashboardQuery.isFetching ? "Refreshing..." : "Retry"}
        </Button>
      </div>
    );
  }

  const data = dashboardQuery.data;
  const statHighlights = data.statHighlights;
  const attendanceBreakdown = data.attendanceBreakdown;
  const attendanceTrend = data.attendanceTrend;
  const attendanceLog = data.attendanceLog;
  const workforceCapacity = data.workforceCapacity;
  const engagementGauge = data.engagementGauge;
  const engagementSnapshot = data.engagementSnapshot;
  const teamCapacity = data.teamCapacity;

  const handleLeaveAction = (
    requestId: string,
    status: ManageableLeaveStatus,
    note?: string,
  ) => {
    leaveStatusMutation.mutate({ requestId, status, note });
  };

  const attendanceMax = attendanceTrend.length
    ? Math.max(...attendanceTrend.map((slot) => slot.onsite + slot.remote)) || 1
    : 1;

  const workforcePoints = workforceCapacity.length
    ? workforceCapacity
    : [{ label: "Now", plan: 0, actual: 0 }];
  const workforceNormalizer = getWorkforceNormalizer(workforcePoints);
  const workforceActualPath = buildLinePath(
    workforcePoints,
    "actual",
    workforceNormalizer,
  );
  const workforcePlanPath = buildLinePath(
    workforcePoints,
    "plan",
    workforceNormalizer,
  );
  const workforceActualPoints = buildPlotPoints(
    workforcePoints,
    "actual",
    workforceNormalizer,
  );
  const workforcePlanPoints = buildPlotPoints(
    workforcePoints,
    "plan",
    workforceNormalizer,
  );
  const latestWorkforcePoint = workforcePoints[workforcePoints.length - 1];
  const workforcePlanLabel = latestWorkforcePoint
    ? numberFormatter.format(latestWorkforcePoint.plan)
    : "0";
  const workforceActualLabel = latestWorkforcePoint
    ? numberFormatter.format(latestWorkforcePoint.actual)
    : "0";
  const workforceDelta = latestWorkforcePoint
    ? latestWorkforcePoint.actual - latestWorkforcePoint.plan
    : 0;

  const attendanceTotal = attendanceBreakdown.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const attendanceColorMap: Record<string, string> = {
    "On-site": "#8b5cf6",
    Remote: "#0ea5e9",
    Late: "#f97316",
    Absent: "#f43f5e",
  };
  const workingFormatAccumulator = attendanceBreakdown.reduce(
    (acc, item) => {
      const percent = attendanceTotal ? (item.value / attendanceTotal) * 100 : 0;
      const color = attendanceColorMap[item.label] ?? "#94a3b8";
      acc.slices.push(`${color} ${acc.cursor}% ${acc.cursor + percent}%`);
      acc.stats.push({
        ...item,
        percent: Math.round(percent),
        color,
      });
      acc.cursor += percent;
      return acc;
    },
    { cursor: 0, slices: [] as string[], stats: [] as WorkingFormatStat[] },
  );
  const workingFormatSlices = workingFormatAccumulator.slices;
  const workingFormatStats = workingFormatAccumulator.stats;
  const workingFormatDonutBackground = workingFormatSlices.length
    ? `conic-gradient(${workingFormatSlices.join(", ")})`
    : "conic-gradient(#cbd5f5 0deg, #cbd5f5 360deg)";
  const workingFormatTotalLabel = numberFormatter.format(attendanceTotal);

  const teamCapacityMax = teamCapacity.length
    ? Math.max(
        ...teamCapacity.map((team) => team.committed + team.available),
      )
    : 1;
  const teamCapacityBase = teamCapacityMax || 1;
  const totalTeamSeats = teamCapacity.reduce(
    (sum, team) => sum + team.committed + team.available,
    0,
  );
  const workforceGridLines = Array.from({ length: 5 }, (_, index) => (index / 4) * 100);
  const sortedTeamsBySize = [...teamCapacity].sort(
    (left, right) =>
      right.committed + right.available - (left.committed + left.available),
  );
  const highlightedTeams = sortedTeamsBySize.slice(0, 5);
  const remainingTeamSeats = sortedTeamsBySize.slice(5).reduce(
    (sum, team) => sum + team.committed + team.available,
    0,
  );
  const teamDistributionPalette = [
    "#6366f1",
    "#818cf8",
    "#0ea5e9",
    "#14b8a6",
    "#f97316",
    "#f43f5e",
  ];
  const teamShareAccumulator: {
    cursor: number;
    slices: string[];
    stats: TeamShareStat[];
  } = {
    cursor: 0,
    slices: [],
    stats: [],
  };
  if (totalTeamSeats > 0) {
    highlightedTeams.forEach((team, index) => {
      const total = team.committed + team.available;
      if (!total) {
        return;
      }
      const percent = (total / totalTeamSeats) * 100;
      const color = teamDistributionPalette[index % teamDistributionPalette.length];
      teamShareAccumulator.slices.push(
        `${color} ${teamShareAccumulator.cursor}% ${teamShareAccumulator.cursor + percent}%`,
      );
      teamShareAccumulator.stats.push({
        label: team.team,
        value: total,
        percent: Math.round(percent),
        color,
      });
      teamShareAccumulator.cursor += percent;
    });
    if (remainingTeamSeats > 0) {
      const percent = (remainingTeamSeats / totalTeamSeats) * 100;
      const color =
        teamDistributionPalette[teamShareAccumulator.stats.length % teamDistributionPalette.length];
      teamShareAccumulator.slices.push(
        `${color} ${teamShareAccumulator.cursor}% ${teamShareAccumulator.cursor + percent}%`,
      );
      teamShareAccumulator.stats.push({
        label: "Other teams",
        value: remainingTeamSeats,
        percent: Math.round(percent),
        color,
      });
      teamShareAccumulator.cursor += percent;
    }
  }
  const teamShareSlices = teamShareAccumulator.slices;
  const teamShareStats = teamShareAccumulator.stats;
  const teamShareBackground = teamShareSlices.length
    ? `conic-gradient(${teamShareSlices.join(", ")})`
    : "conic-gradient(#e2e8f0 0deg, #e2e8f0 360deg)";

  const gaugeValue = Math.min(Math.max(engagementGauge.value, 0), 100);
  const gaugeAngle = (gaugeValue / 100) * 360;
  const engagementPositive = !engagementGauge.change.startsWith("-");
  const todayLabel = formatFullDate(data.date);
  const workforceSubtitle = `${numberFormatter.format(data.coverageSummary.totalEmployees)} teammates tracked`;
  const coverageChangePositive = !data.coverageSummary.changeLabel.startsWith("-");
  const breakdownBase = Math.max(data.coverageSummary.totalEmployees, 1);
  const workforceCheckpointsLabel =
    workforcePoints.length === 1 ? "checkpoint" : "checkpoints";

  return (
    <div className="space-y-10 pb-12">
      <header className="rounded-[32px] border border-white/60 bg-white/90 p-8 shadow-xl shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              HR Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
              Mission Control for People Ops
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600 dark:text-slate-300">
              Keep attendance, approvals, and workforce health in one glance so the HR team can act before issues escalate.
            </p>
          </div>
          <div className="grid w-full max-w-sm grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-slate-600 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70 dark:text-slate-300">
              <p className="text-xs uppercase text-slate-400">Today</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{todayLabel}</p>
              <p>{workforceSubtitle}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-slate-600 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70 dark:text-slate-300">
              <p className="text-xs uppercase text-slate-400">Sync status</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {data.coverageSummary.syncedLabel}
              </p>
              <p>{data.coverageSummary.changeLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {statHighlights.map((card) => {
          const trendIsPositive = !card.trend.startsWith("-");
          return (
            <article
              key={card.label}
              className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-lg shadow-indigo-100 transition hover:-translate-y-1 hover:shadow-2xl dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/50"
            >
              <p className="text-xs uppercase text-slate-400">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-50">
                {card.value}
              </p>
              <p
                className={`mt-1 text-sm font-semibold ${trendIsPositive ? "text-emerald-500" : "text-rose-500"}`}
              >
                {card.trend}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{card.descriptor}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <article className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl transition-colors dark:border-slate-700/70 dark:bg-slate-900/80 xl:col-span-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase text-slate-400">Working format</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                Attendance mix
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                On-site vs remote presence compared to yesterday
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-200">
              Live
            </span>
          </div>
          {workingFormatStats.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
              Attendance data will appear once teammates check in.
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-6 lg:flex-row">
              <div className="flex items-center justify-center">
                <div className="relative h-36 w-36">
                  <div
                    className="h-full w-full rounded-full border border-white/50 bg-slate-100 shadow-inner dark:border-slate-800/70 dark:bg-slate-900/40"
                    style={{ backgroundImage: workingFormatDonutBackground }}
                    aria-hidden="true"
                  />
                  <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-lg dark:bg-slate-950">
                    <p className="text-3xl font-semibold text-slate-900 dark:text-white">
                      {workingFormatTotalLabel}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Check-ins
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 text-sm">
                {workingFormatStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100/80 bg-white px-3 py-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60"
                  >
                    <span
                      className="inline-block h-2.5 w-8 rounded-full"
                      style={{ backgroundColor: stat.color }}
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-50">
                        {stat.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {numberFormatter.format(stat.value)} • {stat.percent}%
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                      {stat.delta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl transition-colors dark:border-slate-700/70 dark:bg-slate-900/80 xl:col-span-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase text-slate-400">Capacity outlook</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                Plan vs actual staffing
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tracking {workforcePoints.length} {workforceCheckpointsLabel} across the period
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-slate-400">Variance</p>
              <p
                className={`text-base font-semibold ${workforceDelta >= 0 ? "text-emerald-500" : "text-rose-500"}`}
              >
                {workforceDelta >= 0 ? "+" : ""}
                {numberFormatter.format(workforceDelta)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Actual vs plan
              </p>
            </div>
          </div>
          {workforcePoints.length <= 1 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
              More capacity checkpoints are needed to draw the trendline.
            </div>
          ) : (
            <>
              <div className="mt-6 h-56 rounded-3xl bg-slate-50/80 p-4 dark:bg-slate-900/40">
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="h-full w-full"
                  role="img"
                  aria-label="Workforce plan vs actual chart"
                >
                  {workforceGridLines.map((y, index) => (
                    <line
                      // biome-ignore lint/suspicious/noArrayIndexKey: static grid
                      key={index}
                      x1="0"
                      x2="100"
                      y1={y}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth="0.3"
                      className="text-slate-200/80 dark:text-slate-800"
                    />
                  ))}
                  <path
                    d={workforcePlanPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    className="text-slate-400"
                  />
                  <path
                    d={workforceActualPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="text-indigo-500"
                  />
                  {workforcePlanPoints.map((point) => (
                    <circle
                      key={`plan-${point.label}`}
                      cx={point.x}
                      cy={point.y}
                      r={1}
                      className="fill-slate-400"
                    />
                  ))}
                  {workforceActualPoints.map((point) => (
                    <circle
                      key={`actual-${point.label}`}
                      cx={point.x}
                      cy={point.y}
                      r={1.4}
                      className="fill-indigo-500"
                    />
                  ))}
                </svg>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="inline-block h-2 w-8 rounded-full bg-indigo-500" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {workforceActualLabel}
                    </p>
                    <p className="text-xs text-slate-500">Actual headcount</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="inline-block h-2 w-8 rounded-full bg-slate-400" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {workforcePlanLabel}
                    </p>
                    <p className="text-xs text-slate-500">Planned capacity</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                {workforcePoints.map((point) => (
                  <span key={point.label} className="flex-1 text-center">
                    {point.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </article>

        <article className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl transition-colors dark:border-slate-700/70 dark:bg-slate-900/80 xl:col-span-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase text-slate-400">Engagement pulse</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                Workforce health
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Blend of attendance, utilization, and approvals
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${engagementPositive ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200" : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200"}`}
            >
              {engagementGauge.change}
            </span>
          </div>
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="relative h-40 w-40">
              <div
                className="h-full w-full rounded-full border border-white/50 bg-slate-100 shadow-inner dark:border-slate-800/70 dark:bg-slate-900/40"
                style={{
                  backgroundImage: `conic-gradient(#6366f1 ${gaugeAngle}deg, #cbd5f5 ${gaugeAngle}deg)`,
                }}
                aria-hidden="true"
              />
              <div className="absolute inset-9 flex flex-col items-center justify-center rounded-full bg-white text-center dark:bg-slate-950">
                <p className="text-4xl font-semibold text-slate-900 dark:text-white">
                  {gaugeValue}%
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Composite
                </p>
              </div>
            </div>
            <p className="max-w-xs text-center text-sm text-slate-500 dark:text-slate-400">
              Higher scores mean teams are showing up, assigned, and moving through approvals without delay.
            </p>
          </div>
          <ul className="mt-6 space-y-4 text-sm">
            {engagementSnapshot.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100/80 bg-white px-4 py-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60"
              >
                <div>
                  <p className="text-xs uppercase text-slate-400">{item.label}</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">
                    {item.value}
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.detail}
                </p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl transition-colors dark:border-slate-700/70 dark:bg-slate-900/80 xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase text-slate-400">Team capacity</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                Where teams are staffed
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {numberFormatter.format(totalTeamSeats)} total seats tracked today
              </p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-200">
              Capacity
            </span>
          </div>
          {teamCapacity.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
              Assign employees to teams to see real-time capacity.
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {teamCapacity.map((team) => {
                const total = team.committed + team.available;
                const committedPercent = Math.min(
                  (team.committed / teamCapacityBase) * 100,
                  100,
                );
                const availablePercent = Math.min(
                  (team.available / teamCapacityBase) * 100,
                  100,
                );
                return (
                  <div key={team.team}>
                    <div className="flex items-center justify-between text-sm">
                      <p className="font-semibold text-slate-900 dark:text-slate-50">
                        {team.team}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {numberFormatter.format(total)} teammates
                      </p>
                    </div>
                    <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <span
                        className="h-full bg-indigo-500"
                        style={{ width: `${committedPercent}%` }}
                      />
                      <span
                        className="h-full bg-slate-300 dark:bg-slate-600"
                        style={{ width: `${availablePercent}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Committed • {numberFormatter.format(team.committed)}</span>
                      <span>Available • {numberFormatter.format(team.available)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-6 flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-6 rounded-full bg-indigo-500" />
              Committed
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-6 rounded-full bg-slate-300 dark:bg-slate-600" />
              Available
            </span>
          </div>
        </article>

        <article className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl transition-colors dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase text-slate-400">Teams</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                Team distribution
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {totalTeamSeats > 0
                  ? `Share of ${numberFormatter.format(totalTeamSeats)} seats`
                  : "Assign teammates to teams to unlock insights."}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-200">
              Pie
            </span>
          </div>
          {teamShareStats.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
              Add employees to teams to visualize their share of today&rsquo;s capacity.
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-6">
              <div className="flex items-center justify-center">
                <div className="relative h-40 w-40 sm:h-48 sm:w-48">
                  <div
                    className="h-full w-full rounded-full border border-white/50 bg-slate-100 shadow-inner dark:border-slate-800/70 dark:bg-slate-900/40"
                    style={{ backgroundImage: teamShareBackground }}
                    aria-hidden="true"
                  />
                  <div className="absolute inset-8 sm:inset-10 flex flex-col items-center justify-center rounded-full bg-white text-center dark:bg-slate-950">
                    <p className="text-3xl font-semibold text-slate-900 dark:text-white">
                      {numberFormatter.format(totalTeamSeats)}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Seats
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {teamShareStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100/80 bg-white px-3 py-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60"
                  >
                    <span
                      className="inline-block h-2.5 w-8 rounded-full"
                      style={{ backgroundColor: stat.color }}
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-50">
                        {stat.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {numberFormatter.format(stat.value)} seats • {stat.percent}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl dark:border-slate-700/70 dark:bg-slate-900/80 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Today&rsquo;s Attendance
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                Live coverage overview
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {data.coverageSummary.syncedLabel} · Bio-metric + VPN sources
              </p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-4 text-right text-sm shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
              <p className="text-xs uppercase text-slate-400">Coverage</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {data.coverageSummary.percentLabel}
              </p>
              <p
                className={`text-xs font-semibold ${coverageChangePositive ? "text-emerald-500" : "text-rose-500"}`}
              >
                {data.coverageSummary.changeLabel}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {attendanceBreakdown.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-100/80 bg-white px-4 py-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60"
              >
                <p className="text-xs uppercase text-slate-400">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                  {item.value}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.delta}</p>
                <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-1.5 rounded-full bg-gradient-to-r ${item.gradient}`}
                    style={{ width: `${Math.min((item.value / breakdownBase) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Check-ins by hour
              </p>
              <p className="text-xs text-slate-400">On-site vs remote</p>
            </div>
            {attendanceTrend.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                No check-ins recorded for the selected day.
              </div>
            ) : (
              <div className="mt-4 flex h-48 items-end gap-4">
                {attendanceTrend.map((slot) => (
                  <div key={slot.hour} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-40 w-full flex-col justify-end gap-1 rounded-2xl bg-slate-50 p-2 dark:bg-slate-800/40">
                      <div
                        className="w-full rounded-xl bg-gradient-to-t from-emerald-500 to-emerald-300"
                        style={{ height: `${(slot.onsite / attendanceMax) * 100}%` }}
                      />
                      <div
                        className="w-full rounded-xl bg-gradient-to-t from-sky-500 to-sky-300"
                        style={{ height: `${(slot.remote / attendanceMax) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {slot.hour}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Today&rsquo;s attendance log
              </h3>
              <p className="text-xs text-slate-400">Showing most recent</p>
            </div>
            {attendanceLog.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800">
                No attendance events have been logged today yet.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {attendanceLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100/80 bg-white px-4 py-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {entry.name}
                      </p>
                      <p className="text-xs text-slate-500">{entry.department}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${attendanceStateStyles[entry.state]}`}
                      >
                        {entry.status}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                          {entry.checkIn}
                        </p>
                        <p className="text-xs text-slate-500">{entry.method}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-400">Leave queue</p>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                Employee approvals
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {leaveApprovals.length} leave requests waiting on HR
              </p>
            </div>
            <span className="rounded-full bg-indigo-50 px-4 py-1 text-xs font-semibold text-indigo-600 dark:bg-slate-800 dark:text-sky-200">
              Prioritize
            </span>
          </div>
          {leaveActionMessage && (
            <div
              className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                leaveActionMessage.type === "success"
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                  : "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
              }`}
            >
              {leaveActionMessage.text}
            </div>
          )}
          {leaveApprovals.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
              No leave requests require attention right now.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {leaveApprovals.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-slate-100/80 bg-white p-4 text-sm shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {request.name}
                      </p>
                      <p className="text-xs text-slate-500">{request.role}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      {request.type}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-3 text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Duration</dt>
                      <dd className="font-semibold text-slate-900 dark:text-slate-50">
                        {request.duration}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Balance</dt>
                      <dd className="font-semibold text-slate-900 dark:text-slate-50">
                        {request.balance}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Coverage</dt>
                      <dd>{request.coverage}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Submitted</dt>
                      <dd>{request.submitted}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      className="px-4 py-2 text-xs font-semibold"
                      onClick={() => handleLeaveAction(request.id, "APPROVED")}
                      disabled={
                        processingLeaveId === request.id && processingLeaveStatus === "APPROVED"
                      }
                    >
                      {processingLeaveId === request.id && processingLeaveStatus === "APPROVED"
                        ? "Approving..."
                        : "Approve"}
                    </Button>
                    <button
                      type="button"
                      onClick={() =>
                        handleLeaveAction(request.id, "DENIED", REJECTION_NOTE)
                      }
                      disabled={
                        processingLeaveId === request.id && processingLeaveStatus === "DENIED"
                      }
                      className="rounded-full border border-slate-200/70 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
                    >
                      {processingLeaveId === request.id && processingLeaveStatus === "DENIED"
                        ? "Rejecting..."
                        : "Reject"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
