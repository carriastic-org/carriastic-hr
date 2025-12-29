import type { Prisma } from "@prisma/client";

import {
  getInvoiceStatusLabel,
  type EmployeeInvoiceListItem,
  type HrInvoiceListItem,
  type InvoiceDetail,
} from "@/types/invoice";

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });

const getDisplayName = (
  profile?: {
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
  } | null,
) => {
  if (!profile) {
    return "Team member";
  }
  if (profile.preferredName && profile.preferredName.trim().length > 0) {
    return profile.preferredName;
  }
  const parts = [profile.firstName, profile.lastName].filter((part) => part && part.trim().length > 0) as string[];
  if (parts.length) {
    return parts.join(" ");
  }
  return "Team member";
};

const safeNumber = (value: Prisma.Decimal | number) => Number(value);

export const buildPeriodLabel = (month: number, year: number) => {
  const normalizedMonth = Math.min(12, Math.max(1, month));
  const previewDate = new Date(year, normalizedMonth - 1, 1);
  return `${monthFormatter.format(previewDate)} ${year}`;
};

export const formatInvoiceCurrency = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    void error;
    return `${currency} ${value.toFixed(2)}`;
  }
};

const profileSummarySelect = {
  firstName: true,
  lastName: true,
  preferredName: true,
} as const;

const detailedProfileSelect = {
  firstName: true,
  lastName: true,
  preferredName: true,
  currentAddress: true,
  workPhone: true,
} as const;

export const hrInvoiceSummarySelect = {
  id: true,
  title: true,
  employeeId: true,
  periodMonth: true,
  periodYear: true,
  dueDate: true,
  currency: true,
  status: true,
  subtotal: true,
  tax: true,
  total: true,
  reviewComment: true,
  reviewedAt: true,
  updatedAt: true,
  employee: {
    select: {
      profile: {
        select: profileSummarySelect,
      },
    },
  },
} satisfies Prisma.InvoiceSelect;

export type HrInvoiceSummaryRecord = Prisma.InvoiceGetPayload<{
  select: typeof hrInvoiceSummarySelect;
}>;

export const mapHrInvoiceSummary = (invoice: HrInvoiceSummaryRecord): HrInvoiceListItem => {
  const subtotal = safeNumber(invoice.subtotal);
  const tax = safeNumber(invoice.tax);
  const total = safeNumber(invoice.total);
  return {
    id: invoice.id,
    title: invoice.title,
    employeeId: invoice.employeeId,
    employeeName: getDisplayName(invoice.employee?.profile ?? null),
    periodMonth: invoice.periodMonth,
    periodYear: invoice.periodYear,
    periodLabel: buildPeriodLabel(invoice.periodMonth, invoice.periodYear),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    status: invoice.status,
    statusLabel: getInvoiceStatusLabel(invoice.status),
    subtotal,
    tax,
    total,
    currency: invoice.currency,
    totalFormatted: formatInvoiceCurrency(total, invoice.currency),
    updatedAt: invoice.updatedAt.toISOString(),
    canSend: invoice.status === "DRAFT" || invoice.status === "CHANGES_REQUESTED",
    reviewComment: invoice.reviewComment ?? null,
    reviewRequestedAt: invoice.reviewedAt ? invoice.reviewedAt.toISOString() : null,
  };
};

export const employeeInvoiceSummarySelect = {
  id: true,
  title: true,
  periodMonth: true,
  periodYear: true,
  dueDate: true,
  currency: true,
  status: true,
  total: true,
  updatedAt: true,
} satisfies Prisma.InvoiceSelect;

export type EmployeeInvoiceSummaryRecord = Prisma.InvoiceGetPayload<{
  select: typeof employeeInvoiceSummarySelect;
}>;

export const mapEmployeeInvoiceSummary = (
  invoice: EmployeeInvoiceSummaryRecord,
): EmployeeInvoiceListItem => {
  const total = safeNumber(invoice.total);
  return {
    id: invoice.id,
    title: invoice.title,
    periodLabel: buildPeriodLabel(invoice.periodMonth, invoice.periodYear),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    status: invoice.status,
    statusLabel: getInvoiceStatusLabel(invoice.status),
    currency: invoice.currency,
    total,
    totalFormatted: formatInvoiceCurrency(total, invoice.currency),
    updatedAt: invoice.updatedAt.toISOString(),
    isActionable: invoice.status === "PENDING_REVIEW",
  };
};

export const invoiceDetailInclude = {
  items: {
    select: {
      id: true,
      description: true,
      quantity: true,
      unitPrice: true,
      amount: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
  employee: {
    select: {
      id: true,
      email: true,
      phone: true,
      profile: {
        select: detailedProfileSelect,
      },
      employment: {
        select: {
          employeeCode: true,
        },
      },
      bankAccounts: {
        select: {
          id: true,
          accountHolder: true,
          bankName: true,
          accountNumber: true,
          branch: true,
          swiftCode: true,
        },
        where: { isPrimary: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  },
  creator: {
    select: {
      id: true,
      email: true,
      profile: {
        select: profileSummarySelect,
      },
    },
  },
  reviewedBy: {
    select: {
      id: true,
      email: true,
      profile: {
        select: profileSummarySelect,
      },
    },
  },
} satisfies Prisma.InvoiceInclude;

export type InvoiceDetailRecord = Prisma.InvoiceGetPayload<{
  include: typeof invoiceDetailInclude;
}>;

export const mapInvoiceDetail = (invoice: InvoiceDetailRecord): InvoiceDetail => {
  const subtotal = safeNumber(invoice.subtotal);
  const tax = safeNumber(invoice.tax);
  const total = safeNumber(invoice.total);
  const employeeProfile = invoice.employee.profile;
  const creatorProfile = invoice.creator.profile;
  const bankAccount = invoice.employee.bankAccounts[0] ?? null;
  const reviewerProfile = invoice.reviewedBy?.profile;

  return {
    id: invoice.id,
    title: invoice.title,
    periodMonth: invoice.periodMonth,
    periodYear: invoice.periodYear,
    periodLabel: buildPeriodLabel(invoice.periodMonth, invoice.periodYear),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    currency: invoice.currency,
    status: invoice.status,
    statusLabel: getInvoiceStatusLabel(invoice.status),
    subtotal,
    tax,
    total,
    subtotalFormatted: formatInvoiceCurrency(subtotal, invoice.currency),
    taxFormatted: formatInvoiceCurrency(tax, invoice.currency),
    totalFormatted: formatInvoiceCurrency(total, invoice.currency),
    notes: invoice.notes ?? null,
    employee: {
      id: invoice.employee.id,
      name: getDisplayName(employeeProfile ?? null),
      email: invoice.employee.email,
      phone: employeeProfile?.workPhone ?? invoice.employee.phone ?? null,
      address: employeeProfile?.currentAddress ?? null,
      employeeCode: invoice.employee.employment?.employeeCode ?? null,
    },
    createdBy: {
      id: invoice.creator.id,
      name: getDisplayName(creatorProfile ?? null),
      email: invoice.creator.email,
    },
    timestamps: {
      createdAt: invoice.createdAt.toISOString(),
      sentAt: invoice.sentAt ? invoice.sentAt.toISOString() : null,
      confirmedAt: invoice.confirmedAt ? invoice.confirmedAt.toISOString() : null,
      readyAt: invoice.readyAt ? invoice.readyAt.toISOString() : null,
    },
    reviewRequest: {
      comment: invoice.reviewComment ?? null,
      requestedAt: invoice.reviewedAt ? invoice.reviewedAt.toISOString() : null,
      requestedBy: invoice.reviewedBy
        ? {
            id: invoice.reviewedBy.id,
            name: getDisplayName(reviewerProfile ?? null),
            email: invoice.reviewedBy.email,
          }
        : null,
    },
    bankAccount: bankAccount
      ? {
          accountHolder: bankAccount.accountHolder,
          bankName: bankAccount.bankName,
          accountNumber: bankAccount.accountNumber,
          branch: bankAccount.branch ?? null,
          swiftCode: bankAccount.swiftCode ?? null,
        }
      : null,
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: safeNumber(item.unitPrice),
      amount: safeNumber(item.amount),
    })),
    canConfirm: invoice.status === "PENDING_REVIEW",
    canRequestChanges: invoice.status === "PENDING_REVIEW",
  };
};
