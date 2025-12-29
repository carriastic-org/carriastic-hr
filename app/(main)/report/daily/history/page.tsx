"use client";

import { useMemo, useState } from "react";
import { MdDownload } from "react-icons/md";

import Text from "@/app/components/atoms/Text/Text";
import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import { Table } from "@/app/components/atoms/tables/Table";
import TextFeild from "@/app/components/atoms/TextFeild/TextFeild";
import Pagination from "@/app/components/pagination/Pagination";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { exportToExcel } from "@/lib/export-to-excel";
import { trpc } from "@/trpc/client";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const hoursFormatter = (value: number) => `${value.toFixed(2)}h`;

type TableRow = Record<string, string | number>;

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const buildDefaultFilters = () => {
  const today = new Date();
  const todayValue = formatDateInput(today);
  return {
    startDate: todayValue,
    endDate: todayValue,
    search: "",
    sort: "recent" as "recent" | "oldest",
  };
};

export default function DailyReportHistory() {
  const [filters, setFilters] = useState(buildDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [visibleRows, setVisibleRows] = useState<TableRow[]>([]);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const queryInput = useMemo(
    () => ({
      pageSize: 200,
      page: 1,
      sort: appliedFilters.sort,
      search: appliedFilters.search || undefined,
      startDate: appliedFilters.startDate || undefined,
      endDate: appliedFilters.endDate || undefined,
    }),
    [appliedFilters],
  );

  const { data, isLoading, isFetching } = trpc.report.dailyHistory.useQuery(queryInput, {
    refetchOnWindowFocus: false,
  });

  const tableRows = useMemo<TableRow[]>(() => {
    if (!data?.items) {
      return [];
    }
    return data.items.flatMap((report) =>
      report.entries.map((entry) => ({
        Date: dateFormatter.format(new Date(report.reportDate)),
        "Work Type": entry.workType,
        "Task / Project": entry.taskName,
        Details: entry.details,
        Notes: entry.others ?? "—",
        Hours: Number(entry.workingHours.toFixed(2)),
      })),
    );
  }, [data]);

  const totalHours = data?.totals.workingHours ?? 0;
  const totalEntries = data?.totals.entryCount ?? 0;

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    const defaults = buildDefaultFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
  };

  const handleDownload = async () => {
    if (tableRows.length === 0) {
      setDownloadError("No records available to download.");
      return;
    }
    setDownloadError(null);
    try {
      exportToExcel(tableRows, {
        fileName: "daily-report-history",
        sheetName: "Daily Reports",
      });
    } catch (error) {
      setDownloadError((error as Error).message ?? "Failed to prepare Excel file.");
    }
  };

  return (
    <div className="flex w-full flex-col gap-10">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Text
            text="Daily Report History"
            className="text-[30px] font-semibold text-slate-900 dark:text-slate-100"
          />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Filter, review, and download your past daily submissions.
          </p>
        </div>
        <Button
          type="button"
          className="w-full gap-2 lg:w-auto"
          theme="secondary"
          onClick={handleDownload}
          disabled={isFetching || isLoading || tableRows.length === 0}
        >
          <MdDownload size={18} />
          <Text text="Download as Excel" className="font-semibold" />
        </Button>
      </div>

      {downloadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {downloadError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <TextInput
          label="Report Date"
          type="date"
          value={filters.startDate}
          onChange={(event) => {
            const value = event.target.value;
            setFilters((prev) => {
              const next = {
                ...prev,
                startDate: value,
                endDate: value,
              };
              setAppliedFilters(next);
              return next;
            });
          }}
        />
        <TextInput
          label="Search"
          placeholder="Task, work type, notes..."
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
        />
        <div className="flex flex-col">
          <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
            Sort
          </label>
          <select
            className="h-[40px] rounded-lg border border-white/60 bg-white px-4 text-[16px] text-text_primary shadow-sm shadow-slate-200/70 transition-colors duration-200 focus:outline-none hover:cursor-pointer dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-900/40"
            value={filters.sort}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, sort: event.target.value as "recent" | "oldest" }))
            }
          >
            <option value="recent">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <Button type="button" className="w-[180px]" onClick={applyFilters} theme="secondary">
          <Text text="Apply Filters" className="font-semibold" />
        </Button>
        <Button
          type="button"
          className="w-[140px]"
          theme="cancel-secondary"
          onClick={resetFilters}
        >
          <Text text="Reset" className="font-semibold" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TextFeild
          label="Total Entries"
          text={totalEntries.toString()}
          className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-inner shadow-white/40 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/40"
        />
        <TextFeild
          label="Hours Logged"
          text={hoursFormatter(totalHours)}
          className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-inner shadow-white/40 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/40"
        />
        <TextFeild
          label="Current Range"
          text={`${
            appliedFilters.startDate ? dateFormatter.format(new Date(appliedFilters.startDate)) : "—"
          } → ${
            appliedFilters.endDate ? dateFormatter.format(new Date(appliedFilters.endDate)) : "—"
          }`}
          className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-inner shadow-white/40 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/40"
        />
      </div>

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-lg shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/70">
          <LoadingSpinner label="Loading daily report history..." helper="Fetching your daily report history"/>
        </div>
      ) : tableRows.length === 0 ? (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-white/70 p-10 text-center text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-400">
          No daily reports found for the selected filters.
        </div>
      ) : (
        <>
          <Table
            headers={["Date", "Work Type", "Task / Project", "Details", "Notes", "Hours"]}
            rows={visibleRows}
          />
          <Pagination data={tableRows} postsPerPage={10} setCurrentPageData={setVisibleRows} />
        </>
      )}
    </div>
  );
}
