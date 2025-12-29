import {
  NotificationAudience,
  NotificationStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import { requireHrAdmin } from "@/server/modules/hr/utils";
import {
  buildPeriodLabel,
  hrInvoiceSummarySelect,
  invoiceDetailInclude,
  mapHrInvoiceSummary,
  mapInvoiceDetail,
} from "@/server/modules/invoice/invoice.mapper";
import {
  emitNotificationRealtimeEvent,
  notificationRealtimeSelect,
} from "@/server/modules/notification/notification.events";
import type {
  HrInvoiceCreateInput,
  HrInvoiceDashboardResponse,
  HrInvoiceUpdateInput,
  InvoiceDetailResponse,
} from "@/types/invoice";
import { getInvoiceStatusLabel } from "@/types/invoice";

const decimalToNumber = (value?: Prisma.Decimal | null) =>
  value ? Number(value) : 0;

const sanitizeItems = (items: HrInvoiceCreateInput["items"]) =>
  items
    .map((item) => ({
      description: item.description.trim(),
      quantity: Math.max(1, Math.floor(item.quantity)),
      unitPrice: Number(item.unitPrice),
    }))
    .filter((item) => item.description.length > 1 && item.unitPrice !== 0);

const parseDueDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid due date." });
  }
  return parsed;
};

const toCurrencyValue = (value: number) => value.toFixed(2);

const getProfileName = (
  profile?: { firstName: string | null; lastName: string | null; preferredName: string | null } | null,
) => {
  if (!profile) return "Team member";
  if (profile.preferredName && profile.preferredName.trim().length > 0) {
    return profile.preferredName;
  }
  const parts = [profile.firstName, profile.lastName].filter((part) => part && part.trim().length) as string[];
  return parts.length ? parts.join(" ") : "Team member";
};

export const hrInvoiceService = {
  async dashboard({ ctx }: { ctx: TRPCContext }): Promise<HrInvoiceDashboardResponse> {
    const user = requireHrAdmin(ctx);
    const orgId = user.organizationId;

    const [invoiceRecords, employeeRecords] = await Promise.all([
      ctx.prisma.invoice.findMany({
        where: { organizationId: orgId },
        select: hrInvoiceSummarySelect,
        orderBy: { updatedAt: "desc" },
      }),
      ctx.prisma.user.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          employment: {
            select: {
              employeeCode: true,
              designation: true,
              grossSalary: true,
              incomeTax: true,
            },
          },
          profile: {
            select: {
              firstName: true,
              lastName: true,
              preferredName: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const invoices = invoiceRecords.map(mapHrInvoiceSummary);
    const pendingReview = invoices.filter((invoice) => invoice.status === "PENDING_REVIEW").length;

    const employeeOptions = employeeRecords.map((employee) => ({
      id: employee.id,
      name: getProfileName(employee.profile),
      employeeCode: employee.employment?.employeeCode ?? null,
      designation: employee.employment?.designation ?? null,
      grossSalary: decimalToNumber(employee.employment?.grossSalary),
      incomeTax: decimalToNumber(employee.employment?.incomeTax),
    }));

    return {
      invoices,
      employeeOptions,
      pendingReview,
    };
  },

  async create({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: HrInvoiceCreateInput;
  }) {
    const user = requireHrAdmin(ctx);
    const orgId = user.organizationId;

    const employee = await ctx.prisma.user.findFirst({
      where: { id: input.employeeId, organizationId: orgId },
      select: { id: true },
    });

    if (!employee) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });
    }

    const items = sanitizeItems(input.items);
    if (!items.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Add at least one line item." });
    }

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxRate = Math.max(0, Number(input.taxRate ?? 0));
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    const dueDate = parseDueDate(input.dueDate);

    const created = await ctx.prisma.invoice.create({
      data: {
        organizationId: orgId,
        employeeId: employee.id,
        createdById: user.id,
        title: input.title.trim(),
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        dueDate,
        currency: input.currency,
        subtotal: toCurrencyValue(subtotal),
        tax: toCurrencyValue(tax),
        total: toCurrencyValue(total),
        notes: input.notes?.trim() || null,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: toCurrencyValue(item.unitPrice),
            amount: toCurrencyValue(item.unitPrice * item.quantity),
          })),
        },
      },
      select: hrInvoiceSummarySelect,
    });

    return mapHrInvoiceSummary(created);
  },

  async send({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { invoiceId: string };
  }) {
    const user = requireHrAdmin(ctx);
    const organizationId = user.organizationId;
    const invoice = await ctx.prisma.invoice.findFirst({
      where: { id: input.invoiceId, organizationId },
      select: { id: true, status: true },
    });

    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
    }

    if (!["DRAFT", "CHANGES_REQUESTED"].includes(invoice.status)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only draft or change-requested invoices can be sent.",
      });
    }

    const sentAt = new Date();

    const { updatedRecord, notificationRecord } = await ctx.prisma.$transaction(async (tx) => {
      const updatedRecord = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "PENDING_REVIEW",
          sentAt,
          reviewComment: null,
          reviewedAt: null,
          reviewedById: null,
        },
        select: hrInvoiceSummarySelect,
      });

      const periodLabel = buildPeriodLabel(updatedRecord.periodMonth, updatedRecord.periodYear);
      const totalNumber = Number(updatedRecord.total ?? 0);

      const notificationRecord = await tx.notification.create({
        data: {
          organizationId,
          senderId: user.id,
          audience: NotificationAudience.INDIVIDUAL,
          targetUserId: updatedRecord.employeeId,
          title: `${updatedRecord.title} ready for review`,
          body: `Please review your ${periodLabel} invoice.`,
          type: NotificationType.INVOICE,
          status: NotificationStatus.SENT,
          actionUrl: `/invoice/${updatedRecord.id}`,
          metadata: {
            invoiceId: updatedRecord.id,
            periodLabel,
            currency: updatedRecord.currency,
            total: totalNumber,
            status: updatedRecord.status,
            statusLabel: getInvoiceStatusLabel(updatedRecord.status),
          },
          sentAt,
        },
        select: notificationRealtimeSelect,
      });

      return { updatedRecord, notificationRecord };
    });

    if (notificationRecord) {
      void emitNotificationRealtimeEvent(ctx.prisma, notificationRecord);
    }

    return mapHrInvoiceSummary(updatedRecord);
  },

  async update({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: HrInvoiceUpdateInput;
  }) {
    const user = requireHrAdmin(ctx);
    const orgId = user.organizationId;

    const existing = await ctx.prisma.invoice.findFirst({
      where: { id: input.invoiceId, organizationId: orgId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
    }

    if (!["DRAFT", "CHANGES_REQUESTED"].includes(existing.status)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only draft or change-requested invoices can be edited.",
      });
    }

    const items = sanitizeItems(input.items);
    if (!items.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Add at least one line item." });
    }

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxRate = Math.max(0, Number(input.taxRate ?? 0));
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    const dueDate = parseDueDate(input.dueDate);

    const updated = await ctx.prisma.invoice.update({
      where: { id: existing.id },
      data: {
        employeeId: input.employeeId,
        title: input.title.trim(),
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        dueDate,
        currency: input.currency,
        subtotal: toCurrencyValue(subtotal),
        tax: toCurrencyValue(tax),
        total: toCurrencyValue(total),
        notes: input.notes?.trim() || null,
        items: {
          deleteMany: { invoiceId: existing.id },
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: toCurrencyValue(item.unitPrice),
            amount: toCurrencyValue(item.unitPrice * item.quantity),
          })),
        },
      },
      select: hrInvoiceSummarySelect,
    });

    return mapHrInvoiceSummary(updated);
  },

  async detail({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { invoiceId: string };
  }): Promise<InvoiceDetailResponse> {
    const user = requireHrAdmin(ctx);

    const invoice = await ctx.prisma.invoice.findFirst({
      where: { id: input.invoiceId, organizationId: user.organizationId },
      include: invoiceDetailInclude,
    });

    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
    }

    return { invoice: mapInvoiceDetail(invoice) };
  },
};
