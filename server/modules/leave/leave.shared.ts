import { LeaveType, Prisma } from "@prisma/client";

import { leaveTypeLabelMap, type LeaveTypeValue } from "@/lib/leave-types";
import {
  buildAttachmentDownloadUrl,
  createAttachmentDownloadToken,
} from "./attachment-token";

export type EmploymentLeaveBalances = {
  id: string;
  casualLeaveBalance: Prisma.Decimal;
  sickLeaveBalance: Prisma.Decimal;
  annualLeaveBalance: Prisma.Decimal;
  parentalLeaveBalance: Prisma.Decimal;
};

export type StoredAttachment = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  dataUrl?: string | null;
  uploadedAt: string | null;
};

export type LeaveAttachmentResponse = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  dataUrl: string | null;
  downloadUrl: string | null;
  uploadedAt: string | null;
};

export type LeaveBalanceResponse = {
  type: LeaveType;
  label: string;
  remaining: number;
};

export const employmentBalanceSelect = {
  id: true,
  casualLeaveBalance: true,
  sickLeaveBalance: true,
  annualLeaveBalance: true,
  parentalLeaveBalance: true,
} as const;

export const leaveBalanceFieldByType: Record<
  LeaveType,
  keyof Omit<EmploymentLeaveBalances, "id">
> = {
  [LeaveType.CASUAL]: "casualLeaveBalance",
  [LeaveType.SICK]: "sickLeaveBalance",
  [LeaveType.ANNUAL]: "annualLeaveBalance",
  [LeaveType.PATERNITY_MATERNITY]: "parentalLeaveBalance",
};

export const decimalToNumber = (value?: Prisma.Decimal | null) =>
  value ? Number(value.toString()) : 0;

export const toLeaveTypeValue = (value: LeaveType): LeaveTypeValue =>
  value as LeaveTypeValue;

const buildDownloadUrl = (attachment: StoredAttachment) => {
  if (attachment.storageKey) {
    try {
      const token = createAttachmentDownloadToken({
        key: attachment.storageKey,
        name: attachment.name,
        mimeType: attachment.mimeType ?? undefined,
      });
      return buildAttachmentDownloadUrl(token);
    } catch (error) {
      console.error("Failed to generate attachment download link:", error);
    }
  }
  return attachment.dataUrl ?? null;
};

export const serializeAttachment = (
  attachment: StoredAttachment,
): LeaveAttachmentResponse => ({
  id: attachment.id,
  name: attachment.name,
  mimeType: attachment.mimeType,
  sizeBytes: attachment.sizeBytes,
  dataUrl: attachment.dataUrl ?? null,
  downloadUrl: buildDownloadUrl(attachment),
  uploadedAt: attachment.uploadedAt,
});

export const parseAttachments = (
  value: Prisma.JsonValue | null,
): LeaveAttachmentResponse[] => {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (
        item &&
        typeof item === "object" &&
        "id" in item &&
        "name" in item &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).name === "string"
      ) {
        const raw = item as Record<string, unknown>;
        const stored: StoredAttachment = {
          id: raw.id as string,
          name: raw.name as string,
          mimeType: typeof raw.mimeType === "string" ? raw.mimeType : null,
          sizeBytes: typeof raw.sizeBytes === "number" ? raw.sizeBytes : null,
          storageKey: typeof raw.storageKey === "string" ? raw.storageKey : null,
          dataUrl: typeof raw.dataUrl === "string" ? raw.dataUrl : null,
          uploadedAt: typeof raw.uploadedAt === "string" ? raw.uploadedAt : null,
        };
        return serializeAttachment(stored);
      }
      return null;
    })
    .filter((attachment): attachment is LeaveAttachmentResponse => Boolean(attachment));
};

export const buildBalanceResponse = (
  employment: EmploymentLeaveBalances,
): LeaveBalanceResponse[] => [
  {
    type: LeaveType.CASUAL,
    label: leaveTypeLabelMap.CASUAL,
    remaining: decimalToNumber(employment.casualLeaveBalance),
  },
  {
    type: LeaveType.SICK,
    label: leaveTypeLabelMap.SICK,
    remaining: decimalToNumber(employment.sickLeaveBalance),
  },
  {
    type: LeaveType.ANNUAL,
    label: leaveTypeLabelMap.ANNUAL,
    remaining: decimalToNumber(employment.annualLeaveBalance),
  },
  {
    type: LeaveType.PATERNITY_MATERNITY,
    label: leaveTypeLabelMap.PATERNITY_MATERNITY,
    remaining: decimalToNumber(employment.parentalLeaveBalance),
  },
];
