import {
  EmploymentStatus,
  NotificationAudience,
  NotificationStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";

import type { TRPCContext } from "@/server/api/trpc";
import type {
  HrAnnouncementListItem,
  HrAnnouncementOverviewResponse,
  HrAnnouncementRecipient,
} from "@/types/hr-announcement";
import { requireHrAdmin } from "@/server/modules/hr/utils";
import {
  emitNotificationRealtimeEvent,
  notificationRealtimeSelect,
} from "@/server/modules/notification/notification.events";

const ANNOUNCEMENT_LIMIT = 40;

const namedUserSelect = {
  id: true,
  email: true,
  role: true,
  profile: {
    select: {
      preferredName: true,
      firstName: true,
      lastName: true,
    },
  },
} as const satisfies Prisma.UserSelect;

type NamedUserRecord = Prisma.UserGetPayload<{ select: typeof namedUserSelect }>;

const announcementSelect = {
  id: true,
  title: true,
  body: true,
  status: true,
  audience: true,
  metadata: true,
  sentAt: true,
  createdAt: true,
  sender: {
    select: namedUserSelect,
  },
  targetUser: {
    select: namedUserSelect,
  },
} as const satisfies Prisma.NotificationSelect;

type AnnouncementRecord = Prisma.NotificationGetPayload<{ select: typeof announcementSelect }>;

const toMetadataRecord = (value: Prisma.JsonValue | null): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const formatDisplayName = (record?: NamedUserRecord | null) => {
  if (!record) {
    return null;
  }
  const profile = record.profile;
  const parts = [profile?.preferredName, profile?.firstName, profile?.lastName]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return record.email;
};

const toRecipientSummary = (record: NamedUserRecord): HrAnnouncementRecipient => ({
  id: record.id,
  name: formatDisplayName(record) ?? record.email,
  email: record.email,
  role: record.role,
});

const buildBodyPreview = (value: string, limit = 160) => {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1)}…`;
};

const buildAudienceLabel = (entry: {
  audience: NotificationAudience;
  recipients: HrAnnouncementRecipient[];
}) => {
  if (entry.audience === NotificationAudience.ORGANIZATION) {
    return "Entire organization";
  }
  if (entry.recipients.length === 0) {
    return "Specific teammates";
  }
  if (entry.recipients.length === 1) {
    return entry.recipients[0].name;
  }
  return `${entry.recipients.length} teammates`;
};

const transformAnnouncements = (records: AnnouncementRecord[]): HrAnnouncementListItem[] => {
  const groups = new Map<
    string,
    {
      id: string;
      title: string;
      body: string;
      status: NotificationStatus;
      audience: NotificationAudience;
      sentAt: Date | null;
      createdAt: Date;
      recipients: HrAnnouncementRecipient[];
      senderId: string | null;
      senderName: string | null;
    }
  >();

  records.forEach((record) => {
    const metadata = toMetadataRecord(record.metadata);
    const dispatchId =
      typeof metadata?.dispatchId === "string" && metadata.dispatchId.trim().length > 0
        ? metadata.dispatchId
        : record.id;
    const audienceOverride = metadata?.audienceMode;
    const normalizedAudience =
      audienceOverride === NotificationAudience.ORGANIZATION ||
      audienceOverride === NotificationAudience.INDIVIDUAL
        ? audienceOverride
        : record.audience;
    const senderName = formatDisplayName(record.sender);
    const existing = groups.get(dispatchId);

    if (!existing) {
      groups.set(dispatchId, {
        id: dispatchId,
        title: record.title,
        body: record.body,
        status: record.status,
        audience: normalizedAudience,
        sentAt: record.sentAt ?? null,
        createdAt: record.createdAt,
        recipients: [],
        senderId: record.sender?.id ?? null,
        senderName,
      });
    } else {
      if (!existing.sentAt || (record.sentAt && record.sentAt > existing.sentAt)) {
        existing.sentAt = record.sentAt ?? existing.sentAt;
      }
      if (record.createdAt < existing.createdAt) {
        existing.createdAt = record.createdAt;
      }
      if (normalizedAudience === NotificationAudience.ORGANIZATION) {
        existing.audience = NotificationAudience.ORGANIZATION;
      }
      if (!existing.senderName && senderName) {
        existing.senderName = senderName;
      }
      if (!existing.senderId && record.sender?.id) {
        existing.senderId = record.sender.id;
      }
    }

    if (record.audience === NotificationAudience.INDIVIDUAL && record.targetUser) {
      const recipient = toRecipientSummary(record.targetUser);
      const nextGroup = groups.get(dispatchId);
      if (nextGroup && !nextGroup.recipients.some((entry) => entry.id === recipient.id)) {
        nextGroup.recipients.push(recipient);
      }
    }
  });

  const ordered = Array.from(groups.values()).sort((a, b) => {
    const aTime = (a.sentAt ?? a.createdAt).getTime();
    const bTime = (b.sentAt ?? b.createdAt).getTime();
    return bTime - aTime;
  });

  return ordered.map((entry) => ({
    id: entry.id,
    title: entry.title,
    body: entry.body,
    bodyPreview: buildBodyPreview(entry.body),
    status: entry.status,
    audience: entry.audience,
    audienceLabel: buildAudienceLabel(entry),
    sentAt: entry.sentAt ? entry.sentAt.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
    recipientCount: entry.recipients.length,
    recipients: entry.recipients.sort((a, b) => a.name.localeCompare(b.name)),
    isOrganizationWide: entry.audience === NotificationAudience.ORGANIZATION,
    senderId: entry.senderId,
    senderName: entry.senderName,
  }));
};

const overview = async (ctx: TRPCContext): Promise<HrAnnouncementOverviewResponse> => {
  const viewer = requireHrAdmin(ctx);
  const organizationId = viewer.organizationId;

  const [announcementRecords, employees] = await Promise.all([
    ctx.prisma.notification.findMany({
      where: {
        organizationId,
        type: NotificationType.ANNOUNCEMENT,
      },
      select: announcementSelect,
      orderBy: [{ sentAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: ANNOUNCEMENT_LIMIT,
    }),
    ctx.prisma.user.findMany({
      where: {
        organizationId,
        status: { not: EmploymentStatus.TERMINATED },
      },
      select: namedUserSelect,
      orderBy: [{ profile: { firstName: "asc" } }, { profile: { lastName: "asc" } }, { email: "asc" }],
    }),
  ]);

  return {
    viewerRole: viewer.role,
    announcements: transformAnnouncements(announcementRecords),
    recipients: employees.map(toRecipientSummary),
  };
};

const send = async (
  ctx: TRPCContext,
  input: {
    title: string;
    body: string;
    audience: NotificationAudience;
    recipientIds?: string[] | null;
  },
) => {
  const viewer = requireHrAdmin(ctx);
  const organizationId = viewer.organizationId;
  const title = input.title.trim();
  const body = input.body.trim();

  if (!title) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Provide an announcement topic." });
  }
  if (!body) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Write the announcement details." });
  }

  const dispatchId = randomUUID();
  const sentAt = new Date();
  const metadataBase = {
    dispatchId,
    audienceMode: input.audience,
    manualAnnouncement: true,
  };

  if (input.audience === NotificationAudience.ORGANIZATION) {
    const notificationRecord = await ctx.prisma.notification.create({
      data: {
        organizationId,
        senderId: viewer.id,
        title,
        body,
        type: NotificationType.ANNOUNCEMENT,
        status: NotificationStatus.SENT,
        audience: NotificationAudience.ORGANIZATION,
        actionUrl: "/notification",
        metadata: metadataBase,
        sentAt,
      },
      select: notificationRealtimeSelect,
    });

    void emitNotificationRealtimeEvent(ctx.prisma, notificationRecord);
    return { dispatchId };
  }

  const uniqueRecipientIds = Array.from(new Set(input.recipientIds ?? [])).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (!uniqueRecipientIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Select at least one teammate to notify.",
    });
  }

  const validRecipients = await ctx.prisma.user.findMany({
    where: {
      id: { in: uniqueRecipientIds },
      organizationId,
      status: { not: EmploymentStatus.TERMINATED },
    },
    select: { id: true },
  });

  if (validRecipients.length !== uniqueRecipientIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Some selected teammates are no longer available.",
    });
  }

  const notifications = await ctx.prisma.$transaction((tx) =>
    Promise.all(
      validRecipients.map((recipient) =>
        tx.notification.create({
          data: {
            organizationId,
            senderId: viewer.id,
            title,
            body,
            type: NotificationType.ANNOUNCEMENT,
            status: NotificationStatus.SENT,
            audience: NotificationAudience.INDIVIDUAL,
            targetUserId: recipient.id,
            actionUrl: "/notification",
            metadata: metadataBase,
            sentAt,
          },
          select: notificationRealtimeSelect,
        }),
      ),
    ),
  );

  if (notifications.length > 0) {
    void emitNotificationRealtimeEvent(ctx.prisma, notifications);
  }

  return { dispatchId };
};

export const hrAnnouncementsService = {
  overview,
  send,
};
