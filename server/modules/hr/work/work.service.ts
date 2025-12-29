import {
  NotificationAudience,
  NotificationStatus,
  NotificationType,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import type {
  HrHolidaySummary,
  HrWorkOverviewResponse,
  HrWorkPolicy,
  WeekdayOption,
} from "@/types/hr-work";
import { WEEKDAY_OPTIONS, canManageWork } from "@/types/hr-work";
import { requireWorkManager } from "@/server/modules/hr/utils";
import {
  emitNotificationRealtimeEvent,
  notificationRealtimeSelect,
} from "@/server/modules/notification/notification.events";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const DEFAULT_POLICY: HrWorkPolicy = {
  onsiteStartTime: "09:00",
  onsiteEndTime: "18:00",
  remoteStartTime: "08:00",
  remoteEndTime: "17:00",
  workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as WeekdayOption[],
  weekendDays: ["SATURDAY", "SUNDAY"] as WeekdayOption[],
};

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatDayLabel = (day: WeekdayOption) =>
  day
    .split("_")
    .map((piece) => piece.charAt(0) + piece.slice(1).toLowerCase())
    .join(" ");

const sortWeekdays = (values: WeekdayOption[]) =>
  [...values].sort((a, b) => WEEKDAY_OPTIONS.indexOf(a) - WEEKDAY_OPTIONS.indexOf(b));

const formatDayList = (values: WeekdayOption[]) =>
  values.length ? sortWeekdays(values).map((day) => formatDayLabel(day)).join(", ") : "Not set";

const normalizeDate = (input: string) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Provide a valid holiday date." });
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const validateTime = (label: string, value: string) => {
  if (!timePattern.test(value)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${label} must be in 24h HH:MM format.`,
    });
  }
  return value;
};

const ensurePolicy = async (ctx: TRPCContext, organizationId: string) => {
  const record = await ctx.prisma.workPolicy.findUnique({
    where: { organizationId },
  });

  if (record) {
    return record;
  }

  return ctx.prisma.workPolicy.create({
    data: {
      organizationId,
      onsiteStartTime: DEFAULT_POLICY.onsiteStartTime,
      onsiteEndTime: DEFAULT_POLICY.onsiteEndTime,
      remoteStartTime: DEFAULT_POLICY.remoteStartTime,
      remoteEndTime: DEFAULT_POLICY.remoteEndTime,
      workingDays: DEFAULT_POLICY.workingDays,
      weekendDays: DEFAULT_POLICY.weekendDays,
    },
  });
};

const toPolicy = (record: {
  onsiteStartTime: string;
  onsiteEndTime: string;
  remoteStartTime: string;
  remoteEndTime: string;
  workingDays: string[];
  weekendDays: string[];
}): HrWorkPolicy => ({
  onsiteStartTime: record.onsiteStartTime,
  onsiteEndTime: record.onsiteEndTime,
  remoteStartTime: record.remoteStartTime,
  remoteEndTime: record.remoteEndTime,
  workingDays: record.workingDays as WeekdayOption[],
  weekendDays: record.weekendDays as WeekdayOption[],
});

const toHolidaySummary = (record: {
  id: string;
  title: string;
  description: string | null;
  date: Date;
}): HrHolidaySummary => ({
  id: record.id,
  title: record.title,
  description: record.description,
  dateIso: record.date.toISOString(),
  dateLabel: timeFormatter.format(record.date),
});

const assertWeekday = (value: string): WeekdayOption => {
  if ((WEEKDAY_OPTIONS as readonly string[]).includes(value)) {
    return value as WeekdayOption;
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Invalid weekday provided.",
  });
};

export const hrWorkService = {
  async overview(ctx: TRPCContext): Promise<HrWorkOverviewResponse> {
    const user = requireWorkManager(ctx);
    const organizationId = user.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Join an organization to view work settings.",
      });
    }

    const [policyRecord, holidayRecords] = await Promise.all([
      ensurePolicy(ctx, organizationId),
      ctx.prisma.holiday.findMany({
        where: { organizationId },
        orderBy: { date: "asc" },
      }),
    ]);

    return {
      viewerRole: user.role,
      canManage: canManageWork(user.role),
      policy: toPolicy(policyRecord),
      holidays: holidayRecords.map(toHolidaySummary),
    };
  },

  async createHoliday(
    ctx: TRPCContext,
    input: { title: string; date: string; description?: string | null },
  ) {
    const user = requireWorkManager(ctx);
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Organization context missing." });
    }

    const normalizedDate = normalizeDate(input.date);
    const title = input.title.trim();
    const description = input.description?.trim() ? input.description.trim() : null;
    const readableDate = timeFormatter.format(normalizedDate);

    try {
      const notifications = await ctx.prisma.$transaction(async (tx) => {
        const holidayRecord = await tx.holiday.create({
          data: {
            organizationId,
            title,
            date: normalizedDate,
            description,
          },
        });

        const sentAt = new Date();
        const descriptionSuffix = description ? ` ${description}` : "";

        const notificationRecord = await tx.notification.create({
          data: {
            organizationId,
            senderId: user.id,
            title: `New holiday scheduled: ${title}`,
            body: `${title} will be observed on ${readableDate}.${descriptionSuffix}`,
            type: NotificationType.ANNOUNCEMENT,
            status: NotificationStatus.SENT,
            audience: NotificationAudience.ORGANIZATION,
            actionUrl: "/holidays",
            metadata: {
              holidayId: holidayRecord.id,
              holidayDate: normalizedDate.toISOString(),
              appliesTo: "All employees",
              ...(description ? { reason: description } : {}),
            },
            sentAt,
          },
          select: notificationRealtimeSelect,
        });
        return [notificationRecord];
      });
      if (notifications.length > 0) {
        void emitNotificationRealtimeEvent(ctx.prisma, notifications);
      }
    } catch (error) {
      void error;
      throw new TRPCError({
        code: "CONFLICT",
        message: "This date is already marked as a holiday.",
      });
    }
  },

  async updateWorkingHours(
    ctx: TRPCContext,
    input: {
      onsiteStartTime: string;
      onsiteEndTime: string;
      remoteStartTime: string;
      remoteEndTime: string;
    },
  ) {
    const user = requireWorkManager(ctx);
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Organization context missing." });
    }

    const onsStart = validateTime("On-site start time", input.onsiteStartTime);
    const onsEnd = validateTime("On-site end time", input.onsiteEndTime);
    const remoteStart = validateTime("Remote start time", input.remoteStartTime);
    const remoteEnd = validateTime("Remote end time", input.remoteEndTime);

    await ctx.prisma.workPolicy.upsert({
      where: { organizationId },
      create: {
        organizationId,
        onsiteStartTime: onsStart,
        onsiteEndTime: onsEnd,
        remoteStartTime: remoteStart,
        remoteEndTime: remoteEnd,
        workingDays: DEFAULT_POLICY.workingDays,
        weekendDays: DEFAULT_POLICY.weekendDays,
      },
      update: {
        onsiteStartTime: onsStart,
        onsiteEndTime: onsEnd,
        remoteStartTime: remoteStart,
        remoteEndTime: remoteEnd,
      },
    });

    const sentAt = new Date();
    const onsiteWindow = `${onsStart} - ${onsEnd}`;
    const remoteWindow = `${remoteStart} - ${remoteEnd}`;

    const notificationRecord = await ctx.prisma.notification.create({
      data: {
        organizationId,
        senderId: user.id,
        title: "Working hours updated",
        body: `On-site ${onsiteWindow} | Remote ${remoteWindow}`,
        type: NotificationType.ANNOUNCEMENT,
        status: NotificationStatus.SENT,
        audience: NotificationAudience.ORGANIZATION,
        actionUrl: "/attendance",
        metadata: {
          effectiveDate: sentAt.toISOString(),
          appliesTo: "All employees",
          onsiteStartTime: onsStart,
          onsiteEndTime: onsEnd,
          remoteStartTime: remoteStart,
          remoteEndTime: remoteEnd,
        },
        sentAt,
      },
    });
    void emitNotificationRealtimeEvent(ctx.prisma, notificationRecord);
  },

  async updateWeekSchedule(
    ctx: TRPCContext,
    input: { workingDays: WeekdayOption[]; weekendDays: WeekdayOption[] },
  ) {
    const user = requireWorkManager(ctx);
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Organization context missing." });
    }

    if (!input.workingDays.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Select at least one working day.",
      });
    }
    if (!input.weekendDays.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Select at least one weekend day.",
      });
    }

    const workingDays = input.workingDays.map(assertWeekday);
    const weekendDays = input.weekendDays.map(assertWeekday);

    const overlap = workingDays.filter((day) => weekendDays.includes(day));
    if (overlap.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A day cannot be marked as both working and weekend.",
      });
    }

    await ctx.prisma.workPolicy.upsert({
      where: { organizationId },
      create: {
        organizationId,
        onsiteStartTime: DEFAULT_POLICY.onsiteStartTime,
        onsiteEndTime: DEFAULT_POLICY.onsiteEndTime,
        remoteStartTime: DEFAULT_POLICY.remoteStartTime,
        remoteEndTime: DEFAULT_POLICY.remoteEndTime,
        workingDays,
        weekendDays,
      },
      update: {
        workingDays,
        weekendDays,
      },
    });

    const sentAt = new Date();
    const workingLabel = formatDayList(workingDays);
    const weekendLabel = formatDayList(weekendDays);

    const notificationRecord = await ctx.prisma.notification.create({
      data: {
        organizationId,
        senderId: user.id,
        title: "Workweek cadence updated",
        body: `Working days: ${workingLabel} | Weekend: ${weekendLabel}`,
        type: NotificationType.ANNOUNCEMENT,
        status: NotificationStatus.SENT,
        audience: NotificationAudience.ORGANIZATION,
        actionUrl: "/attendance",
        metadata: {
          effectiveDate: sentAt.toISOString(),
          appliesTo: "All employees",
          workingDays: sortWeekdays(workingDays),
          weekendDays: sortWeekdays(weekendDays),
        },
        sentAt,
      },
    });
    void emitNotificationRealtimeEvent(ctx.prisma, notificationRecord);
  },
};
