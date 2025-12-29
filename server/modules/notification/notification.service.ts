import { TRPCError } from "@trpc/server";
import {
  NotificationAudience,
  NotificationStatus,
  NotificationType,
  Prisma,
  type UserRole,
} from "@prisma/client";

import type { TRPCContext } from "@/server/api/trpc";

const notificationBaseSelect = {
  id: true,
  title: true,
  body: true,
  type: true,
  status: true,
  actionUrl: true,
  metadata: true,
  audience: true,
  targetRoles: true,
  targetUserId: true,
  sentAt: true,
  scheduledAt: true,
  createdAt: true,
  sender: {
    select: {
      id: true,
      email: true,
      profile: {
        select: {
          preferredName: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
} as const satisfies Prisma.NotificationSelect;

const buildNotificationSelect = (userId: string) =>
  ({
    ...notificationBaseSelect,
    receipts: {
      where: { userId },
      select: { isSeen: true },
      take: 1,
    },
  }) as const satisfies Prisma.NotificationSelect;

type NotificationRecord = Prisma.NotificationGetPayload<{
  select: ReturnType<typeof buildNotificationSelect>;
}>;

const visibleStatuses = [
  NotificationStatus.SENT,
  NotificationStatus.SCHEDULED,
];

const notificationOrder: Prisma.NotificationOrderByWithRelationInput[] = [
  { sentAt: "desc" },
  { scheduledAt: "desc" },
  { createdAt: "desc" },
];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

type NotificationSource = "MANAGEMENT" | "SYSTEM";

const notificationSourceMap: Record<NotificationType, NotificationSource> = {
  [NotificationType.ANNOUNCEMENT]: "MANAGEMENT",
  [NotificationType.LEAVE]: "SYSTEM",
  [NotificationType.ATTENDANCE]: "SYSTEM",
  [NotificationType.REPORT]: "SYSTEM",
  [NotificationType.INVOICE]: "SYSTEM",
};

const sourceLabelMap: Record<NotificationSource, string> = {
  MANAGEMENT: "Management",
  SYSTEM: "System",
};

const buildAudienceScope = (userId: string, role: UserRole): Prisma.NotificationWhereInput => ({
  OR: [
    { audience: NotificationAudience.ORGANIZATION },
    {
      audience: NotificationAudience.ROLE,
      targetRoles: {
        has: role,
      },
    },
    {
      audience: NotificationAudience.INDIVIDUAL,
      targetUserId: userId,
    },
  ],
});

const buildNotificationWhere = ({
  organizationId,
  userId,
  role,
  type,
}: {
  organizationId: string;
  userId: string;
  role: UserRole;
  type?: NotificationType;
}): Prisma.NotificationWhereInput => ({
  organizationId,
  status: {
    in: visibleStatuses,
  },
  ...(type ? { type } : {}),
  AND: [buildAudienceScope(userId, role)],
});

const buildTypeCounts = (
  grouped: Array<{ type: NotificationType; _count: { _all: number } }>,
) => {
  const initial = Object.values(NotificationType).reduce<Record<NotificationType, number>>(
    (acc, value) => {
      acc[value] = 0;
      return acc;
    },
    {} as Record<NotificationType, number>,
  );

  grouped.forEach((entry) => {
    initial[entry.type] = entry._count._all;
  });

  return initial;
};

const toMetadataRecord = (value: Prisma.JsonValue | null): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getStringValue = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const parseNumberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const formatCurrencyValue = (amount: number | null, currency?: string | null) => {
  if (amount === null) return null;
  if (currency) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(amount);
    } catch (error) {
      void error;
    }
  }
  return amount.toFixed(2);
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return dateFormatter.format(parsed);
};

const formatMonthLabel = (value?: string | null) => {
  if (!value) return null;
  const withDay = value.includes("-") ? `${value}-01` : value;
  const parsed = new Date(withDay);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return monthFormatter.format(parsed);
};

const formatDateRangeLabel = (start?: string | null, end?: string | null) => {
  if (!start && !end) {
    return null;
  }
  const startLabel = formatDateLabel(start);
  const endLabel = formatDateLabel(end);
  if (startLabel && endLabel && startLabel !== endLabel) {
    return `${startLabel} -> ${endLabel}`;
  }
  return startLabel ?? endLabel;
};

type NotificationHighlight = {
  label: string;
  value: string;
};

const buildAnnouncementHighlights = (metadata: Record<string, unknown> | null) => {
  if (!metadata) return [] as NotificationHighlight[];
  const highlights: NotificationHighlight[] = [];
  const effective = formatDateLabel(
    getStringValue(metadata.effectiveDate) ?? getStringValue(metadata.holidayDate),
  );
  if (effective) {
    highlights.push({ label: "Effective date", value: effective });
  }
  const appliesTo = getStringValue(metadata.appliesTo);
  if (appliesTo) {
    highlights.push({ label: "Applies to", value: appliesTo });
  }
  const region = getStringValue(metadata.region);
  if (region) {
    highlights.push({ label: "Region", value: region });
  }
  const reason = getStringValue(metadata.reason);
  if (reason) {
    highlights.push({ label: "Reason", value: reason });
  }
  return highlights;
};

const buildLeaveHighlights = (metadata: Record<string, unknown> | null) => {
  if (!metadata) return [] as NotificationHighlight[];
  const highlights: NotificationHighlight[] = [];
  const leaveType = getStringValue(metadata.leaveType);
  if (leaveType) {
    highlights.push({ label: "Leave type", value: leaveType });
  }
  const dates = isRecord(metadata.dates) ? metadata.dates : null;
  const scheduled = formatDateRangeLabel(
    dates ? getStringValue(dates.start) : null,
    dates ? getStringValue(dates.end) : null,
  );
  if (scheduled) {
    highlights.push({ label: "Schedule", value: scheduled });
  }
  const decision = getStringValue(metadata.decision);
  if (decision) {
    highlights.push({ label: "Decision", value: decision });
  }
  return highlights;
};

const buildAttendanceHighlights = (metadata: Record<string, unknown> | null) => {
  if (!metadata) return [] as NotificationHighlight[];
  const highlights: NotificationHighlight[] = [];
  const date = formatDateLabel(getStringValue(metadata.attendanceDate));
  if (date) {
    highlights.push({ label: "Attendance date", value: date });
  }
  const shift = getStringValue(metadata.shiftStart);
  if (shift) {
    highlights.push({ label: "Shift start", value: shift });
  }
  const checkIn = getStringValue(metadata.checkInAt);
  if (checkIn) {
    highlights.push({ label: "Check-in", value: checkIn });
  }
  return highlights;
};

const buildReportHighlights = (metadata: Record<string, unknown> | null) => {
  if (!metadata) return [] as NotificationHighlight[];
  const highlights: NotificationHighlight[] = [];
  const date = formatDateLabel(getStringValue(metadata.date));
  if (date) {
    highlights.push({ label: "Report date", value: date });
  }
  const month = formatMonthLabel(getStringValue(metadata.reportMonth));
  if (month) {
    highlights.push({ label: "Report month", value: month });
  }
  const owner = getStringValue(metadata.ownerTeam);
  if (owner) {
    highlights.push({ label: "Owner", value: owner });
  }
  if (Array.isArray(metadata.missingEmployees) && metadata.missingEmployees.length > 0) {
    const count = metadata.missingEmployees.length;
    highlights.push({
      label: "Missing submissions",
      value: `${count} teammate${count === 1 ? "" : "s"}`,
    });
  }
  return highlights;
};

const buildInvoiceHighlights = (metadata: Record<string, unknown> | null) => {
  if (!metadata) return [] as NotificationHighlight[];
  const highlights: NotificationHighlight[] = [];
  const period = getStringValue(metadata.periodLabel ?? metadata.period);
  if (period) {
    highlights.push({ label: "Period", value: period });
  }
  const total = formatCurrencyValue(
    parseNumberValue(metadata.total),
    getStringValue(metadata.currency),
  );
  if (total) {
    highlights.push({ label: "Total", value: total });
  }
  const status = getStringValue(metadata.statusLabel ?? metadata.status);
  if (status) {
    highlights.push({ label: "Status", value: status });
  }
  return highlights;
};

const buildHighlights = (record: NotificationRecord, metadata: Record<string, unknown> | null) => {
  switch (record.type) {
    case NotificationType.ANNOUNCEMENT:
      return buildAnnouncementHighlights(metadata);
    case NotificationType.LEAVE:
      return buildLeaveHighlights(metadata);
    case NotificationType.ATTENDANCE:
      return buildAttendanceHighlights(metadata);
    case NotificationType.REPORT:
      return buildReportHighlights(metadata);
    case NotificationType.INVOICE:
      return buildInvoiceHighlights(metadata);
    default:
      return [] as NotificationHighlight[];
  }
};

const formatRoleLabel = (role: UserRole) =>
  role
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

const buildAudienceLabel = (record: NotificationRecord, currentUserId: string) => {
  switch (record.audience) {
    case NotificationAudience.ORGANIZATION:
      return "Entire organization";
    case NotificationAudience.ROLE:
      return record.targetRoles.length
        ? record.targetRoles.map((role) => formatRoleLabel(role)).join(", ")
        : "Role specific";
    case NotificationAudience.INDIVIDUAL:
      return record.targetUserId && record.targetUserId === currentUserId
        ? "You"
        : "Individual teammate";
    default:
      return "Audience";
  }
};

type NotificationSenderSummary = {
  id: string;
  name: string;
  email: string;
};

const buildSenderSummary = (record: NotificationRecord): NotificationSenderSummary | null => {
  if (!record.sender) {
    return null;
  }
  const profile = record.sender.profile;
  const fullName =
    [profile?.preferredName, profile?.firstName, profile?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || record.sender.email;

  return {
    id: record.sender.id,
    name: fullName,
    email: record.sender.email,
  };
};

const transformRecord = (record: NotificationRecord) => {
  const timestamp = (record.sentAt ?? record.scheduledAt ?? record.createdAt).toISOString();
  const source = notificationSourceMap[record.type];
  const receipt = record.receipts?.[0];

  return {
    id: record.id,
    title: record.title,
    body: record.body,
    type: record.type,
    status: record.status,
    isSeen: receipt?.isSeen ?? false,
    actionUrl: record.actionUrl ?? null,
    timestamp,
    source,
    sourceLabel: sourceLabelMap[source],
  } satisfies NotificationListItem;
};

export type NotificationListItem = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  status: NotificationStatus;
  isSeen: boolean;
  actionUrl: string | null;
  timestamp: string;
  source: NotificationSource;
  sourceLabel: string;
};

export type NotificationListInput = { type?: NotificationType } | undefined;

export type NotificationListResponse = {
  notifications: NotificationListItem[];
  total: number;
  counts: {
    overall: number;
    perType: Record<NotificationType, number>;
  };
};

export type NotificationDetailResponse = NotificationListItem & {
  audience: NotificationAudience;
  audienceLabel: string;
  metadata: Record<string, unknown> | null;
  highlights: NotificationHighlight[];
  sender: NotificationSenderSummary | null;
};

export type NotificationUnseenCountResponse = {
  unseen: number;
};

export type NotificationMarkSeenResponse = {
  id: string;
  isSeen: boolean;
};

const getSessionContext = (ctx: TRPCContext) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const organizationId = ctx.session.user.organization?.id ?? ctx.session.user.organizationId;

  if (!organizationId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Missing organization context for notifications.",
    });
  }

  return {
    organizationId,
    userId: ctx.session.user.id,
    role: ctx.session.user.role,
  } as const;
};

const list = async (
  ctx: TRPCContext,
  input: NotificationListInput = {},
): Promise<NotificationListResponse> => {
  const { organizationId, userId, role } = getSessionContext(ctx);
  const typeFilter = input?.type;
  const select = buildNotificationSelect(userId);

  const [records, grouped] = await Promise.all([
    ctx.prisma.notification.findMany({
      where: buildNotificationWhere({ organizationId, userId, role, type: typeFilter }),
      select,
      orderBy: notificationOrder,
    }),
    ctx.prisma.notification.groupBy({
      by: ["type"],
      _count: { _all: true },
      where: buildNotificationWhere({ organizationId, userId, role }),
    }),
  ]);

  const perType = buildTypeCounts(grouped);
  const notifications = records.map((record) => transformRecord(record));

  return {
    notifications,
    total: notifications.length,
    counts: {
      overall: Object.values(perType).reduce((total, value) => total + value, 0),
      perType,
    },
  };
};

const getById = async (
  ctx: TRPCContext,
  input: { id: string },
): Promise<NotificationDetailResponse> => {
  const { organizationId, userId, role } = getSessionContext(ctx);

  const record = await ctx.prisma.notification.findFirst({
    where: {
      id: input.id,
      ...buildNotificationWhere({ organizationId, userId, role }),
    },
    select: buildNotificationSelect(userId),
  });

  if (!record) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Notification could not be found.",
    });
  }

  const base = transformRecord(record);
  const metadata = toMetadataRecord(record.metadata);

  return {
    ...base,
    audience: record.audience,
    audienceLabel: buildAudienceLabel(record, userId),
    metadata,
    highlights: buildHighlights(record, metadata),
    sender: buildSenderSummary(record),
  };
};

const getUnseenCount = async (ctx: TRPCContext): Promise<NotificationUnseenCountResponse> => {
  const { organizationId, userId, role } = getSessionContext(ctx);
  const baseWhere = buildNotificationWhere({ organizationId, userId, role });

  const unseen = await ctx.prisma.notification.count({
    where: {
      ...baseWhere,
      status: NotificationStatus.SENT,
      receipts: {
        none: {
          userId,
          isSeen: true,
        },
      },
    },
  });

  return { unseen };
};

const markAsSeen = async (
  ctx: TRPCContext,
  input: { id: string },
): Promise<NotificationMarkSeenResponse> => {
  const { organizationId, userId, role } = getSessionContext(ctx);

  const record = await ctx.prisma.notification.findFirst({
    where: {
      id: input.id,
      ...buildNotificationWhere({ organizationId, userId, role }),
    },
    select: {
      id: true,
      receipts: {
        where: { userId },
        select: { id: true, isSeen: true },
        take: 1,
      },
    },
  });

  if (!record) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Notification could not be found.",
    });
  }

  const receipt = record.receipts?.[0];
  if (!receipt?.isSeen) {
    const now = new Date();
    await ctx.prisma.notificationReceipt.upsert({
      where: {
        notificationId_userId: {
          notificationId: record.id,
          userId,
        },
      },
      create: {
        notificationId: record.id,
        userId,
        isSeen: true,
        seenAt: now,
      },
      update: {
        isSeen: true,
        seenAt: now,
      },
    });
  }

  return {
    id: record.id,
    isSeen: true,
  };
};

export const NotificationService = {
  list,
  getById,
  getUnseenCount,
  markAsSeen,
};
