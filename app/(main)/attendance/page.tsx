"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Text from "../../components/atoms/Text/Text";
import Button from "../../components/atoms/buttons/Button";
import { Modal } from "../../components/atoms/frame/Modal";
import { EmployeeHeader } from "../../components/layouts/EmployeeHeader";
import LoadingSpinner from "../../components/LoadingSpinner";
import { trpc } from "@/trpc/client";
import { Card } from "@/app/components/atoms/frame/Card";

const STORAGE_KEY = "ndi.attendance.timer.v1";
const MAX_WORK_SECONDS = 8 * 60 * 60;

const backendStatuses = [
  "PRESENT",
  "LATE",
  "HALF_DAY",
  "ABSENT",
  "REMOTE",
  "HOLIDAY",
] as const;

type BackendAttendanceStatus = (typeof backendStatuses)[number];

const attendanceStatusMeta: Record<
  BackendAttendanceStatus,
  { label: string; badgeClass: string; dotClass: string; description: string }
> = {
  PRESENT: {
    label: "Present",
    badgeClass:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
    dotClass: "bg-emerald-500",
    description: "Your working hours are being tracked from this portal.",
  },
  LATE: {
    label: "Late",
    badgeClass:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
    dotClass: "bg-amber-500",
    description: "HR has noted a late arrival for today.",
  },
  HALF_DAY: {
    label: "Half Day",
    badgeClass:
      "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200",
    dotClass: "bg-sky-500",
    description: "Only a half day is scheduled or approved for this date.",
  },
  ABSENT: {
    label: "Absent",
    badgeClass:
      "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
    dotClass: "bg-rose-500",
    description: "HR already logged you as absent for today.",
  },
  REMOTE: {
    label: "Remote",
    badgeClass:
      "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200",
    dotClass: "bg-indigo-500",
    description: "Remote work has been recorded for this day.",
  },
  HOLIDAY: {
    label: "Holiday",
    badgeClass:
      "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200",
    dotClass: "bg-violet-500",
    description: "This date has been marked as a holiday or leave.",
  },
};

const fallbackStatusMeta = {
  label: "Recorded",
  badgeClass:
    "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
  dotClass: "bg-slate-400",
  description: "Attendance has already been logged for this day.",
};

type WorkLocationChoice = "REMOTE" | "ONSITE";

const locationChoiceMeta: Record<
  WorkLocationChoice,
  { label: string; description: string }
> = {
  REMOTE: {
    label: "Remote",
    description: "Home setup, VPN, or client visit.",
  },
  ONSITE: {
    label: "On-site",
    description: "Office or in-person collaboration.",
  },
};

const parseLocationChoice = (value?: string | null): WorkLocationChoice | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("remote")) {
    return "REMOTE";
  }
  if (normalized.includes("site")) {
    return "ONSITE";
  }
  return null;
};

const locationChoices: WorkLocationChoice[] = ["REMOTE", "ONSITE"];

type TimerState = {
  dateKey: string;
  hasStarted: boolean;
  isOnBreak: boolean;
  isLeaved: boolean;
  workSeconds: number;
  breakSeconds: number;
  workTimerStartedAt: number | null;
  breakTimerStartedAt: number | null;
};

const getTodayKey = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const buildInitialState = (dateKey = getTodayKey()): TimerState => ({
  dateKey,
  hasStarted: false,
  isOnBreak: false,
  isLeaved: false,
  workSeconds: 0,
  breakSeconds: 0,
  workTimerStartedAt: null,
  breakTimerStartedAt: null,
});

const ensureTodayState = (state: TimerState): TimerState => {
  if (state.dateKey === getTodayKey()) {
    return state;
  }
  return buildInitialState();
};

const isInitialTimerState = (state: TimerState) =>
  !state.hasStarted &&
  !state.isOnBreak &&
  !state.isLeaved &&
  state.workSeconds === 0 &&
  state.breakSeconds === 0 &&
  state.workTimerStartedAt === null &&
  state.breakTimerStartedAt === null;

const computeLiveSeconds = (total: number, startedAt: number | null, now = Date.now()) => {
  if (!startedAt) return total;
  const diff = Math.floor((now - startedAt) / 1000);
  return total + (diff > 0 ? diff : 0);
};

const computeWorkSeconds = (state: TimerState) =>
  computeLiveSeconds(state.workSeconds, state.workTimerStartedAt);

const computeBreakSeconds = (state: TimerState) =>
  computeLiveSeconds(state.breakSeconds, state.breakTimerStartedAt);

const finalizeWorkSeconds = (state: TimerState, now: number) =>
  computeLiveSeconds(state.workSeconds, state.workTimerStartedAt, now);

const finalizeBreakSeconds = (state: TimerState, now: number) =>
  computeLiveSeconds(state.breakSeconds, state.breakTimerStartedAt, now);

const readStoredState = (): TimerState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TimerState;
    if (parsed.dateKey !== getTodayKey()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

const formatDisplayDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(date);

const formatDisplayTime = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);

const isBackendStatus = (status: string): status is BackendAttendanceStatus =>
  backendStatuses.includes(status as BackendAttendanceStatus);

const formatTimeOfDay = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const formatDurationLabel = (seconds?: number | null) => {
  if (seconds === null || seconds === undefined) return "—";
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours === 0 && minutes === 0) {
    return "0m";
  }
  const parts: string[] = [];
  if (hours) {
    parts.push(`${hours}h`);
  }
  if (minutes) {
    parts.push(`${minutes}m`);
  }
  return parts.join(" ");
};

const formatSourceLabel = (source?: string | null) => {
  if (!source) return "Portal";
  return source
    .toLowerCase()
    .split(/[_\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

function AttendancePage() {
  const [timerState, setTimerState] = useState<TimerState>(() => buildInitialState());
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);
  const [workDisplaySeconds, setWorkDisplaySeconds] = useState<number>(() =>
    computeWorkSeconds(timerState),
  );
  const [breakDisplaySeconds, setBreakDisplaySeconds] = useState<number>(() =>
    computeBreakSeconds(timerState),
  );
  const [now, setNow] = useState<Date>(() => new Date());
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<WorkLocationChoice | null>(null);
  const stateRef = useRef<TimerState>(timerState);
  const completionInFlightRef = useRef(false);
  const startDayMutation = trpc.attendance.startDay.useMutation();
  const completeDayMutation = trpc.attendance.completeDay.useMutation();
  const todayAttendanceQuery = trpc.attendance.today.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const record = todayAttendanceQuery.data?.record ?? null;
  const workModel = todayAttendanceQuery.data?.workModel ?? null;
  const isHybridWorkModel = workModel === "HYBRID";
  const hasExistingServerAttendance = Boolean(record);
  const lockStartBecauseOfServerRecord = hasExistingServerAttendance && !timerState.hasStarted;
  const statusInfo =
    record && record.status && isBackendStatus(record.status)
      ? attendanceStatusMeta[record.status]
      : fallbackStatusMeta;
  const summaryMessage = record?.note
    ? record.note
    : record
      ? `${statusInfo.description} Logged via ${formatSourceLabel(record.source)}.`
      : "No attendance has been logged yet. Start when you are ready to work.";
  const statusLabel = record ? statusInfo.label : "Awaiting log";
  const lockMessage = lockStartBecauseOfServerRecord
    ? record
      ? `Attendance is already marked as ${statusInfo.label.toLowerCase()}. Please contact HR if this needs to change.`
      : "Attendance is already recorded for today."
    : null;

  const summaryFields = [
    {
      label: "Check-in",
      value: record ? formatTimeOfDay(record.checkInAt) : "—",
      helper: record
        ? record.checkInAt
          ? "Logged punch-in time"
          : "Waiting for your start"
        : undefined,
    },
    {
      label: "Check-out",
      value: record ? formatTimeOfDay(record.checkOutAt) : "—",
      helper: record
        ? record.checkOutAt
          ? "Completed for the day"
          : "Will update after you leave"
        : undefined,
    },
    {
      label: "Working hours",
      value: record ? formatDurationLabel(record.totalWorkSeconds) : "—",
      helper: record
        ? record.checkOutAt
          ? "Submitted to HR"
          : "Updates after you leave"
        : undefined,
    },
    {
      label: "Break time",
      value: record ? formatDurationLabel(record.totalBreakSeconds) : "—",
      helper: record
        ? record.totalBreakSeconds
          ? "Saved with your day-end submission"
          : "Tracked when you finish"
        : undefined,
    },
  ];

  const locationSelectionWarning = isHybridWorkModel && !selectedLocation;
  const locationHelperText =
    workModel === "REMOTE"
      ? "Remote is selected automatically. Switch if you are visiting the office today."
      : workModel === "ONSITE"
        ? "On-site is selected automatically. Switch if you are working remotely."
        : "Pick where you are working from before you start your day.";
  const startButtonDisabled =
    startDayMutation.isPending || lockStartBecauseOfServerRecord || !selectedLocation;

  const formatTime = (time: number) => {
    const safeTime = Math.max(0, time);
    const hours = Math.floor(safeTime / 3600)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((safeTime % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (safeTime % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const persistState = useCallback((state: TimerState) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore write errors
    }
  }, []);

  const updateTimerState = useCallback(
    (updater: (prev: TimerState) => TimerState) => {
      setTimerState((prev) => {
        const normalized = ensureTodayState(prev);
        const next = updater(normalized);
        stateRef.current = next;
        persistState(next);
        return next;
      });
    },
    [persistState],
  );

  const resetTimerState = useCallback(() => {
    const initial = buildInitialState();
    stateRef.current = initial;
    setTimerState(initial);
    setWorkDisplaySeconds(0);
    setBreakDisplaySeconds(0);
    persistState(initial);
  }, [persistState]);

  useEffect(() => {
    stateRef.current = timerState;
  }, [timerState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = readStoredState();
    if (!stored) return;
    stateRef.current = stored;
    /* eslint-disable react-hooks/set-state-in-effect */
    setTimerState(stored);
    setWorkDisplaySeconds(computeWorkSeconds(stored));
    setBreakDisplaySeconds(computeBreakSeconds(stored));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (todayAttendanceQuery.isFetching || todayAttendanceQuery.isPending) {
      return;
    }
    const hasRecord = Boolean(todayAttendanceQuery.data?.record);
    if (!hasRecord && !isInitialTimerState(stateRef.current)) {
      /* eslint-disable react-hooks/set-state-in-effect */
      resetTimerState();
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [
    todayAttendanceQuery.data,
    todayAttendanceQuery.isFetching,
    todayAttendanceQuery.isPending,
    resetTimerState,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = () => {
      const current = stateRef.current;
      if (current.dateKey !== getTodayKey()) {
        const resetState = buildInitialState();
        stateRef.current = resetState;
        setTimerState(resetState);
        persistState(resetState);
        setWorkDisplaySeconds(0);
        setBreakDisplaySeconds(0);
        return;
      }
      setWorkDisplaySeconds(computeWorkSeconds(current));
      setBreakDisplaySeconds(computeBreakSeconds(current));
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [persistState]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!record?.location) {
      return;
    }
    const parsed = parseLocationChoice(record.location);
    if (parsed && parsed !== selectedLocation) {
      setSelectedLocation(parsed);
    }
  }, [record?.location, selectedLocation]);

  useEffect(() => {
    if (record || selectedLocation || !workModel) {
      return;
    }
    if (workModel === "REMOTE") {
      setSelectedLocation("REMOTE");
    } else if (workModel === "ONSITE") {
      setSelectedLocation("ONSITE");
    }
  }, [record, selectedLocation, workModel]);

  useEffect(() => {
    if (!record?.checkInAt || record.checkOutAt) {
      return;
    }
    if (stateRef.current.hasStarted) {
      return;
    }
    const timestamp = new Date(record.checkInAt).getTime();
    if (Number.isNaN(timestamp)) {
      return;
    }
    const baselineWorkSeconds = Math.max(0, record.totalWorkSeconds ?? 0);
    const baselineBreakSeconds = Math.max(0, record.totalBreakSeconds ?? 0);
    updateTimerState(() => ({
      ...buildInitialState(),
      hasStarted: true,
      workSeconds: baselineWorkSeconds,
      breakSeconds: baselineBreakSeconds,
      workTimerStartedAt: timestamp,
      breakTimerStartedAt: null,
    }));
  }, [
    record?.checkInAt,
    record?.checkOutAt,
    record?.totalBreakSeconds,
    record?.totalWorkSeconds,
    updateTimerState,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const navigate = useRouter();
  const handleButtonClick = () => {
    navigate.push("/attendance/history");
  };

  const isInitialLoading = todayAttendanceQuery.isLoading || todayAttendanceQuery.isPending;
  const hasError = todayAttendanceQuery.isError;
  const refetchToday = () => {
    setActionError(null);
    void todayAttendanceQuery.refetch();
  };

  const handleStart = async () => {
    const currentState = stateRef.current;
    if (currentState.hasStarted && !currentState.isLeaved) {
      return;
    }
    if (startDayMutation.isPending || lockStartBecauseOfServerRecord) {
      return;
    }
    if (!selectedLocation) {
      setActionError("Select where you’re working today before starting.");
      return;
    }

    try {
      setActionError(null);
      await startDayMutation.mutateAsync({ location: selectedLocation });
      const nowTimestamp = Date.now();
      updateTimerState(() => ({
        ...buildInitialState(),
        hasStarted: true,
        workTimerStartedAt: nowTimestamp,
      }));
      await todayAttendanceQuery.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start attendance.";
      setActionError(message);
    }
  };

  const handleBreak = () => {
    const nowTimestamp = Date.now();
    updateTimerState((prev) => {
      if (!prev.hasStarted || prev.isOnBreak || prev.isLeaved) {
        return prev;
      }
      return {
        ...prev,
        workSeconds: finalizeWorkSeconds(prev, nowTimestamp),
        workTimerStartedAt: null,
        isOnBreak: true,
        breakTimerStartedAt: nowTimestamp,
      };
    });
  };

  const handleBreakOver = () => {
    const nowTimestamp = Date.now();
    updateTimerState((prev) => {
      if (!prev.isOnBreak || prev.isLeaved) {
        return prev;
      }
      return {
        ...prev,
        breakSeconds: finalizeBreakSeconds(prev, nowTimestamp),
        breakTimerStartedAt: null,
        isOnBreak: false,
        workTimerStartedAt: nowTimestamp,
      };
    });
  };

  const finalizeAndSubmitAttendance = useCallback(async () => {
    if (completeDayMutation.isPending || completionInFlightRef.current) {
      return;
    }

    const currentState = stateRef.current;
    if (!currentState.hasStarted || currentState.isLeaved) {
      return;
    }

    completionInFlightRef.current = true;
    const nowTimestamp = Date.now();
    const rawWorkSeconds = finalizeWorkSeconds(currentState, nowTimestamp);
    const finalWorkSeconds = Math.min(Math.max(0, rawWorkSeconds), MAX_WORK_SECONDS);
    const finalBreakSeconds = finalizeBreakSeconds(currentState, nowTimestamp);

    updateTimerState((prev) => {
      if (!prev.hasStarted || prev.isLeaved) {
        return prev;
      }
      return {
        ...prev,
        workSeconds: finalWorkSeconds,
        breakSeconds: finalBreakSeconds,
        workTimerStartedAt: null,
        breakTimerStartedAt: null,
        isOnBreak: false,
        isLeaved: true,
      };
    });

    try {
      setActionError(null);
      await completeDayMutation.mutateAsync({
        workSeconds: finalWorkSeconds,
        breakSeconds: finalBreakSeconds,
      });
      await todayAttendanceQuery.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to complete attendance.";
      setActionError(message);
    } finally {
      completionInFlightRef.current = false;
    }
  }, [completeDayMutation, todayAttendanceQuery, updateTimerState]);

  const handleLeave = async () => {
    if (completeDayMutation.isPending) {
      return;
    }
    setIsLeaveModalOpen(false);
    await finalizeAndSubmitAttendance();
  };

  useEffect(() => {
    if (!stateRef.current.hasStarted || stateRef.current.isLeaved) {
      return;
    }
    if (workDisplaySeconds < MAX_WORK_SECONDS) {
      return;
    }
    void finalizeAndSubmitAttendance();
  }, [finalizeAndSubmitAttendance, workDisplaySeconds]);

  const isStarted = timerState.hasStarted;
  const isOnBreak = timerState.isOnBreak;
  const isLeaved = timerState.isLeaved;
  const formattedTodayDate = formatDisplayDate(now);
  const formattedCurrentTime = formatDisplayTime(now);

  if (isInitialLoading) {
    return (
      <LoadingSpinner
        fullscreen
        label="Loading attendance"
        helper="Fetching today’s log and timer state."
      />
    );
  }

  if (hasError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <Text
          text="We couldn’t load your attendance right now."
          className="text-lg text-text_primary"
        />
        <Button onClick={refetchToday} disabled={todayAttendanceQuery.isFetching}>
          <Text
            text={todayAttendanceQuery.isFetching ? "Refreshing..." : "Try again"}
            className="font-semibold"
          />
        </Button>
      </div>
    );
  }

  const showInlineLoader =
    todayAttendanceQuery.isFetching ||
    startDayMutation.isPending ||
    completeDayMutation.isPending;

  const inlineLoaderLabel = startDayMutation.isPending
    ? "Starting your workday..."
    : completeDayMutation.isPending
      ? "Wrapping up your hours..."
      : "Syncing attendance...";

  return (
    <div className="relative w-full">
      <div className="flex w-full flex-col gap-6">
        <EmployeeHeader
          hasRightButton
          buttonText="Attendance History"
          onButtonClick={handleButtonClick}
        />

        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <Text
                  text="Today’s Attendance Snapshot"
                  className="text-lg font-semibold text-text_primary"
                />
                <Text text={summaryMessage} className="text-sm text-text_secondary" />
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-sm font-semibold ${statusInfo.badgeClass}`}
              >
                <span className={`h-2 w-2 rounded-full ${statusInfo.dotClass}`} />
                {statusLabel}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {summaryFields.map((field) => (
                <SummaryField
                  key={field.label}
                  label={field.label}
                  value={field.value}
                  helper={field.helper}
                />
              ))}
            </div>
            {record && (
              <div className="inline-flex max-w-full items-center gap-2 rounded-2xl bg-slate-900/5 px-4 py-2 text-xs font-medium text-slate-600 dark:bg-slate-100/5 dark:text-slate-300">
                Logged via {formatSourceLabel(record.source)} · {statusInfo.label}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center text-center gap-1">
              <Text text={formattedTodayDate} className="text-lg font-semibold" />
              <Text text={formattedCurrentTime} className="text-sm text-text_secondary" />
            </div>
            <Text
              text="Today’s Total Working Time"
              className="mt-4 text-2xl font-semibold text-text_primary"
            />
            {!isStarted ? (
              <div className="w-full max-w-md space-y-4">
                {!hasExistingServerAttendance && (
                  <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 text-left shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <Text
                        text="Where are you working today?"
                        className="text-sm font-semibold text-text_primary"
                      />
                      <span
                        className={`text-xs font-semibold ${
                          selectedLocation
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-amber-600 dark:text-amber-300"
                        }`}
                      >
                        {selectedLocation
                          ? locationChoiceMeta[selectedLocation].label
                          : "Selection required"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {locationChoices.map((choice) => {
                        const meta = locationChoiceMeta[choice];
                        const isSelected = selectedLocation === choice;
                        return (
                          <button
                            key={choice}
                            type="button"
                            onClick={() => setSelectedLocation(choice)}
                            className={`rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm focus-visible:outline-indigo-400 dark:border-indigo-400/80 dark:bg-indigo-500/10 dark:text-indigo-200"
                                : "border-slate-200 text-slate-600 hover:border-slate-300 focus-visible:outline-slate-300 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:focus-visible:outline-slate-500"
                            }`}
                          >
                            <p className="text-sm font-semibold">{meta.label}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {meta.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    <p
                      className={`mt-3 text-xs ${
                        locationSelectionWarning
                          ? "text-rose-500 dark:text-rose-300"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {locationSelectionWarning
                        ? "Select remote or on-site to enable attendance."
                        : locationHelperText}
                    </p>
                  </div>
                )}
                <Button
                  theme="primary"
                  onClick={() => void handleStart()}
                  className="w-full"
                  disabled={startButtonDisabled}
                >
                  <Text text="Start Working" className="py-1" />
                </Button>
                {lockMessage && (
                  <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                    {lockMessage}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex w-full flex-col items-center gap-8">
                {!isLeaved && (
                  <>
                    <div className="text-[48px] font-semibold leading-none text-text_primary">
                      <Text text={formatTime(workDisplaySeconds)} />
                    </div>
                    <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-4 dark:border-slate-700">
                      <Text text="Lunch Break" className="font-semibold text-[20px]" />
                      {isOnBreak ? (
                        <div className="mt-3 text-[36px] font-semibold text-text_primary">
                          <Text text={formatTime(breakDisplaySeconds)} />
                        </div>
                      ) : (
                        <Text
                          text="Break timer will start when you pause work."
                          className="mt-2 text-sm text-text_secondary"
                        />
                      )}
                    </div>
                  </>
                )}
                <div className="flex w-full flex-col gap-4 md:flex-row md:justify-center">
                  {!isOnBreak && !isLeaved && (
                    <Button theme="secondary" onClick={handleBreak} className="w-full md:w-[220px]">
                      Start Break
                    </Button>
                  )}
                  {isOnBreak && !isLeaved && (
                    <Button
                      theme="cancel-secondary"
                      onClick={handleBreakOver}
                      className="w-full md:w-[220px]"
                    >
                      End Break
                    </Button>
                  )}
                </div>

                {!isLeaved ? (
                  <Button
                    theme="cancel"
                    className="w-full"
                    onClick={() => setIsLeaveModalOpen(true)}
                    disabled={completeDayMutation.isPending}
                  >
                    <Text text="Leave" className="py-1" />
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2 text-center">
                    <Text text="Submitted working hours" className="text-sm text-text_secondary" />
                    <div className="text-[40px] font-semibold text-text_primary">
                      <Text text={formatTime(workDisplaySeconds)} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {actionError && (
              <p className="w-full rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                {actionError}
              </p>
            )}
            {showInlineLoader && (
              <p className="w-full rounded-2xl bg-indigo-50/80 px-4 py-2 text-sm font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
                {inlineLoaderLabel}
              </p>
            )}
          </div>
        </Card>
      </div>

      <Modal
        doneButtonText="Leave"
        cancelButtonText="Cancel"
        isCancelButton
        className="h-auto w-full max-w-xl"
        open={isLeaveModalOpen}
        setOpen={setIsLeaveModalOpen}
        title="Are you sure?"
        titleTextSize="text-[24px]"
        buttonWidth="120px"
        buttonHeight="40px"
        onDoneClick={() => handleLeave()}
        closeOnClick={() => setIsLeaveModalOpen(false)}
      >
        <Text
          text="Are you sure to leave from work for today?"
          className="my-6 text-center text-[20px] font-semibold text-text_primary"
        />
      </Modal>
    </div>
  );
}

type SummaryFieldProps = {
  label: string;
  value: string;
  helper?: string;
};

const SummaryField = ({ label, value, helper }: SummaryFieldProps) => (
  <div className="rounded-2xl border border-slate-100 bg-white/70 px-4 py-3 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
    </p>
    <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
    {helper ? (
      <p className="text-xs text-slate-500 dark:text-slate-400">{helper}</p>
    ) : null}
  </div>
);

export default AttendancePage;
