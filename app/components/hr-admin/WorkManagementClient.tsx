"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit3,
} from "react-icons/fi";

import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import TextArea from "@/app/components/atoms/inputs/TextArea";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import type { HrWorkPolicy, WeekdayOption } from "@/types/hr-work";
import { WEEKDAY_OPTIONS } from "@/types/hr-work";
import { trpc } from "@/trpc/client";

type AlertState = { type: "success" | "error"; message: string } | null;

const capitals = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const formatDayLabel = (day: string) =>
  day
    .split("_")
    .map((piece) => capitals(piece))
    .join(" ");

const AlertBanner = ({ alert }: { alert: AlertState }) => {
  if (!alert) return null;
  const Icon = alert.type === "success" ? FiCheckCircle : FiAlertCircle;
  const baseClasses =
    alert.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${baseClasses}`}>
      <Icon className="text-base" />
      <p className="font-semibold">{alert.message}</p>
    </div>
  );
};

const HolidayCard = ({
  title,
  helper,
  description,
}: {
  title: string;
  helper: string;
  description: string | null;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
    <p className="text-base font-semibold text-slate-900 dark:text-white">{title}</p>
    <p className="text-sm text-slate-500 dark:text-slate-300">{helper}</p>
    {description ? (
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>
    ) : null}
  </div>
);

const WeekdayToggle = ({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
      isActive
        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400/80 dark:bg-indigo-500/10 dark:text-indigo-200"
        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-200"
    }`}
  >
    {label}
  </button>
);

export default function WorkManagementClient() {
  const utils = trpc.useUtils();
  const overviewQuery = trpc.hrWork.overview.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const createHolidayMutation = trpc.hrWork.createHoliday.useMutation();
  const updateHoursMutation = trpc.hrWork.updateWorkingHours.useMutation();
  const updateWeekMutation = trpc.hrWork.updateWeekSchedule.useMutation();

  const data = overviewQuery.data;
  const canManage = data?.canManage ?? false;

  const [alert, setAlert] = useState<AlertState>(null);
  const [holidayForm, setHolidayForm] = useState({
    title: "",
    date: "",
    description: "",
  });
  const [hoursDraft, setHoursDraft] = useState<Partial<HrWorkPolicy>>({});
  const [workingDraft, setWorkingDraft] = useState<WeekdayOption[] | null>(null);
  const [weekendDraft, setWeekendDraft] = useState<WeekdayOption[] | null>(null);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), 5000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  const basePolicy = data?.policy;
  const mergedPolicy = useMemo<HrWorkPolicy>(
    () => ({
      onsiteStartTime: hoursDraft.onsiteStartTime ?? basePolicy?.onsiteStartTime ?? "09:00",
      onsiteEndTime: hoursDraft.onsiteEndTime ?? basePolicy?.onsiteEndTime ?? "18:00",
      remoteStartTime: hoursDraft.remoteStartTime ?? basePolicy?.remoteStartTime ?? "08:00",
      remoteEndTime: hoursDraft.remoteEndTime ?? basePolicy?.remoteEndTime ?? "17:00",
      workingDays: basePolicy?.workingDays ?? ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      weekendDays: basePolicy?.weekendDays ?? ["SATURDAY", "SUNDAY"],
    }),
    [basePolicy, hoursDraft],
  );

  const workingDays: WeekdayOption[] = workingDraft ?? mergedPolicy.workingDays;
  const weekendDays: WeekdayOption[] = weekendDraft ?? mergedPolicy.weekendDays;

  const weekOptions = useMemo(
    () =>
      WEEKDAY_OPTIONS.map((day) => ({
        value: day as WeekdayOption,
        label: formatDayLabel(day),
      })),
    [],
  );

  const toggleDay = (day: WeekdayOption, target: "working" | "weekend") => {
    if (target === "working") {
      const current = workingDraft ?? mergedPolicy.workingDays;
      const updated = current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day];
      setWorkingDraft(updated);
      setWeekendDraft((prev) => (prev ?? mergedPolicy.weekendDays).filter((item) => item !== day));
    } else {
      const current = weekendDraft ?? mergedPolicy.weekendDays;
      const updated = current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day];
      setWeekendDraft(updated);
      setWorkingDraft((prev) => (prev ?? mergedPolicy.workingDays).filter((item) => item !== day));
    }
  };

  const handleCreateHoliday = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createHolidayMutation.mutate(
      {
        title: holidayForm.title,
        date: holidayForm.date,
        description: holidayForm.description || undefined,
      },
      {
        onSuccess: () => {
          setHolidayForm({ title: "", date: "", description: "" });
          setAlert({ type: "success", message: "Holiday added to the org calendar." });
          void utils.hrWork.overview.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
      },
    );
  };

  const handleUpdateHours = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateHoursMutation.mutate(
      {
        onsiteStartTime: mergedPolicy.onsiteStartTime,
        onsiteEndTime: mergedPolicy.onsiteEndTime,
        remoteStartTime: mergedPolicy.remoteStartTime,
        remoteEndTime: mergedPolicy.remoteEndTime,
      },
      {
        onSuccess: () => {
          setAlert({ type: "success", message: "Working hours updated." });
          setHoursDraft({});
          void utils.hrWork.overview.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
      },
    );
  };

  const handleUpdateWeek = () => {
    updateWeekMutation.mutate(
      {
        workingDays,
        weekendDays,
      },
      {
        onSuccess: () => {
          setAlert({ type: "success", message: "Week schedule saved." });
          setWorkingDraft(null);
          setWeekendDraft(null);
          void utils.hrWork.overview.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
      },
    );
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <LoadingSpinner
          label="Loading operating rhythm"
          helper="Pulling your working hours, holidays, and weekly cadence."
        />
      </div>
    );
  }

  if (overviewQuery.error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="text-lg font-semibold">We couldn’t load the work configuration.</p>
        <p className="text-sm">{overviewQuery.error.message}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const pageName = "Operating Rhythm";

  return (
    <div className="space-y-8">
      <header className="space-y-3 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="inline-flex items-center gap-3 rounded-2xl bg-slate-900/5 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:bg-white/5 dark:text-slate-200">
          <FiClock />
          Work Management
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{pageName}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Define company-wide holidays, working hours, and weekend cadence so every team shares
            the same expectations.
          </p>
        </div>
      </header>

      <AlertBanner alert={alert} />

      {!canManage ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="text-base font-semibold">Read-only view</p>
          <p className="text-sm">
            Only org owners, org admins, or super admins can update the operating rhythm.
          </p>
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900/5 p-3 text-indigo-600 dark:bg-white/5 dark:text-indigo-200">
              <FiCalendar className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Organization holidays
              </h2>
              <p className="text-sm text-slate-500">
                Broadcast days off so attendance and reporting stay aligned.
              </p>
            </div>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateHoliday}>
            <TextInput
              label="Holiday name"
              placeholder="Victory Day"
              value={holidayForm.title}
              onChange={(event) =>
                setHolidayForm((prev) => ({ ...prev, title: event.target.value }))
              }
              disabled={!canManage || createHolidayMutation.isPending}
              isRequired
            />
            <TextInput
              label="Date"
              type="date"
              value={holidayForm.date}
              onChange={(event) =>
                setHolidayForm((prev) => ({ ...prev, date: event.target.value }))
              }
              disabled={!canManage || createHolidayMutation.isPending}
              isRequired
            />
            <div className="md:col-span-2">
              <TextArea
                label="Description"
                placeholder="Who is off and why?"
                value={holidayForm.description}
                onChange={(event) =>
                  setHolidayForm((prev) => ({ ...prev, description: event.target.value }))
                }
                disabled={!canManage || createHolidayMutation.isPending}
                height="120px"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={!canManage || createHolidayMutation.isPending}>
                {createHolidayMutation.isPending ? "Adding..." : "Add holiday"}
              </Button>
            </div>
          </form>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Upcoming holidays
            </p>
            {data.holidays.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No holidays have been recorded yet.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.holidays.map((holiday) => (
                  <HolidayCard
                    key={holiday.id}
                    title={holiday.title}
                    helper={holiday.dateLabel}
                    description={holiday.description}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900/5 p-3 text-indigo-600 dark:bg-white/5 dark:text-indigo-200">
              <FiEdit3 />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Working hours
              </h2>
              <p className="text-sm text-slate-500">Use 24-hour HH:MM format.</p>
            </div>
          </div>
          <form className="space-y-4" onSubmit={handleUpdateHours}>
            <div className="grid gap-3">
              <TextInput
                label="On-site start"
                type="time"
                value={mergedPolicy.onsiteStartTime}
                onChange={(event) =>
                  setHoursDraft((prev) => ({ ...prev, onsiteStartTime: event.target.value }))
                }
                disabled={!canManage || updateHoursMutation.isPending}
                isRequired
              />
              <TextInput
                label="On-site end"
                type="time"
                value={mergedPolicy.onsiteEndTime}
                onChange={(event) =>
                  setHoursDraft((prev) => ({ ...prev, onsiteEndTime: event.target.value }))
                }
                disabled={!canManage || updateHoursMutation.isPending}
                isRequired
              />
              <TextInput
                label="Remote start"
                type="time"
                value={mergedPolicy.remoteStartTime}
                onChange={(event) =>
                  setHoursDraft((prev) => ({ ...prev, remoteStartTime: event.target.value }))
                }
                disabled={!canManage || updateHoursMutation.isPending}
                isRequired
              />
              <TextInput
                label="Remote end"
                type="time"
                value={mergedPolicy.remoteEndTime}
                onChange={(event) =>
                  setHoursDraft((prev) => ({ ...prev, remoteEndTime: event.target.value }))
                }
                disabled={!canManage || updateHoursMutation.isPending}
                isRequired
              />
            </div>
            <Button type="submit" disabled={!canManage || updateHoursMutation.isPending}>
              {updateHoursMutation.isPending ? "Saving..." : "Save hours"}
            </Button>
          </form>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-900/5 p-3 text-indigo-600 dark:bg-white/5 dark:text-indigo-200">
            <FiCalendar className="text-2xl" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Work week cadence
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Mark the days the organization expects active coverage.
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Working days
            </p>
            <div className="flex flex-wrap gap-2">
              {weekOptions.map((day) => (
                <WeekdayToggle
                  key={`working-${day.value}`}
                  label={day.label}
                  isActive={workingDays.includes(day.value)}
                  onClick={() => toggleDay(day.value, "working")}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Weekend days
            </p>
            <div className="flex flex-wrap gap-2">
              {weekOptions.map((day) => (
                <WeekdayToggle
                  key={`weekend-${day.value}`}
                  label={day.label}
                  isActive={weekendDays.includes(day.value)}
                  onClick={() => toggleDay(day.value, "weekend")}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleUpdateWeek} disabled={!canManage || updateWeekMutation.isPending}>
              {updateWeekMutation.isPending ? "Updating..." : "Save week cadence"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
