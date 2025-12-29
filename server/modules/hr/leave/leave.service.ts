import {
  LeaveStatus,
  NotificationAudience,
  NotificationStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import { leaveTypeLabelMap } from "@/lib/leave-types";
import { requireHrAdmin } from "@/server/modules/hr/utils";
import {
  buildBalanceResponse,
  decimalToNumber,
  employmentBalanceSelect,
  leaveBalanceFieldByType,
  parseAttachments,
  toLeaveTypeValue,
  type EmploymentLeaveBalances,
} from "@/server/modules/leave/leave.shared";
import type { HrLeaveRequest, HrLeaveRequestListResponse } from "@/types/hr-leave";
import type {
  HrLeaveListInput,
  HrLeaveUpdateStatusInput,
} from "./leave.validation";
import {
  emitNotificationRealtimeEvent,
  notificationRealtimeSelect,
} from "@/server/modules/notification/notification.events";

const employmentSummarySelect = {
  employeeCode: true,
  designation: true,
  department: {
    select: {
      name: true,
      headId: true,
    },
  },
  team: {
    select: {
      name: true,
      leads: {
        select: {
          leadId: true,
        },
      },
    },
  },
  ...employmentBalanceSelect,
} as const;

const leaveRequestSelect = {
  id: true,
  leaveType: true,
  startDate: true,
  endDate: true,
  totalDays: true,
  status: true,
  reason: true,
  note: true,
  attachments: true,
  createdAt: true,
  employee: {
    select: {
      id: true,
      email: true,
      phone: true,
      organizationId: true,
      organization: {
        select: {
          name: true,
        },
      },
      profile: {
        select: {
          firstName: true,
          lastName: true,
          preferredName: true,
        },
      },
      employment: {
        select: employmentSummarySelect,
      },
    },
  },
} as const;

const leaveRequestUpdateSelect = {
  id: true,
  leaveType: true,
  totalDays: true,
  status: true,
  employee: {
    select: {
      id: true,
      organizationId: true,
      employment: {
        select: employmentBalanceSelect,
      },
    },
  },
} as const;

type LeaveRequestWithEmployee = Prisma.LeaveRequestGetPayload<{
  select: typeof leaveRequestSelect;
}>;

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const formatDateRangeLabel = (start: Date, end: Date) => {
  const startLabel = shortDateFormatter.format(start);
  const endLabel = shortDateFormatter.format(end);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
};

const EMPLOYEE_NOTIFICATION_STATUSES: LeaveStatus[] = [
  LeaveStatus.APPROVED,
  LeaveStatus.DENIED,
  LeaveStatus.CANCELLED,
];

const formatEmployeeName = (record: {
  preferredName: string | null | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  fallback: string;
}) => {
  if (record.preferredName) return record.preferredName;
  const parts = [record.firstName, record.lastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return record.fallback;
};

const restoresBalanceOnStatus = (status: LeaveStatus) => status === LeaveStatus.DENIED;

const mapLeaveRequest = (record: LeaveRequestWithEmployee): HrLeaveRequest => {
  const employment = record.employee.employment;

  if (!employment) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Employment details missing for this leave request.",
    });
  }

  const balances = buildBalanceResponse(employment as EmploymentLeaveBalances);
  const remainingBalance =
    balances.find((balance) => balance.type === record.leaveType) ?? {
      type: record.leaveType,
      label: leaveTypeLabelMap[toLeaveTypeValue(record.leaveType)],
      remaining: 0,
    };

  return {
    id: record.id,
    leaveType: record.leaveType,
    leaveTypeLabel: leaveTypeLabelMap[toLeaveTypeValue(record.leaveType)],
    startDate: record.startDate.toISOString(),
    endDate: record.endDate.toISOString(),
    totalDays: decimalToNumber(record.totalDays),
    status: record.status,
    reason: record.reason ?? null,
    note: record.note ?? null,
    submittedAt: record.createdAt.toISOString(),
    attachments: parseAttachments(record.attachments),
    employee: {
      id: record.employee.id,
      name: formatEmployeeName({
        preferredName: record.employee.profile?.preferredName ?? null,
        firstName: record.employee.profile?.firstName ?? null,
        lastName: record.employee.profile?.lastName ?? null,
        fallback: record.employee.email,
      }),
      email: record.employee.email,
      phone: record.employee.phone ?? null,
      employeeCode: record.employee.employment?.employeeCode ?? null,
      designation: record.employee.employment?.designation ?? null,
      department: record.employee.employment?.department?.name ?? null,
      team: record.employee.employment?.team?.name ?? null,
      organization: record.employee.organization?.name ?? null,
    },
    balances,
    remainingBalance,
  };
};

export const hrLeaveService = {
  async listRequests(
    ctx: TRPCContext,
    input?: HrLeaveListInput,
  ): Promise<HrLeaveRequestListResponse> {
    const sessionUser = requireHrAdmin(ctx);
    const limit = input?.limit ?? 100;
    const searchValue = input?.search?.trim();

    const employeeFilter: Prisma.UserWhereInput = {
      organizationId: sessionUser.organizationId,
    };

    if (searchValue) {
      employeeFilter.OR = [
        {
          profile: {
            preferredName: { contains: searchValue, mode: "insensitive" },
          },
        },
        {
          profile: { firstName: { contains: searchValue, mode: "insensitive" } },
        },
        {
          profile: { lastName: { contains: searchValue, mode: "insensitive" } },
        },
        {
          email: { contains: searchValue, mode: "insensitive" },
        },
        {
          employment: {
            employeeCode: { contains: searchValue, mode: "insensitive" },
          },
        },
      ];
    }

    const where: Prisma.LeaveRequestWhereInput = {
      employee: employeeFilter,
    };

    if (input?.status) {
      where.status = input.status;
    }

    if (input?.leaveType) {
      where.leaveType = input.leaveType;
    }

    if (input?.month && input?.year) {
      const monthIndex = input.month - 1;
      const rangeStart = new Date(input.year, monthIndex, 1);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(input.year, monthIndex + 1, 0);
      rangeEnd.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: rangeStart,
        lte: rangeEnd,
      };
    }

    const sortField = input?.sortField ?? "submittedAt";
    const sortOrder = input?.sortOrder ?? "desc";
    const orderBy: Prisma.LeaveRequestOrderByWithRelationInput =
      sortField === "startDate"
        ? { startDate: sortOrder }
        : sortField === "leaveType"
          ? { leaveType: sortOrder }
          : sortField === "status"
            ? { status: sortOrder }
            : { createdAt: sortOrder };

    const requests = await ctx.prisma.leaveRequest.findMany({
      where,
      orderBy,
      take: limit,
      select: leaveRequestSelect,
    });

    return {
      requests: requests.map(mapLeaveRequest),
    };
  },

  async updateStatus(ctx: TRPCContext, input: HrLeaveUpdateStatusInput): Promise<HrLeaveRequest> {
    const sessionUser = requireHrAdmin(ctx);

    const updatedRequestId = await ctx.prisma.$transaction(async (tx) => {
      const existing = await tx.leaveRequest.findUnique({
        where: { id: input.requestId },
        select: leaveRequestUpdateSelect,
      });

      if (!existing || existing.employee.organizationId !== sessionUser.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Leave request not found." });
      }

      const employment = existing.employee.employment;
      if (!employment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Employment record missing for this employee.",
        });
      }

      const balanceField = leaveBalanceFieldByType[existing.leaveType];
      const previousRefunded = restoresBalanceOnStatus(existing.status);
      const nextRefunded = restoresBalanceOnStatus(input.status as LeaveStatus);
      const totalDaysDecimal = existing.totalDays as Prisma.Decimal;

      if (previousRefunded !== nextRefunded) {
        const currentBalance = employment[balanceField] ?? new Prisma.Decimal(0);
        const nextBalance = nextRefunded
          ? currentBalance.plus(totalDaysDecimal)
          : currentBalance.minus(totalDaysDecimal);

        if (!nextRefunded && nextBalance.lt(0)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient balance to approve this request.",
          });
        }

        await tx.employmentDetail.update({
          where: { id: employment.id },
          data: {
            [balanceField]: nextBalance,
          },
        });
      }

      const updateData: Prisma.LeaveRequestUpdateInput = {
        status: input.status as LeaveStatus,
        reviewer: {
          connect: { id: sessionUser.id },
        },
        reviewedAt: new Date(),
      };

      if (typeof input.note !== "undefined") {
        updateData.note = input.note ?? null;
      }

      const updated = await tx.leaveRequest.update({
        where: { id: input.requestId },
        data: updateData,
      });

      return updated.id;
    });

    const refreshed = await ctx.prisma.leaveRequest.findUnique({
      where: { id: updatedRequestId },
      select: leaveRequestSelect,
    });

    if (!refreshed) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Updated leave request could not be loaded.",
      });
    }

    const nextStatus = input.status as LeaveStatus;
    const notifyEmployee = EMPLOYEE_NOTIFICATION_STATUSES.includes(nextStatus);
    const organizationId = refreshed.employee.organizationId ?? sessionUser.organizationId;
    const leaveTypeLabel = leaveTypeLabelMap[toLeaveTypeValue(refreshed.leaveType)];
    const rangeLabel = formatDateRangeLabel(refreshed.startDate, refreshed.endDate);
    const totalLeaveDays = decimalToNumber(refreshed.totalDays as Prisma.Decimal);
    const dayLabel = totalLeaveDays === 1 ? "day" : "days";
    const employeeDisplayName = formatEmployeeName({
      preferredName: refreshed.employee.profile?.preferredName ?? null,
      firstName: refreshed.employee.profile?.firstName ?? null,
      lastName: refreshed.employee.profile?.lastName ?? null,
      fallback: refreshed.employee.email,
    });

    if (organizationId && notifyEmployee) {
      const { title, messageSuffix } = (() => {
        switch (nextStatus) {
          case LeaveStatus.APPROVED:
            return { title: "Leave request approved", messageSuffix: "was approved." };
          case LeaveStatus.CANCELLED:
            return { title: "Leave request cancelled", messageSuffix: "was cancelled by HR." };
          default:
            return { title: "Leave request denied", messageSuffix: "was denied." };
        }
      })();

      const employeeNotification = await ctx.prisma.notification.create({
        data: {
          organizationId,
          senderId: sessionUser.id,
          title,
          body: `Your ${leaveTypeLabel} (${rangeLabel}) ${messageSuffix}`,
          type: NotificationType.LEAVE,
          status: NotificationStatus.SENT,
          audience: NotificationAudience.INDIVIDUAL,
          targetUserId: refreshed.employee.id,
          actionUrl: "/leave",
          metadata: {
            leaveRequestId: refreshed.id,
            status: nextStatus,
            reviewerId: sessionUser.id,
            startDate: refreshed.startDate.toISOString(),
            endDate: refreshed.endDate.toISOString(),
            note: input.note ?? null,
          },
          sentAt: new Date(),
        },
        select: notificationRealtimeSelect,
      });
      void emitNotificationRealtimeEvent(ctx.prisma, employeeNotification);
    }

    if (organizationId && nextStatus === LeaveStatus.APPROVED) {
      const employmentDetails = refreshed.employee.employment;
      const teamLeadIds =
        employmentDetails?.team?.leads?.map((lead) => lead.leadId ?? null) ?? [];
      const potentialRecipients = [
        ...teamLeadIds,
        employmentDetails?.department?.headId ?? null,
      ];
      const managerRecipients = Array.from(
        new Set(
          potentialRecipients.filter(
            (value): value is string =>
              Boolean(value && value !== refreshed.employee.id && value !== sessionUser.id),
          ),
        ),
      );

      if (managerRecipients.length > 0) {
        const sentAt = new Date();
        const managerBody = `${employeeDisplayName}'s ${leaveTypeLabel} (${rangeLabel}) was approved (${totalLeaveDays} ${dayLabel}).`;
        const managerNotifications = await Promise.all(
          managerRecipients.map((targetUserId) =>
            ctx.prisma.notification.create({
              data: {
                organizationId,
                senderId: sessionUser.id,
                title: `${employeeDisplayName}'s leave approved`,
                body: managerBody,
                type: NotificationType.LEAVE,
                status: NotificationStatus.SENT,
                audience: NotificationAudience.INDIVIDUAL,
                targetUserId,
                metadata: {
                  leaveRequestId: refreshed.id,
                  status: nextStatus,
                  reviewerId: sessionUser.id,
                  employeeId: refreshed.employee.id,
                  startDate: refreshed.startDate.toISOString(),
                  endDate: refreshed.endDate.toISOString(),
                  totalDays: totalLeaveDays,
                  note: input.note ?? null,
                },
                sentAt,
              },
              select: notificationRealtimeSelect,
            }),
          ),
        );
        if (managerNotifications.length > 0) {
          void emitNotificationRealtimeEvent(ctx.prisma, managerNotifications);
        }
      }
    }

    return mapLeaveRequest(refreshed);
  },

  async pendingCount(ctx: TRPCContext): Promise<number> {
    const sessionUser = requireHrAdmin(ctx);

    if (!sessionUser.organizationId) {
      return 0;
    }

    return ctx.prisma.leaveRequest.count({
      where: {
        employee: {
          organizationId: sessionUser.organizationId,
        },
        status: {
          in: [LeaveStatus.PENDING, LeaveStatus.PROCESSING],
        },
      },
    });
  },
};
