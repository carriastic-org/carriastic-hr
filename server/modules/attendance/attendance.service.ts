import { AttendanceStatus, type WorkModel } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { prisma } from "@/server/db";
import { WEEKDAY_OPTIONS, type WeekdayOption } from "@/types/hr-work";
import type {
  AttendanceHistoryInput,
  CompleteDayInput,
  StartDayInput,
} from "./attendance.validation";

export type AttendanceRecordResponse = {
  id: string;
  attendanceDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  totalWorkSeconds: number;
  totalBreakSeconds: number;
  status: AttendanceStatus;
  note: string | null;
  source: string | null;
  location: string | null;
};

const formatRecord = (record: {
  id: string;
  attendanceDate: Date;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  totalWorkSeconds: number | null;
  totalBreakSeconds: number | null;
  status: AttendanceStatus;
  note: string | null;
  source: string | null;
  location: string | null;
}): AttendanceRecordResponse => ({
  id: record.id,
  attendanceDate: record.attendanceDate.toISOString(),
  checkInAt: record.checkInAt ? record.checkInAt.toISOString() : null,
  checkOutAt: record.checkOutAt ? record.checkOutAt.toISOString() : null,
  totalWorkSeconds: record.totalWorkSeconds ?? 0,
  totalBreakSeconds: record.totalBreakSeconds ?? 0,
  status: record.status,
  note: record.note ?? null,
  source: record.source ?? null,
  location: record.location ?? null,
});

const DEFAULT_POLICY_TIMINGS = {
  onsiteStartTime: "09:00",
  remoteStartTime: "08:00",
} as const;

const LOCATION_LABELS: Record<StartDayInput["location"], string> = {
  REMOTE: "Remote",
  ONSITE: "On-site",
};

const LATE_TOLERANCE_MS = 10 * 60 * 1000;
const MAX_DAILY_WORK_SECONDS = 8 * 60 * 60;

type PolicyTimings = {
  onsiteStartTime: string;
  remoteStartTime: string;
};

type WeekSchedule = {
  workingDays: WeekdayOption[];
  weekendDays: WeekdayOption[];
};

const DEFAULT_WEEK_SCHEDULE: WeekSchedule = {
  workingDays: [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
  ] as WeekdayOption[],
  weekendDays: ["SATURDAY", "SUNDAY"] as WeekdayOption[],
};

const resolvePolicyTimings = (record?: PolicyTimings | null): PolicyTimings => ({
  onsiteStartTime: record?.onsiteStartTime ?? DEFAULT_POLICY_TIMINGS.onsiteStartTime,
  remoteStartTime: record?.remoteStartTime ?? DEFAULT_POLICY_TIMINGS.remoteStartTime,
});

const weekdayOrder = WEEKDAY_OPTIONS.reduce<Record<WeekdayOption, number>>(
  (acc, day, index) => {
    acc[day] = index;
    return acc;
  },
  {} as Record<WeekdayOption, number>,
);

const normalizeWeekdayList = (values?: string[] | null): WeekdayOption[] => {
  if (!values?.length) {
    return [];
  }
  const seen = new Set<WeekdayOption>();
  const options = values.reduce<WeekdayOption[]>((acc, raw) => {
    if ((WEEKDAY_OPTIONS as readonly string[]).includes(raw)) {
      const day = raw as WeekdayOption;
      if (!seen.has(day)) {
        seen.add(day);
        acc.push(day);
      }
    }
    return acc;
  }, []);
  return options.sort(
    (a, b) => (weekdayOrder[a] ?? 0) - (weekdayOrder[b] ?? 0),
  );
};

const resolveWeekSchedule = (
  record?: { workingDays: string[]; weekendDays: string[] } | null,
): WeekSchedule => {
  if (!record) {
    return DEFAULT_WEEK_SCHEDULE;
  }

  const workingDays = normalizeWeekdayList(record.workingDays);
  const weekendDays = normalizeWeekdayList(record.weekendDays).filter(
    (day) => !workingDays.includes(day),
  );

  return {
    workingDays:
      workingDays.length > 0 ? workingDays : DEFAULT_WEEK_SCHEDULE.workingDays,
    weekendDays:
      weekendDays.length > 0 ? weekendDays : DEFAULT_WEEK_SCHEDULE.weekendDays,
  };
};

const timezoneFormatterCache = new Map<string, Intl.DateTimeFormat>();
const timezoneValidationCache = new Map<string, boolean>();

const isValidTimeZone = (value: string | null | undefined): value is string => {
  if (!value) {
    return false;
  }
  if (timezoneValidationCache.has(value)) {
    return timezoneValidationCache.get(value) ?? false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    timezoneValidationCache.set(value, true);
    return true;
  } catch {
    timezoneValidationCache.set(value, false);
    return false;
  }
};

const getTimeZoneFormatter = (timeZone: string) => {
  let formatter = timezoneFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    timezoneFormatterCache.set(timeZone, formatter);
  }
  return formatter;
};

const padTimeUnit = (value: number) => value.toString().padStart(2, "0");

const formatDateKey = (date: Date) => date.toISOString().split("T")[0]!;

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const formatter = getTimeZoneFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const filled = parts.reduce<Record<string, number>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = Number(part.value);
    }
    return acc;
  }, {});

  const asUtc = Date.UTC(
    filled.year ?? date.getUTCFullYear(),
    (filled.month ?? date.getUTCMonth() + 1) - 1,
    filled.day ?? date.getUTCDate(),
    filled.hour ?? 0,
    filled.minute ?? 0,
    filled.second ?? 0,
    0,
  );

  return asUtc - date.getTime();
};

const convertLocalTimeToUtc = (day: Date, hours: number, minutes: number, timeZone: string) => {
  const base = new Date(
    `${formatDateKey(day)}T${padTimeUnit(hours)}:${padTimeUnit(minutes)}:00.000Z`,
  );
  const initialOffset = getTimeZoneOffsetMs(base, timeZone);
  const candidate = new Date(base.getTime() - initialOffset);
  const verifiedOffset = getTimeZoneOffsetMs(candidate, timeZone);
  if (verifiedOffset !== initialOffset) {
    return new Date(base.getTime() - verifiedOffset);
  }
  return candidate;
};

const buildScheduledStart = (
  timeValue: string,
  fallbackValue: string,
  reference: Date,
  timeZone?: string | null,
) => {
  const scheduled = new Date(reference);
  let hour = Number.parseInt(timeValue.split(":")[0] ?? "", 10);
  let minute = Number.parseInt(timeValue.split(":")[1] ?? "", 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    const [fallbackHourStr, fallbackMinuteStr] = fallbackValue.split(":");
    hour = Number.parseInt(fallbackHourStr ?? "", 10) || 0;
    minute = Number.parseInt(fallbackMinuteStr ?? "", 10) || 0;
  }

  if (timeZone && isValidTimeZone(timeZone)) {
    return convertLocalTimeToUtc(reference, hour, minute, timeZone);
  }

  scheduled.setHours(hour, minute, 0, 0);
  return scheduled;
};

const resolveAttendanceStatus = (actual: Date, scheduled: Date) =>
  actual.getTime() > scheduled.getTime() + LATE_TOLERANCE_MS
    ? AttendanceStatus.LATE
    : AttendanceStatus.PRESENT;

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const resolveHistoryRange = (input?: AttendanceHistoryInput) => {
  const today = new Date();
  const month = input?.month ?? today.getMonth();
  const year = input?.year ?? today.getFullYear();
  const rangeStart = new Date(year, month, 1);
  const rangeEnd = new Date(year, month + 1, 1);
  return { rangeStart, rangeEnd };
};

type AttendanceServiceInput = {
  userId: string;
  organizationId: string;
};

type StartDayServiceInput = AttendanceServiceInput & {
  input: StartDayInput;
};

type CompleteDayServiceInput = AttendanceServiceInput & {
  input: CompleteDayInput;
};

type AttendanceHistoryServiceInput = AttendanceServiceInput & {
  params?: AttendanceHistoryInput;
};

export const attendanceService = {
  async today({ userId }: AttendanceServiceInput) {
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const attendanceDate = startOfDay(new Date());
    const [record, profile] = await Promise.all([
      prisma.attendanceRecord.findUnique({
        where: {
          employeeId_attendanceDate: {
            employeeId: userId,
            attendanceDate,
          },
        },
      }),
      prisma.employeeProfile.findUnique({
        where: { userId },
        select: { workModel: true },
      }),
    ]);

    return {
      record: record ? formatRecord(record) : null,
      workModel: (profile?.workModel as WorkModel | null) ?? null,
    };
  },

  async startDay({ userId, organizationId, input }: StartDayServiceInput) {
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!organizationId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Organization context missing." });
    }

    const now = new Date();
    const attendanceDate = startOfDay(now);

    const [existing, policyRecord, organizationRecord] = await Promise.all([
      prisma.attendanceRecord.findUnique({
        where: {
          employeeId_attendanceDate: {
            employeeId: userId,
            attendanceDate,
          },
        },
      }),
      prisma.workPolicy.findUnique({
        where: { organizationId },
        select: {
          onsiteStartTime: true,
          remoteStartTime: true,
        },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { timezone: true },
      }),
    ]);

    if (existing) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Attendance has already been recorded for today. Please contact HR if you need to make a change.",
      });
    }

    const timings = resolvePolicyTimings(policyRecord);
    const organizationTimeZone = organizationRecord?.timezone ?? null;
    const scheduledStart =
      input.location === "REMOTE"
        ? buildScheduledStart(
            timings.remoteStartTime,
            DEFAULT_POLICY_TIMINGS.remoteStartTime,
            now,
            organizationTimeZone,
          )
        : buildScheduledStart(
            timings.onsiteStartTime,
            DEFAULT_POLICY_TIMINGS.onsiteStartTime,
            now,
            organizationTimeZone,
          );
    const status = resolveAttendanceStatus(now, scheduledStart);
    const locationLabel = LOCATION_LABELS[input.location];

    const created = await prisma.attendanceRecord.create({
      data: {
        employeeId: userId,
        attendanceDate,
        checkInAt: now,
        status,
        source: "WEB",
        totalWorkSeconds: 0,
        totalBreakSeconds: 0,
        location: locationLabel,
      },
    });

    return formatRecord(created);
  },

  async completeDay({ userId, input }: CompleteDayServiceInput) {
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const activeRecord = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId: userId,
        checkInAt: {
          not: null,
        },
        checkOutAt: null,
      },
      orderBy: {
        attendanceDate: "desc",
      },
    });

    if (!activeRecord) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active attendance record found for completion.",
      });
    }

    const sanitizedWorkSeconds = Math.max(0, Math.min(input.workSeconds, MAX_DAILY_WORK_SECONDS));

    const updated = await prisma.attendanceRecord.update({
      where: { id: activeRecord.id },
      data: {
        checkOutAt: new Date(),
        totalWorkSeconds: sanitizedWorkSeconds,
        totalBreakSeconds: input.breakSeconds,
      },
    });

    return formatRecord(updated);
  },

  async history({ userId, organizationId, params }: AttendanceHistoryServiceInput) {
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const { rangeStart, rangeEnd } = resolveHistoryRange(params);

    const [records, policyRecord] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: {
          employeeId: userId,
          attendanceDate: {
            gte: rangeStart,
            lt: rangeEnd,
          },
        },
        orderBy: {
          attendanceDate: "desc",
        },
      }),
      prisma.workPolicy.findUnique({
        where: { organizationId },
        select: { workingDays: true, weekendDays: true },
      }),
    ]);
    const weekSchedule = resolveWeekSchedule(policyRecord);

    return {
      records: records.map(formatRecord),
      weekSchedule,
    };
  },
};
