import {
  EmploymentStatus,
  NotificationAudience,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

import { userRoom } from "@/server/modules/messages/socket-rooms";
import { getSocketServer } from "@/server/socket";
import type { DeviceNotificationPayload } from "@/types/realtime";

export const notificationRealtimeSelect = {
  id: true,
  organizationId: true,
  audience: true,
  targetRoles: true,
  targetUserId: true,
  title: true,
  body: true,
  type: true,
  status: true,
  actionUrl: true,
  sentAt: true,
  scheduledAt: true,
  createdAt: true,
} as const satisfies Prisma.NotificationSelect;

export type NotificationRealtimeRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationRealtimeSelect;
}>;

const resolveRecipientIds = async (
  prisma: PrismaClient,
  record: NotificationRealtimeRecord,
): Promise<string[]> => {
  switch (record.audience) {
    case NotificationAudience.ORGANIZATION: {
      const members = await prisma.user.findMany({
        where: {
          organizationId: record.organizationId,
          status: { not: EmploymentStatus.TERMINATED },
        },
        select: { id: true },
      });
      return members.map((member) => member.id);
    }
    case NotificationAudience.ROLE: {
      if (!record.targetRoles?.length) {
        return [];
      }
      const members = await prisma.user.findMany({
        where: {
          organizationId: record.organizationId,
          role: { in: record.targetRoles },
          status: { not: EmploymentStatus.TERMINATED },
        },
        select: { id: true },
      });
      return members.map((member) => member.id);
    }
    case NotificationAudience.INDIVIDUAL:
      return record.targetUserId ? [record.targetUserId] : [];
    default:
      return [];
  }
};

const toDevicePayload = (record: NotificationRealtimeRecord): DeviceNotificationPayload => ({
  id: record.id,
  title: record.title,
  body: record.body,
  actionUrl: record.actionUrl ?? null,
  timestamp: (record.sentAt ?? record.scheduledAt ?? record.createdAt).toISOString(),
  type: record.type,
  status: record.status,
});

export const emitNotificationRealtimeEvent = async (
  prisma: PrismaClient,
  notifications: NotificationRealtimeRecord | NotificationRealtimeRecord[],
) => {
  try {
    const io = getSocketServer();
    if (!io || io.sockets.sockets.size === 0) {
      return;
    }

    const entries = Array.isArray(notifications) ? notifications : [notifications];
    await Promise.all(
      entries.map(async (record) => {
        const recipientIds = await resolveRecipientIds(prisma, record);
        if (!recipientIds.length) {
          return;
        }
        const payload = toDevicePayload(record);
        recipientIds.forEach((userId) => {
          io.to(userRoom(userId)).emit("notification:new", payload);
        });
      }),
    );
  } catch (error) {
    console.error("Failed to broadcast notification", error);
  }
};
