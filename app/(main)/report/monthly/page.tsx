"use client";

import { useMemo, useState } from "react";
import { MdDeleteForever } from "react-icons/md";
import { useRouter } from "next/navigation";

import { EmployeeHeader } from "@/app/components/layouts/EmployeeHeader";
import Text from "@/app/components/atoms/Text/Text";
import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import { trpc } from "@/trpc/client";

type MonthlyEntry = {
  id: number;
  taskName: string;
  storyPoint: string;
  workingHours: string;
};

const buildMonthlyEntry = (id: number): MonthlyEntry => ({
  id,
  taskName: "",
  storyPoint: "",
  workingHours: "",
});

export default function MonthlyReportApplication() {
  const router = useRouter();
  const defaultMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [reportMonth, setReportMonth] = useState(defaultMonth);
  const [entries, setEntries] = useState<MonthlyEntry[]>([buildMonthlyEntry(1)]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const submitMonthlyMutation = trpc.report.submitMonthly.useMutation({
    onSuccess: () => {
      setFeedback({
        type: "success",
        message: "Monthly summary saved successfully.",
      });
      setEntries([buildMonthlyEntry(1)]);
    },
    onError: (error) =>
      setFeedback({
        type: "error",
        message: error.message || "Unable to submit monthly report.",
      }),
  });

  const addEntry = () => setEntries((prev) => [...prev, buildMonthlyEntry(prev.length + 1)]);
  const removeEntry = (id: number) => {
    if (entries.length === 1) return;
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };
  const updateEntry = (id: number, field: keyof MonthlyEntry, value: string) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)),
    );
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setFeedback(null);
    const meaningful = entries.filter(
      (entry) => entry.taskName.trim() || entry.storyPoint.trim() || entry.workingHours.trim(),
    );
    if (meaningful.length === 0) {
      setFeedback({
        type: "error",
        message: "Add at least one ticket or task before submitting.",
      });
      return;
    }
    const payload = [];
    for (const entry of meaningful) {
      const storyPoint = Number.parseFloat(entry.storyPoint || "0");
      const workingHours = Number.parseFloat(entry.workingHours);
      if (!entry.taskName.trim() || workingHours <= 0 || !Number.isFinite(workingHours)) {
        setFeedback({
          type: "error",
          message: "Each entry needs a task name and working hours greater than zero.",
        });
        return;
      }
      payload.push({
        taskName: entry.taskName.trim(),
        storyPoint: Number.isFinite(storyPoint) ? storyPoint : 0,
        workingHours,
      });
    }
    await submitMonthlyMutation.mutateAsync({
      reportMonth,
      entries: payload,
    });
  };

  return (
    <div className="flex w-full flex-col gap-10">
      <EmployeeHeader
        hasRightButton
        buttonText="History"
        onButtonClick={() => router.push("/report/monthly/history")}
      />
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-6 rounded-[32px] border border-white/60 bg-white/85 p-8 shadow-xl shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Text
              text="Monthly Report"
              className="text-[24px] font-semibold text-slate-900 dark:text-slate-100"
            />
            <Text
              text="Summarize shipped work for the selected month."
              className="text-text_primary dark:text-slate-300"
            />
          </div>
          <TextInput
            label="Reporting Month"
            type="month"
            value={reportMonth}
            isRequired
            onChange={(event) => setReportMonth(event.target.value)}
            className="w-full md:w-60"
          />
        </div>

        {feedback && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              feedback.type === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="rounded-3xl border border-slate-100 bg-white/70 p-6 shadow-sm shadow-slate-200/40 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/40"
          >
            <div className="mb-4 flex items-center justify-between">
              <Text
                text={`Entry ${index + 1}`}
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                aria-label={`Remove entry ${index + 1}`}
                className="text-[28px] text-slate-400 transition-colors duration-150 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-500"
                onClick={() => removeEntry(entry.id)}
                disabled={entries.length === 1}
              >
                <MdDeleteForever />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <TextInput
                label="Task Name / Ticket"
                placeholder="Enter ticket or initiative"
                isRequired
                value={entry.taskName}
                onChange={(event) => updateEntry(entry.id, "taskName", event.target.value)}
              />
              <TextInput
                label="Story Points"
                type="number"
                placeholder="e.g. 8"
                value={entry.storyPoint}
                onChange={(event) => updateEntry(entry.id, "storyPoint", event.target.value)}
              />
              <TextInput
                label="Working Hours"
                type="number"
                placeholder="Total hours spent"
                isRequired
                value={entry.workingHours}
                onChange={(event) => updateEntry(entry.id, "workingHours", event.target.value)}
              />
            </div>
          </div>
        ))}

        <Button
          theme="secondary"
          type="button"
          className="w-[200px]"
          onClick={addEntry}
          disabled={submitMonthlyMutation.isPending}
        >
          <Text text="Add Another Entry" className="font-semibold" />
        </Button>

        <div className="mt-6 flex flex-wrap gap-4">
          <Button
            type="submit"
            className="w-[185px]"
            disabled={submitMonthlyMutation.isPending}
          >
            <Text
              text={submitMonthlyMutation.isPending ? "Submitting..." : "Submit"}
              className="font-semibold"
            />
          </Button>
          <Button
            theme="cancel"
            type="button"
            className="w-[185px]"
            onClick={() => router.push("/report/monthly/history")}
            disabled={submitMonthlyMutation.isPending}
          >
            <Text text="View History" className="font-semibold" />
          </Button>
        </div>
      </form>
    </div>
  );
}
