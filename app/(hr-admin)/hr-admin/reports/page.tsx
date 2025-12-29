"use client";

import { useMemo, useState } from "react";
import { MdDownload } from "react-icons/md";

import Button from "@/app/components/atoms/buttons/Button";
import Text from "@/app/components/atoms/Text/Text";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import TextFeild from "@/app/components/atoms/TextFeild/TextFeild";
import SelectBox from "@/app/components/atoms/selectBox/SelectBox";
import { Table } from "@/app/components/atoms/tables/Table";
import Pagination from "@/app/components/pagination/Pagination";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { exportToExcel } from "@/lib/export-to-excel";
import { trpc } from "@/trpc/client";

type TableRow = Record<string, string | number>;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

const buildDefaultFilters = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    employeeId: "",
    search: "",
  };
};

type TrendPoint = {
  label: string;
  [key: string]: unknown;
};

type TrendChartProps = {
  title: string;
  metricLabel: string;
  points: TrendPoint[];
  valueKey: string;
  valueFormatter?: (value: number) => string;
  accent: string;
};

const TrendChart = ({
  title,
  metricLabel,
  points,
  valueKey,
  valueFormatter = (value) => value.toFixed(0),
  accent,
}: TrendChartProps) => {
  if (!points || points.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-sm text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-400">
        Not enough data to chart {metricLabel.toLowerCase()}.
      </div>
    );
  }
  const maxValue = Math.max(...points.map((point) => Number(point[valueKey] ?? 0)), 0);
  if (maxValue === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-sm text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-400">
        All values are zero for this period.
      </div>
    );
  }
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-inner shadow-indigo-50/60 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/50">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
            {metricLabel}
          </p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        </div>
      </div>
      <div className="flex h-40 items-end gap-3 overflow-x-auto">
        {points.map((point, index) => {
          const value = Number(point[valueKey] ?? 0);
          const height = Math.max(12, (value / maxValue) * 140);
          return (
            <div
              key={`${valueKey}-${point.label}-${index}`}
              className="flex flex-col items-center gap-2 text-xs text-slate-500"
            >
              <div
                className="w-5 rounded-full bg-gradient-to-t from-transparent to-current"
                style={{
                  height,
                  color: accent,
                  backgroundColor: accent,
                  backgroundImage: `linear-gradient(to top, ${accent}33, ${accent})`,
                }}
              />
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {valueFormatter(value)}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function HrAdminReportsPage() {
  const [filters, setFilters] = useState(buildDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [dailySort, setDailySort] = useState<"recent" | "hours" | "entries">("recent");
  const [monthlySort, setMonthlySort] = useState<"recent" | "story" | "hours">("recent");
  const [dailyRows, setDailyRows] = useState<TableRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<TableRow[]>([]);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const queryInput = useMemo(
    () => ({
      startDate: appliedFilters.startDate,
      endDate: appliedFilters.endDate,
      employeeId: appliedFilters.employeeId || undefined,
      search: appliedFilters.search || undefined,
    }),
    [appliedFilters],
  );

  const { data, isLoading, isFetching } = trpc.hrReport.overview.useQuery(queryInput, {
    refetchOnWindowFocus: false,
  });

  const employeeOptions =
    data?.filters.employees.map((employee) => ({
      label: employee.name,
      value: employee.id,
    })) ?? [];

  const sortedDailyRows = useMemo(() => {
    if (!data?.daily.rows) {
      return [];
    }
    const result = [...data.daily.rows];
    switch (dailySort) {
      case "hours":
        result.sort((a, b) => b.totalWorkingHours - a.totalWorkingHours);
        break;
      case "entries":
        result.sort((a, b) => b.entryCount - a.entryCount);
        break;
      default:
        result.sort(
          (a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime(),
        );
    }
    return result;
  }, [data?.daily.rows, dailySort]);

  const sortedMonthlyRows = useMemo(() => {
    if (!data?.monthly.rows) {
      return [];
    }
    const result = [...data.monthly.rows];
    switch (monthlySort) {
      case "story":
        result.sort((a, b) => b.totalStoryPoints - a.totalStoryPoints);
        break;
      case "hours":
        result.sort((a, b) => b.totalWorkingHours - a.totalWorkingHours);
        break;
      default:
        result.sort(
          (a, b) => new Date(b.reportMonth).getTime() - new Date(a.reportMonth).getTime(),
        );
    }
    return result;
  }, [data?.monthly.rows, monthlySort]);

  const dailyTableRows = useMemo<TableRow[]>(() => {
    return sortedDailyRows.map((row) => ({
      Date: dateFormatter.format(new Date(row.reportDate)),
      Employee: row.employeeName,
      "Tasks Logged": row.entryCount,
      "Work Types": row.workTypes.join(", ") || "—",
      Hours: row.totalWorkingHours.toFixed(2),
    }));
  }, [sortedDailyRows]);

  const monthlyTableRows = useMemo<TableRow[]>(() => {
    return sortedMonthlyRows.map((row) => ({
      Month: monthFormatter.format(new Date(row.reportMonth)),
      Employee: row.employeeName,
      Entries: row.entryCount,
      "Story Points": row.totalStoryPoints.toFixed(2),
      Hours: row.totalWorkingHours.toFixed(2),
    }));
  }, [sortedMonthlyRows]);

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
  };

  const handleResetFilters = () => {
    const defaults = buildDefaultFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
  };

  const handleDownload = (
    rows: TableRow[],
    fileName: string,
    options: { title: string; columns: { key: string; label: string; width?: number }[] },
  ) => {
    if (rows.length === 0) {
      setDownloadError("No rows are available to download right now.");
      return;
    }
    setDownloadError(null);
    try {
      exportToExcel(rows, {
        fileName,
        sheetName: "Report",
        title: options.title,
        autoFilter: true,
        columns: options.columns,
      });
    } catch (error) {
      setDownloadError((error as Error).message ?? "Failed to export Excel file.");
    }
  };

  return (
    <div className="space-y-10">
      <header className="rounded-[32px] border border-white/60 bg-white/90 p-8 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Reports & Analytics
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Track organisation-wide reporting habits and delivery cadence.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
            {isFetching ? "Refreshing..." : "Live overview"}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <TextInput
            label="Start Date"
            type="date"
            value={filters.startDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
          />
          <TextInput
            label="End Date"
            type="date"
            value={filters.endDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
          />
          <TextInput
            label="Search"
            placeholder="Employee, project, keyword"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />
          <SelectBox
            label="Employee"
            options={employeeOptions}
            includePlaceholder
            placeholderLabel="All employees"
            value={filters.employeeId}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, employeeId: event.target.value }))
            }
            name="employee-filter"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <Button type="button" theme="secondary" onClick={handleApplyFilters} className="w-40">
            <Text text="Apply Filters" className="font-semibold" />
          </Button>
          <Button
            type="button"
            theme="cancel-secondary"
            onClick={handleResetFilters}
            className="w-32"
          >
            <Text text="Reset" className="font-semibold" />
          </Button>
        </div>
        {downloadError && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {downloadError}
          </div>
        )}
      </header>

      {isLoading || !data ? (
        <LoadingSpinner label="Loading reports overview..." helper="Aggregating daily and monthly submissions." />
      ) : (
        <>
          <section className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
                  Daily overview
                </p>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Daily submissions
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <SelectBox
                  label="Sort"
                  includePlaceholder={false}
                  name="daily-sort"
                  options={[
                    { label: "Newest first", value: "recent" },
                    { label: "Most hours", value: "hours" },
                    { label: "Most tasks", value: "entries" },
                  ]}
                  value={dailySort}
                  onChange={(event) => setDailySort(event.target.value as typeof dailySort)}
                  className="w-48"
                />
                <Button
                  type="button"
                  theme="secondary"
                  className="w-48 gap-2"
                  onClick={() =>
                    handleDownload(dailyTableRows, "hr-daily-reports", {
                      title: "Daily report submissions",
                      columns: [
                        { key: "Date", label: "Date", width: 16 },
                        { key: "Employee", label: "Employee", width: 24 },
                        { key: "Tasks Logged", label: "Tasks Logged", width: 18 },
                        { key: "Work Types", label: "Work Types", width: 24 },
                        { key: "Hours", label: "Hours", width: 12 },
                      ],
                    })
                  }
                  disabled={dailyTableRows.length === 0}
                >
                  <MdDownload size={18} />
                  <Text text="Download daily" className="font-semibold" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TextFeild
                label="Reports logged"
                text={data.daily.totals.reports.toString()}
                className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-inner shadow-white/40 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/40"
              />
              <TextFeild
                label="Hours captured"
                text={data.daily.totals.hours.toFixed(2)}
                className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-inner shadow-white/40 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/40"
              />
              <TextFeild
                label="Current range"
                text={`${
                  appliedFilters.startDate
                    ? dateFormatter.format(new Date(appliedFilters.startDate))
                    : "—"
                } → ${
                  appliedFilters.endDate
                    ? dateFormatter.format(new Date(appliedFilters.endDate))
                    : "—"
                }`}
                className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-inner shadow-white/40 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/40"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TrendChart
                title="Hours trend"
                metricLabel="Daily hours"
                points={data.daily.trend}
                valueKey="hours"
                valueFormatter={(value) => `${value.toFixed(1)}h`}
                accent="#0DBAD2"
              />
              <TrendChart
                title="Submission count"
                metricLabel="Reports per day"
                points={data.daily.trend}
                valueKey="reports"
                accent="#6366F1"
              />
            </div>

            {dailyTableRows.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-slate-300 bg-white/80 p-10 text-center text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-400">
                No daily reports match your filters.
              </div>
            ) : (
              <>
                <Table
                  headers={["Date", "Employee", "Tasks Logged", "Work Types", "Hours"]}
                  rows={dailyRows}
                />
                <Pagination
                  data={dailyTableRows}
                  postsPerPage={8}
                  setCurrentPageData={setDailyRows}
                />
              </>
            )}
          </section>

          <section className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
                  Monthly overview
                </p>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Monthly summaries
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <SelectBox
                  label="Sort"
                  includePlaceholder={false}
                  name="monthly-sort"
                  options={[
                    { label: "Newest first", value: "recent" },
                    { label: "Most story points", value: "story" },
                    { label: "Most hours", value: "hours" },
                  ]}
                  value={monthlySort}
                  onChange={(event) => setMonthlySort(event.target.value as typeof monthlySort)}
                  className="w-48"
                />
                <Button
                  type="button"
                  theme="secondary"
                  className="w-48 gap-2"
                  onClick={() =>
                    handleDownload(monthlyTableRows, "hr-monthly-reports", {
                      title: "Monthly report summaries",
                      columns: [
                        { key: "Month", label: "Month", width: 18 },
                        { key: "Employee", label: "Employee", width: 24 },
                        { key: "Entries", label: "Entries", width: 12 },
                        { key: "Story Points", label: "Story Points", width: 16 },
                        { key: "Hours", label: "Hours", width: 12 },
                      ],
                    })
                  }
                  disabled={monthlyTableRows.length === 0}
                >
                  <MdDownload size={18} />
                  <Text text="Download monthly" className="font-semibold" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TextFeild
                label="Reports logged"
                text={data.monthly.totals.reports.toString()}
                className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-inner shadow-white/40 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/40"
              />
              <TextFeild
                label="Story points"
                text={data.monthly.totals.storyPoints.toFixed(2)}
                className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-inner shadow-white/40 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/40"
              />
              <TextFeild
                label="Hours captured"
                text={data.monthly.totals.hours.toFixed(2)}
                className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-inner shadow-white/40 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/40"
              />
            </div>

            <TrendChart
              title="Story point velocity"
              metricLabel="Monthly trend"
              points={data.monthly.trend}
              valueKey="storyPoints"
              valueFormatter={(value) => value.toFixed(1)}
              accent="#F97316"
            />

            {monthlyTableRows.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-slate-300 bg-white/80 p-10 text-center text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-400">
                No monthly summaries match your filters.
              </div>
            ) : (
              <>
                <Table
                  headers={["Month", "Employee", "Entries", "Story Points", "Hours"]}
                  rows={monthlyRows}
                />
                <Pagination
                  data={monthlyTableRows}
                  postsPerPage={8}
                  setCurrentPageData={setMonthlyRows}
                />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
