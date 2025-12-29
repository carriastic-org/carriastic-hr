import { randomUUID } from "crypto";

import {
  LeaveStatus,
  LeaveType,
  NotificationAudience,
  NotificationStatus,
  NotificationType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import {
  emitNotificationRealtimeEvent,
  notificationRealtimeSelect,
  type NotificationRealtimeRecord,
} from "@/server/modules/notification/notification.events";
import { leaveTypeLabelMap } from "@/lib/leave-types";
import {
  buildBalanceResponse,
  decimalToNumber,
  employmentBalanceSelect,
  leaveBalanceFieldByType,
  parseAttachments,
  toLeaveTypeValue,
  type EmploymentLeaveBalances,
  type LeaveAttachmentResponse,
  type StoredAttachment,
} from "./leave.shared";
import type {
  CreateLeaveApplicationInput,
  LeaveAttachmentInput,
  LeaveSummaryInput,
} from "./leave.validation";

export type { LeaveAttachmentResponse, LeaveBalanceResponse } from "./leave.shared";

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const formatDateRangeLabel = (start: Date, end: Date) => {
  const startLabel = shortDateFormatter.format(start);
  const endLabel = shortDateFormatter.format(end);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
};

const formatDisplayName = (input: {
  preferredName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fallback: string;
}) => {
  if (input.preferredName && input.preferredName.trim().length > 0) {
    return input.preferredName.trim();
  }
  const parts = [input.firstName, input.lastName].filter(
    (value): value is string => Boolean(value && value.trim().length > 0),
  );
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return input.fallback;
};

export type LeaveRequestResponse = {
  id: string;
  leaveType: LeaveType;
  leaveTypeLabel: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: LeaveStatus;
  reason: string | null;
  note: string | null;
  attachments: LeaveAttachmentResponse[];
  createdAt: string;
  updatedAt: string;
};

const normalizeDate = (input: Date) => {
  const result = new Date(input);
  result.setHours(0, 0, 0, 0);
  return result;
};

const calculateInclusiveDays = (start: Date, end: Date) => {
  const startDay = normalizeDate(start);
  const endDay = normalizeDate(end);
  const diffMs = endDay.getTime() - startDay.getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.floor(diffMs / dayMs) + 1;
};

const serializeLeaveRequest = (record: {
  id: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  totalDays: Prisma.Decimal;
  status: LeaveStatus;
  reason: string | null;
  note: string | null;
  attachments: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): LeaveRequestResponse => ({
  id: record.id,
  leaveType: record.leaveType,
  leaveTypeLabel: leaveTypeLabelMap[toLeaveTypeValue(record.leaveType)],
  startDate: record.startDate.toISOString(),
  endDate: record.endDate.toISOString(),
  totalDays: decimalToNumber(record.totalDays),
  status: record.status,
  reason: record.reason ?? null,
  note: record.note ?? null,
  attachments: parseAttachments(record.attachments),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

const toStoredAttachments = (attachments?: LeaveAttachmentInput[]) =>
  attachments?.map<StoredAttachment>((attachment) => {
    if (!attachment.storageKey) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Attachment reference missing.",
      });
    }
    return {
      id: attachment.id ?? randomUUID(),
      name: attachment.name,
      mimeType: attachment.type ?? null,
      sizeBytes: attachment.size ?? null,
      storageKey: attachment.storageKey,
      dataUrl: null,
      uploadedAt: new Date().toISOString(),
    };
  });

export const leaveService = {
  async summary(ctx: TRPCContext, input?: LeaveSummaryInput) {
    const session = ctx.session;
    if (!session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const limit = input?.limit ?? 25;

    const [employment, requests] = await ctx.prisma.$transaction([
      ctx.prisma.employmentDetail.findUnique({
        where: { userId: session.user.id },
        select: employmentBalanceSelect,
      }),
      ctx.prisma.leaveRequest.findMany({
        where: { employeeId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    if (!employment) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employment record not found for this user.",
      });
    }

    return {
      balances: buildBalanceResponse(employment as EmploymentLeaveBalances),
      requests: requests.map(serializeLeaveRequest),
    };
  },

  async submitApplication(ctx: TRPCContext, input: CreateLeaveApplicationInput) {
    const session = ctx.session;
    if (!session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const organizationId = session.user.organizationId ?? session.user.organization?.id ?? null;
    if (!organizationId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Missing organization context for leave submission.",
      });
    }

    const employeeName = formatDisplayName({
      preferredName: session.user.profile?.preferredName ?? null,
      firstName: session.user.profile?.firstName ?? null,
      lastName: session.user.profile?.lastName ?? null,
      fallback: session.user.email,
    });

    const leaveType = input.leaveType as LeaveType;
    const startDate = input.startDate;
    const endDate = input.endDate;
    const totalDays = calculateInclusiveDays(startDate, endDate);
    if (totalDays <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid leave duration.",
      });
    }

    const totalDaysDecimal = new Prisma.Decimal(totalDays);
    const storedAttachments = toStoredAttachments(input.attachments);

    const leaveTypeLabel = leaveTypeLabelMap[toLeaveTypeValue(leaveType)];
    const dateRangeLabel = formatDateRangeLabel(startDate, endDate);
    const dayLabel = totalDays === 1 ? "day" : "days";

    const result = await ctx.prisma.$transaction(async (tx) => {
      const notifications: NotificationRealtimeRecord[] = [];
      const employment = await tx.employmentDetail.findUnique({
        where: { userId: session.user.id },
        select: employmentBalanceSelect,
      });

      if (!employment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Employment record not found for this user.",
        });
      }

      const employmentRecord = employment as EmploymentLeaveBalances;
      const balanceField = leaveBalanceFieldByType[leaveType];
      const currentBalance = employmentRecord[balanceField] ?? new Prisma.Decimal(0);

      if (currentBalance.lt(totalDaysDecimal)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `You do not have enough ${
            leaveTypeLabelMap[toLeaveTypeValue(leaveType)]
          } remaining for this request.`,
        });
      }

      const balanceUpdateData = {
        [balanceField]: currentBalance.minus(totalDaysDecimal),
      } as Prisma.EmploymentDetailUpdateInput;

      const updatedEmployment = await tx.employmentDetail.update({
        where: { id: employment.id },
        data: balanceUpdateData,
        select: employmentBalanceSelect,
      });

      const createdRequest = await tx.leaveRequest.create({
        data: {
          employeeId: session.user.id,
          leaveType,
          startDate,
          endDate,
          totalDays: totalDaysDecimal,
          reason: input.reason,
          note: input.note,
          attachments: storedAttachments ?? undefined,
        },
      });

      const notificationRecord = await tx.notification.create({
        data: {
          organizationId,
          senderId: session.user.id,
          title: `${employeeName} requested ${leaveTypeLabel}`,
          body: `${leaveTypeLabel} • ${dateRangeLabel} (${totalDays} ${dayLabel})`,
          type: NotificationType.LEAVE,
          status: NotificationStatus.SENT,
          actionUrl: "/hr-admin/leave-approvals",
          audience: NotificationAudience.ROLE,
          targetRoles: [
            UserRole.HR_ADMIN,
            UserRole.MANAGER,
            UserRole.ORG_OWNER,
            UserRole.ORG_ADMIN,
            UserRole.SUPER_ADMIN,
          ],
          metadata: {
            leaveRequestId: createdRequest.id,
            employeeId: session.user.id,
            leaveType,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            totalDays,
            status: createdRequest.status,
          },
          sentAt: new Date(),
        },
        select: notificationRealtimeSelect,
      });
      notifications.push(notificationRecord);

      return {
        updatedEmployment: updatedEmployment as EmploymentLeaveBalances,
        request: createdRequest,
        notifications,
      };
    });

    if (result.notifications.length > 0) {
      void emitNotificationRealtimeEvent(ctx.prisma, result.notifications);
    }

    return {
      request: serializeLeaveRequest(result.request),
      balances: buildBalanceResponse(result.updatedEmployment),
    };
  },
};
