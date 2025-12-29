"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MdDeleteForever } from "react-icons/md";

import Text from "@/app/components/atoms/Text/Text";
import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import SelectBox from "@/app/components/atoms/selectBox/SelectBox";
import TextArea from "@/app/components/atoms/inputs/TextArea";
import { EmployeeHeader } from "@/app/components/layouts/EmployeeHeader";
import { trpc } from "@/trpc/client";

type DailyEntry = {
  id: number;
  workType: string;
  taskName: string;
  others: string;
  details: string;
  workingHours: string;
};

const workTypeOptions = [
  { label: "Project", value: "Project" },
  { label: "Design", value: "Design" },
  { label: "Development", value: "Development" },
  { label: "Testing", value: "Testing" },
  { label: "Support", value: "Support" },
  { label: "Research", value: "Research" },
];

const buildEmptyEntry = (id: number): DailyEntry => ({
  id,
  workType: "",
  taskName: "",
  others: "",
  details: "",
  workingHours: "",
});

function DailyReportPage() {
  const router = useRouter();
  const defaultDate = useMemo(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }, []);

  const [reportDate, setReportDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<DailyEntry[]>([buildEmptyEntry(1)]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const submitDailyMutation = trpc.report.submitDaily.useMutation({
    onSuccess: () => {
      setFeedback({
        type: "success",
        message: "Daily report saved. Visit history to review past submissions.",
      });
      setEntries([buildEmptyEntry(1)]);
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: error.message || "Failed to submit report. Please try again.",
      });
    },
  });

  const handleAddEntry = () => {
    setEntries((prev) => [...prev, buildEmptyEntry(prev.length + 1)]);
  };

  const handleRemoveEntry = (id: number) => {
    if (entries.length === 1) {
      return;
    }
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const updateEntry = (id: number, field: keyof DailyEntry, value: string) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)),
    );
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setFeedback(null);

    const meaningfulEntries = entries.filter(
      (entry) =>
        entry.workType ||
        entry.taskName.trim() ||
        entry.details.trim() ||
        entry.workingHours.trim(),
    );

    if (meaningfulEntries.length === 0) {
      setFeedback({
        type: "error",
        message: "Add at least one task before submitting your daily report.",
      });
      return;
    }

    const payload = [];
    for (const entry of meaningfulEntries) {
      const workingHours = Number.parseFloat(entry.workingHours);
      if (
        !entry.workType ||
        !entry.taskName.trim() ||
        !entry.details.trim() ||
        !Number.isFinite(workingHours) ||
        workingHours <= 0
      ) {
        setFeedback({
          type: "error",
          message: "Each task needs a work type, task name, details, and working hours (> 0).",
        });
        return;
      }
      payload.push({
        workType: entry.workType,
        taskName: entry.taskName.trim(),
        others: entry.others.trim() || undefined,
        details: entry.details.trim(),
        workingHours,
      });
    }

    await submitDailyMutation.mutateAsync({
      reportDate,
      note: note.trim() || undefined,
      entries: payload,
    });
  };

  return (
    <div className="flex w-full flex-col gap-10">
      <EmployeeHeader
        hasRightButton
        buttonText="History"
        onButtonClick={() => router.push("/report/daily/history")}
      />
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-6 rounded-[32px] border border-white/60 bg-white/85 p-8 shadow-xl shadow-indigo-100 transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Text
              text="Daily Report"
              className="text-[24px] font-semibold text-slate-900 dark:text-slate-100"
            />
            <Text text="Share what you worked on today." className="text-text_primary dark:text-slate-300" />
          </div>
          <TextInput
            label="Report Date"
            type="date"
            value={reportDate}
            isRequired
            onChange={(event) => setReportDate(event.target.value)}
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
            className="relative mb-4 grid grid-cols-1 gap-6 border-b border-slate-200 pb-6 transition-colors duration-200 md:grid-cols-2 dark:border-slate-700/60"
          >
            <div className="col-span-2 flex items-center justify-between">
              <Text
                text={`Task ${index + 1}`}
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => handleRemoveEntry(entry.id)}
                disabled={entries.length === 1}
                className="text-[26px] text-slate-400 transition-colors duration-150 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-500"
                aria-label={`Delete task ${index + 1}`}
              >
                <MdDeleteForever />
              </button>
            </div>
            <SelectBox
              label="Work Type"
              options={workTypeOptions}
              isRequired
              value={entry.workType}
              onChange={(event) => updateEntry(entry.id, "workType", event.target.value)}
            />
            <TextInput
              label="Task Name / Project"
              placeholder="Enter task name"
              isRequired
              value={entry.taskName}
              onChange={(event) => updateEntry(entry.id, "taskName", event.target.value)}
            />
            <TextInput
              label="Others / Notes"
              placeholder="Client call, blockers, etc."
              value={entry.others}
              onChange={(event) => updateEntry(entry.id, "others", event.target.value)}
            />
            <TextInput
              label="Working Hours"
              placeholder="e.g. 2.5"
              isRequired
              type="number"
              value={entry.workingHours}
              onChange={(event) => updateEntry(entry.id, "workingHours", event.target.value)}
            />
            <TextArea
              label="Details"
              placeholder="Describe what was completed"
              isRequired
              value={entry.details}
              onChange={(event) => updateEntry(entry.id, "details", event.target.value)}
              className="md:col-span-2"
            />
          </div>
        ))}

        <Button
          theme="secondary"
          className="w-[200px]"
          type="button"
          onClick={handleAddEntry}
          disabled={submitDailyMutation.isPending}
        >
          <Text text="Add Task" className="font-semibold" />
        </Button>

        <div className="grid gap-6 md:grid-cols-2">
          <TextArea
            label="Additional Notes"
            placeholder="Share blockers or context for your manager (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="md:col-span-2"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <Button
            type="submit"
            className="w-[185px]"
            disabled={submitDailyMutation.isPending}
          >
            <Text
              text={submitDailyMutation.isPending ? "Submitting..." : "Submit"}
              className="font-semibold"
            />
          </Button>
          <Button
            theme="cancel"
            type="button"
            className="w-[185px]"
            onClick={() => router.push("/report/daily/history")}
            disabled={submitDailyMutation.isPending}
          >
            <Text text="View History" className="font-semibold" />
          </Button>
        </div>
      </form>
    </div>
  );
}

export default DailyReportPage;
