import type { LeaveStatus, LeaveType } from "@prisma/client";

import type {
  LeaveAttachmentResponse,
  LeaveBalanceResponse,
} from "@/server/modules/leave/leave.shared";

export type HrLeaveEmployeeSummary = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employeeCode: string | null;
  designation: string | null;
  department: string | null;
  team: string | null;
  organization: string | null;
};

export type HrLeaveRequest = {
  id: string;
  leaveType: LeaveType;
  leaveTypeLabel: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: LeaveStatus;
  reason: string | null;
  note: string | null;
  submittedAt: string;
  attachments: LeaveAttachmentResponse[];
  employee: HrLeaveEmployeeSummary;
  balances: LeaveBalanceResponse[];
  remainingBalance: LeaveBalanceResponse;
};

export type HrLeaveRequestListResponse = {
  requests: HrLeaveRequest[];
};
