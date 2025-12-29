import type { InvoiceStatus } from "@prisma/client";

export const invoiceStatusMeta: Record<InvoiceStatus, { label: string; description: string; highlight: string }> = {
  DRAFT: {
    label: "Draft",
    description: "Invoice is editable and not yet shared with the employee.",
    highlight: "text-slate-500",
  },
  PENDING_REVIEW: {
    label: "Pending review",
    description: "Waiting for the employee to review and confirm.",
    highlight: "text-amber-600",
  },
  CHANGES_REQUESTED: {
    label: "Changes requested",
    description: "Employee asked for updates before confirming.",
    highlight: "text-rose-600",
  },
  READY_TO_DELIVER: {
    label: "Ready to deliver",
    description: "Employee has confirmed. You can now deliver the invoice.",
    highlight: "text-emerald-600",
  },
};

export const getInvoiceStatusLabel = (status: InvoiceStatus) =>
  invoiceStatusMeta[status]?.label ?? status;

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type HrInvoiceListItem = {
  id: string;
  title: string;
  employeeId: string;
  employeeName: string;
  periodMonth: number;
  periodYear: number;
  periodLabel: string;
  dueDate: string | null;
  status: InvoiceStatus;
  statusLabel: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  totalFormatted: string;
  updatedAt: string;
  canSend: boolean;
  reviewComment: string | null;
  reviewRequestedAt: string | null;
};

export type HrInvoiceEmployeeOption = {
  id: string;
  name: string;
  employeeCode: string | null;
  designation: string | null;
  grossSalary: number;
  incomeTax: number;
};

export type HrInvoiceDashboardResponse = {
  invoices: HrInvoiceListItem[];
  employeeOptions: HrInvoiceEmployeeOption[];
  pendingReview: number;
};

export type HrInvoiceCreateItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type HrInvoiceCreateInput = {
  employeeId: string;
  title: string;
  periodMonth: number;
  periodYear: number;
  dueDate?: string | null;
  currency: string;
  taxRate?: number | null;
  notes?: string | null;
  items: HrInvoiceCreateItemInput[];
};

export type HrInvoiceUpdateInput = HrInvoiceCreateInput & {
  invoiceId: string;
};

export type InvoiceDetail = {
  id: string;
  title: string;
  periodMonth: number;
  periodYear: number;
  periodLabel: string;
  dueDate: string | null;
  currency: string;
  status: InvoiceStatus;
  statusLabel: string;
  subtotal: number;
  tax: number;
  total: number;
  subtotalFormatted: string;
  taxFormatted: string;
  totalFormatted: string;
  notes: string | null;
  employee: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    employeeCode: string | null;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  timestamps: {
    createdAt: string;
    sentAt: string | null;
    confirmedAt: string | null;
    readyAt: string | null;
  };
  reviewRequest: {
    comment: string | null;
    requestedAt: string | null;
    requestedBy: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
  bankAccount: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    branch: string | null;
    swiftCode: string | null;
  } | null;
  items: InvoiceLineItem[];
  canConfirm: boolean;
  canRequestChanges: boolean;
};

export type InvoiceDetailResponse = {
  invoice: InvoiceDetail;
};

export type EmployeeInvoiceListItem = {
  id: string;
  title: string;
  periodLabel: string;
  dueDate: string | null;
  status: InvoiceStatus;
  statusLabel: string;
  currency: string;
  total: number;
  totalFormatted: string;
  updatedAt: string;
  isActionable: boolean;
};

export type EmployeeInvoiceListResponse = {
  invoices: EmployeeInvoiceListItem[];
};

export type InvoiceUnlockResponse = {
  token: string;
};
