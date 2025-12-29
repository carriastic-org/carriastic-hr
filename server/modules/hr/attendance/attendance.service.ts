import {
  AttendanceStatus,
  EmploymentStatus,
  Prisma,
  WorkModel,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import {
  type HrAttendanceCalendarDay,
  type HrAttendanceCalendarSignal,
  type HrAttendanceEmployeeOption,
  type HrAttendanceHistoryResponse,
  type HrAttendanceLog,
  type HrAttendanceOverviewResponse,
  type HrAttendanceStatus,
  type HrAttendanceStatusCounts,
  type HrAttendanceWeeklyTrendPoint,
} from "@/types/hr-attendance";
import { requireHrAdmin } from "@/server/modules/hr/utils";
import type {
  HrAttendanceHistoryInput,
  HrAttendanceManualEntryInput,
  HrAttendanceOverviewInput,
} from "./attendance.validation";

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

const localizedTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getLocalizedTimeFormatter = (timeZone: string) => {
  let formatter = localizedTimeFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });
    localizedTimeFormatterCache.set(timeZone, formatter);
  }
  return formatter;
};

const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });

const formatTimeLabel = (value?: Date | null, timeZone?: string | null) => {
  if (!value) {
    return "—";
  }
  if (timeZone) {
    try {
      return getLocalizedTimeFormatter(timeZone).format(value);
    } catch {
      // Ignore invalid timezones and fall back to server defaults.
    }
  }
  return timeFormatter.format(value);
};

const formatDateKey = (date: Date) => date.toISOString().split("T")[0]!;

const startOfDay = (input: Date) => {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (input: Date, days: number) => {
  const date = new Date(input);
  date.setDate(date.getDate() + days);
  return date;
};

const hrStatusByAttendance: Record<AttendanceStatus, HrAttendanceStatus> = {
  [AttendanceStatus.PRESENT]: "On time",
  [AttendanceStatus.LATE]: "Late",
  [AttendanceStatus.HALF_DAY]: "On leave",
  [AttendanceStatus.ABSENT]: "Absent",
  [AttendanceStatus.REMOTE]: "On time",
  [AttendanceStatus.HOLIDAY]: "On leave",
};

const toHrStatus = (status: AttendanceStatus): HrAttendanceStatus =>
  hrStatusByAttendance[status] ?? "On time";

const emptyStatusCounts = (): HrAttendanceStatusCounts => ({
  "On time": 0,
  Late: 0,
  "On leave": 0,
  Absent: 0,
});

const DEFAULT_POLICY_TIMINGS = {
  onsiteStartTime: "09:00",
  remoteStartTime: "08:00",
} as const;

const LATE_TOLERANCE_MS = 10 * 60 * 1000;

const WORK_TYPE_LABELS: Record<HrAttendanceManualEntryInput["workType"], string> = {
  REMOTE: "Remote",
  ONSITE: "On-site",
};

const buildScheduledStartForWorkType = (
  workType: HrAttendanceManualEntryInput["workType"],
  timings: PolicyTimings,
  reference: Date,
  timeZone?: string | null,
) =>
  workType === "REMOTE"
    ? buildScheduledStart(
        timings.remoteStartTime,
        DEFAULT_POLICY_TIMINGS.remoteStartTime,
        reference,
        timeZone,
      )
    : buildScheduledStart(
        timings.onsiteStartTime,
        DEFAULT_POLICY_TIMINGS.onsiteStartTime,
        reference,
        timeZone,
      );

const resolveStatusFromCheckIn = (
  checkInAt: Date | null,
  attendanceDate: Date,
  workType: HrAttendanceManualEntryInput["workType"],
  timings: PolicyTimings,
  timeZone?: string | null,
) => {
  if (!checkInAt) {
    return AttendanceStatus.PRESENT;
  }
  const reference = checkInAt ?? attendanceDate;
  const scheduledStart = buildScheduledStartForWorkType(
    workType,
    timings,
    reference,
    timeZone,
  );
  return checkInAt.getTime() > scheduledStart.getTime() + LATE_TOLERANCE_MS
    ? AttendanceStatus.LATE
    : AttendanceStatus.PRESENT;
};

type PolicyTimings = {
  onsiteStartTime: string;
  remoteStartTime: string;
};

const resolvePolicyTimings = (
  policy?: { onsiteStartTime: string; remoteStartTime: string } | null,
): PolicyTimings => ({
  onsiteStartTime: policy?.onsiteStartTime ?? DEFAULT_POLICY_TIMINGS.onsiteStartTime,
  remoteStartTime: policy?.remoteStartTime ?? DEFAULT_POLICY_TIMINGS.remoteStartTime,
});

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

const inferWorkType = (
  record: AttendanceRecordWithEmployee,
): "REMOTE" | "ONSITE" => {
  if (record.status === AttendanceStatus.REMOTE) {
    return "REMOTE";
  }
  const normalized = record.location?.toLowerCase().trim() ?? "";
  if (normalized.includes("remote")) {
    return "REMOTE";
  }
  const profileWorkModel = record.employee.profile?.workModel;
  if (profileWorkModel === WorkModel.REMOTE) {
    return "REMOTE";
  }
  return "ONSITE";
};

const resolveScheduledStartForRecord = (
  record: AttendanceRecordWithEmployee,
  timings: PolicyTimings,
  timeZone?: string | null,
) => {
  const reference = record.checkInAt ?? record.attendanceDate;
  const workType = inferWorkType(record);
  return buildScheduledStartForWorkType(workType, timings, reference, timeZone);
};

const resolveHrStatusWithPolicy = (
  record: AttendanceRecordWithEmployee,
  timings?: PolicyTimings | null,
  timeZone?: string | null,
): HrAttendanceStatus => {
  const baseStatus = toHrStatus(record.status);
  if (!timings || baseStatus !== "On time" || !record.checkInAt) {
    return baseStatus;
  }
  const scheduledStart = resolveScheduledStartForRecord(record, timings, timeZone);
  if (record.checkInAt.getTime() > scheduledStart.getTime() + LATE_TOLERANCE_MS) {
    return "Late";
  }
  return baseStatus;
};

const isManualSource = (source?: string | null) =>
  source ? source.toLowerCase().includes("manual") : false;

const formatEmployeeName = (record: {
  preferredName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}) => {
  if (record.preferredName) return record.preferredName;
  const parts = [record.firstName, record.lastName].filter(Boolean);
  if (parts.length) {
    return parts.join(" ");
  }
  return record.email;
};

const attendanceRecordSelect = {
  id: true,
  employeeId: true,
  attendanceDate: true,
  checkInAt: true,
  checkOutAt: true,
  status: true,
  source: true,
  location: true,
  employee: {
    select: {
      id: true,
      email: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          preferredName: true,
          workModel: true,
        },
      },
      employment: {
        select: {
          department: {
            select: {
              name: true,
            },
          },
          team: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
} as const;

type AttendanceRecordWithEmployee = Prisma.AttendanceRecordGetPayload<{
  select: typeof attendanceRecordSelect;
}>;

const mapLog = (
  record: AttendanceRecordWithEmployee,
  timings?: PolicyTimings | null,
  timeZone?: string | null,
): HrAttendanceLog => ({
  id: record.id,
  employeeId: record.employeeId,
  name: formatEmployeeName({
    preferredName: record.employee.profile?.preferredName ?? null,
    firstName: record.employee.profile?.firstName ?? null,
    lastName: record.employee.profile?.lastName ?? null,
    email: record.employee.email,
  }),
  department: record.employee.employment?.department?.name ?? null,
  squad: record.employee.employment?.team?.name ?? null,
  checkIn: formatTimeLabel(record.checkInAt, timeZone),
  checkOut: formatTimeLabel(record.checkOutAt, timeZone),
  status: resolveHrStatusWithPolicy(record, timings, timeZone),
  source: isManualSource(record.source) ? "Manual" : "System",
});

const buildCalendar = (
  monthStart: Date,
  monthEnd: Date,
  records: AttendanceRecordWithEmployee[],
  timings?: PolicyTimings | null,
  timeZone?: string | null,
): HrAttendanceCalendarDay[] => {
  const statusByDate = new Map<string, Set<HrAttendanceStatus>>();

  records.forEach((record) => {
    const dateKey = formatDateKey(record.attendanceDate);
    const status = resolveHrStatusWithPolicy(record, timings, timeZone);
    const collection = statusByDate.get(dateKey) ?? new Set<HrAttendanceStatus>();
    collection.add(status);
    statusByDate.set(dateKey, collection);
  });

  const calendar: HrAttendanceCalendarDay[] = [];
  const cursor = new Date(monthStart);

  while (cursor < monthEnd) {
    const key = formatDateKey(cursor);
    const statuses = statusByDate.get(key) ?? new Set<HrAttendanceStatus>();
    const signal = determineSignal(statuses);
    calendar.push({ date: key, signal });
    cursor.setDate(cursor.getDate() + 1);
  }

  return calendar;
};

const determineSignal = (statuses: Set<HrAttendanceStatus>): HrAttendanceCalendarSignal => {
  if (!statuses.size) return "none";
  if (statuses.has("Absent")) return "absent";
  if (statuses.has("Late")) return "late";
  if (statuses.has("On leave")) return "leave";
  if (statuses.has("On time")) return "ontime";
  return "none";
};

const buildWeeklyTrend = (
  trendStart: Date,
  days: number,
  records: AttendanceRecordWithEmployee[],
  totalEmployees: number,
  timings?: PolicyTimings | null,
  timeZone?: string | null,
): HrAttendanceWeeklyTrendPoint[] => {
  const presentByDate = new Map<string, number>();

  records.forEach((record) => {
    const key = formatDateKey(record.attendanceDate);
    const status = resolveHrStatusWithPolicy(record, timings, timeZone);
    if (status === "On time") {
      presentByDate.set(key, (presentByDate.get(key) ?? 0) + 1);
    }
  });

  return Array.from({ length: days }).map((_, index) => {
    const day = addDays(trendStart, index);
    const key = formatDateKey(day);
    const presentCount = presentByDate.get(key) ?? 0;
    const presentPercentage =
      totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;

    return {
      date: key,
      label: weekdayFormatter.format(day),
      presentCount,
      presentPercentage,
    };
  });
};

const parseDateOrThrow = (value: string, message: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
  return date;
};

const TIMEZONE_TOKEN_REGEX = /([A-Za-z]+\/[A-Za-z0-9_\-+]+(?:\/[A-Za-z0-9_\-+]+)?)/;

const LOCATION_TIMEZONE_HINTS: Array<{ pattern: RegExp; timeZone: string }> = [
  { pattern: /\bdhaka\b/i, timeZone: "Asia/Dhaka" },
  { pattern: /\bsingapore\b/i, timeZone: "Asia/Singapore" },
  { pattern: /\btokyo\b/i, timeZone: "Asia/Tokyo" },
  { pattern: /\bseoul\b/i, timeZone: "Asia/Seoul" },
  { pattern: /\bkolkata\b/i, timeZone: "Asia/Kolkata" },
  { pattern: /\bbangalore\b/i, timeZone: "Asia/Kolkata" },
  { pattern: /\bmumbai\b/i, timeZone: "Asia/Kolkata" },
  { pattern: /\bdelhi\b/i, timeZone: "Asia/Kolkata" },
  { pattern: /\bdubai\b/i, timeZone: "Asia/Dubai" },
  { pattern: /\bdoha\b/i, timeZone: "Asia/Qatar" },
  { pattern: /\blondon\b/i, timeZone: "Europe/London" },
  { pattern: /\bberlin\b/i, timeZone: "Europe/Berlin" },
  { pattern: /\bparis\b/i, timeZone: "Europe/Paris" },
  { pattern: /\btoronto\b/i, timeZone: "America/Toronto" },
  { pattern: /\bnew york\b/i, timeZone: "America/New_York" },
  { pattern: /\bsan francisco\b/i, timeZone: "America/Los_Angeles" },
  { pattern: /\blos angeles\b/i, timeZone: "America/Los_Angeles" },
  { pattern: /\baustin\b/i, timeZone: "America/Chicago" },
  { pattern: /\bsydney\b/i, timeZone: "Australia/Sydney" },
  { pattern: /\bmelbourne\b/i, timeZone: "Australia/Melbourne" },
  { pattern: /\bbrisbane\b/i, timeZone: "Australia/Brisbane" },
];

const timezoneValidationCache = new Map<string, boolean>();
const timezoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

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

const extractTimeZoneFromText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed as string;
  if (isValidTimeZone(normalized)) {
    return normalized;
  }
  const tokenMatch = TIMEZONE_TOKEN_REGEX.exec(normalized);
  if (tokenMatch && isValidTimeZone(tokenMatch[1])) {
    return tokenMatch[1];
  }
  return null;
};

const resolveTimeZoneFromLocation = (
  primaryLocation: string | null | undefined,
  fallback: string | null | undefined,
): string | null => {
  const extracted = extractTimeZoneFromText(primaryLocation);
  if (extracted) {
    return extracted;
  }

  const normalized = primaryLocation?.trim().toLowerCase() ?? "";
  if (normalized) {
    for (const hint of LOCATION_TIMEZONE_HINTS) {
      if (hint.pattern.test(normalized)) {
        return hint.timeZone;
      }
    }
  }

  const fallbackTimezone = fallback?.trim() ?? null;
  if (isValidTimeZone(fallbackTimezone)) {
    return fallbackTimezone;
  }

  return null;
};

const parseTimeToDate = (
  timeValue: string | null | undefined,
  day: Date,
  options?: { timeZone?: string | null },
) => {
  if (!timeValue) return null;
  const [hours, minutes] = timeValue.split(":").map((part) => Number(part));
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  if (options?.timeZone) {
    return convertLocalTimeToUtc(day, hours, minutes, options.timeZone);
  }
  const date = new Date(day);
  date.setHours(hours, minutes, 0, 0);
  return date;
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

const calculateTotalSeconds = (checkInAt: Date | null, checkOutAt: Date | null) => {
  if (!checkInAt || !checkOutAt) return null;
  const diff = Math.max(0, checkOutAt.getTime() - checkInAt.getTime());
  return Math.floor(diff / 1000);
};

const buildEmployees = (
  users: Array<
    Prisma.UserGetPayload<{
      select: {
        id: true;
        email: true;
        profile: { select: { firstName: true; lastName: true; preferredName: true } };
        employment: {
          select: {
            department: { select: { name: true } };
            team: { select: { name: true } };
          };
        };
      };
    }>
  >,
): HrAttendanceEmployeeOption[] =>
  users.map((user) => ({
    id: user.id,
    name: formatEmployeeName({
      preferredName: user.profile?.preferredName ?? null,
      firstName: user.profile?.firstName ?? null,
      lastName: user.profile?.lastName ?? null,
      email: user.email,
    }),
    department: user.employment?.department?.name ?? null,
    squad: user.employment?.team?.name ?? null,
  }));

export const hrAttendanceService = {
  async overview(ctx: TRPCContext, input: HrAttendanceOverviewInput): Promise<HrAttendanceOverviewResponse> {
    const sessionUser = requireHrAdmin(ctx);
    const organizationId = sessionUser.organizationId;
    const organizationTimeZone = sessionUser.organization?.timezone ?? null;
    const targetDate = startOfDay(parseDateOrThrow(input.date, "Invalid date provided."));

    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);

    const trendDays = 5;
    const trendStart = startOfDay(addDays(targetDate, -(trendDays - 1)));
    const trendEnd = addDays(targetDate, 1);

    const [employees, dayRecords, monthRecords, trendRecords, policyRecord] = await Promise.all([
      ctx.prisma.user.findMany({
        where: {
          organizationId,
          status: {
            in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION],
          },
        },
        orderBy: [
          { profile: { firstName: "asc" } },
          { email: "asc" },
        ],
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              preferredName: true,
            },
          },
          employment: {
            select: {
              department: {
                select: {
                  name: true,
                },
              },
              team: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      ctx.prisma.attendanceRecord.findMany({
        where: {
          attendanceDate: {
            gte: targetDate,
            lt: addDays(targetDate, 1),
          },
          employee: {
            organizationId,
          },
        },
        orderBy: {
          employee: {
            profile: {
              firstName: "asc",
            },
          },
        },
        select: attendanceRecordSelect,
      }),
      ctx.prisma.attendanceRecord.findMany({
        where: {
          attendanceDate: {
            gte: monthStart,
            lt: monthEnd,
          },
          employee: {
            organizationId,
          },
        },
        select: attendanceRecordSelect,
      }),
      ctx.prisma.attendanceRecord.findMany({
        where: {
          attendanceDate: {
            gte: trendStart,
            lt: trendEnd,
          },
          employee: {
            organizationId,
          },
        },
        select: attendanceRecordSelect,
      }),
      ctx.prisma.workPolicy.findUnique({
        where: { organizationId },
        select: {
          onsiteStartTime: true,
          remoteStartTime: true,
        },
      }),
    ]);

    const employeesOptions = buildEmployees(employees);
    const policyTimings = resolvePolicyTimings(policyRecord);
    const dayLogs = dayRecords.map((record) => mapLog(record, policyTimings, organizationTimeZone));
    const statusCounts = dayLogs.reduce((acc, log) => {
      acc[log.status] += 1;
      return acc;
    }, emptyStatusCounts());

    const calendar = buildCalendar(
      monthStart,
      monthEnd,
      monthRecords,
      policyTimings,
      organizationTimeZone,
    );
    const weeklyTrend = buildWeeklyTrend(
      trendStart,
      trendDays,
      trendRecords,
      employeesOptions.length,
      policyTimings,
      organizationTimeZone,
    );

    return {
      date: formatDateKey(targetDate),
      employees: employeesOptions,
      dayLogs,
      statusCounts,
      calendar,
      weeklyTrend,
    };
  },

  async history(ctx: TRPCContext, input: HrAttendanceHistoryInput): Promise<HrAttendanceHistoryResponse> {
    const sessionUser = requireHrAdmin(ctx);
    const organizationId = sessionUser.organizationId;
    const organizationTimeZone = sessionUser.organization?.timezone ?? null;

    const monthStart = new Date(input.year, input.month, 1);
    const monthEnd = new Date(input.year, input.month + 1, 1);

    const [rows, policyRecord] = await Promise.all([
      ctx.prisma.attendanceRecord.findMany({
        where: {
          employeeId: input.employeeId,
          attendanceDate: {
            gte: monthStart,
            lt: monthEnd,
          },
          employee: {
            organizationId,
          },
        },
        orderBy: {
          attendanceDate: "desc",
        },
        select: attendanceRecordSelect,
      }),
      ctx.prisma.workPolicy.findUnique({
        where: { organizationId },
        select: {
          onsiteStartTime: true,
          remoteStartTime: true,
        },
      }),
    ]);

    const policyTimings = resolvePolicyTimings(policyRecord);

    return {
      employeeId: input.employeeId,
      month: input.month,
      year: input.year,
      rows: rows.map((record) => ({
        date: formatDateKey(record.attendanceDate),
        checkIn: formatTimeLabel(record.checkInAt, organizationTimeZone),
        checkOut: formatTimeLabel(record.checkOutAt, organizationTimeZone),
        status: resolveHrStatusWithPolicy(record, policyTimings, organizationTimeZone),
        source: isManualSource(record.source) ? "Manual" : "System",
      })),
    };
  },

  async recordManualEntry(ctx: TRPCContext, input: HrAttendanceManualEntryInput): Promise<HrAttendanceLog> {
    const sessionUser = requireHrAdmin(ctx);
    const organizationId = sessionUser.organizationId;
    const organizationTimeZone = sessionUser.organization?.timezone ?? null;
    const attendanceDate = startOfDay(parseDateOrThrow(input.date, "Invalid date provided."));

    const [employee, policyRecord] = await Promise.all([
      ctx.prisma.user.findFirst({
        where: {
          id: input.employeeId,
          organizationId,
        },
        select: {
          id: true,
          employment: {
            select: {
              primaryLocation: true,
            },
          },
          organization: {
            select: {
              timezone: true,
            },
          },
        },
      }),
      ctx.prisma.workPolicy.findUnique({
        where: { organizationId },
        select: {
          onsiteStartTime: true,
          remoteStartTime: true,
        },
      }),
    ]);

    if (!employee) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });
    }

    const locationTimeZone = resolveTimeZoneFromLocation(
      employee.employment?.primaryLocation ?? null,
      employee.organization?.timezone ?? null,
    );

    const checkInAt = parseTimeToDate(input.checkIn ?? null, attendanceDate, {
      timeZone: locationTimeZone,
    });
    const checkOutAt = parseTimeToDate(input.checkOut ?? null, attendanceDate, {
      timeZone: locationTimeZone,
    });
    const totalWorkSeconds = calculateTotalSeconds(checkInAt, checkOutAt);
    const locationLabel = WORK_TYPE_LABELS[input.workType];
    const policyTimings = resolvePolicyTimings(policyRecord);
    const scheduleTimeZone =
      locationTimeZone ?? employee.organization?.timezone ?? organizationTimeZone;
    const attendanceStatus = resolveStatusFromCheckIn(
      checkInAt,
      attendanceDate,
      input.workType,
      policyTimings,
      scheduleTimeZone,
    );

    const record = await ctx.prisma.attendanceRecord.upsert({
      where: {
        employeeId_attendanceDate: {
          employeeId: input.employeeId,
          attendanceDate,
        },
      },
      update: {
        checkInAt,
        checkOutAt,
        totalWorkSeconds: totalWorkSeconds ?? undefined,
        status: attendanceStatus,
        source: "HR_MANUAL",
        location: locationLabel,
      },
      create: {
        employeeId: input.employeeId,
        attendanceDate,
        checkInAt,
        checkOutAt,
        totalWorkSeconds: totalWorkSeconds ?? undefined,
        status: attendanceStatus,
        source: "HR_MANUAL",
        location: locationLabel,
      },
      select: attendanceRecordSelect,
    });

    const resolvedTimeZone = employee.organization?.timezone ?? organizationTimeZone;

    return mapLog(record, policyTimings, resolvedTimeZone);
  },
};
