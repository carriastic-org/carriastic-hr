import type {
  AttendanceStatus,
  LeaveStatus,
  LeaveType,
  NotificationStatus,
  NotificationType,
} from "@prisma/client";

import type { LeaveBalanceResponse } from "@/server/modules/leave/leave.shared";

export type DashboardProfileSummary = {
  fullName: string;
  preferredName: string | null;
  designation: string | null;
  avatarUrl: string | null;
  joiningDate: string | null;
  teamName: string | null;
  departmentName: string | null;
  managerName: string | null;
  employmentType: string | null;
  employmentStatus: string | null;
  workModel: string | null;
  workHours: string | null;
  currentProject: string | null;
  currentProjectNote: string | null;
  primaryLocation: string | null;
  tags: string[];
};

export type DashboardQuickStat = {
  id: string;
  label: string;
  value: string;
  helper: string;
};

export type DashboardListEntry = {
  label: string;
  value: string | null;
};

export type DashboardMonthSnapshot = {
  daysWorked: number;
  hoursLogged: number;
  leavesTaken: number;
};

export type DashboardAttendanceSummary = {
  monthLabel: string;
  totalRecords: number;
  onTimePercentage: number;
  averageCheckIn: string | null;
  averageWorkSeconds: number;
  statusCounts: Record<AttendanceStatus, number>;
};

export type DashboardAttendanceTrendPoint = {
  date: string;
  status: AttendanceStatus;
  workedSeconds: number;
  checkInAt: string | null;
  checkOutAt: string | null;
};

export type DashboardLeaveHighlight = {
  id: string;
  leaveType: LeaveType;
  leaveTypeLabel: string;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  totalDays: number;
};

export type DashboardHolidayHighlight = {
  id: string;
  title: string;
  description: string | null;
  date: string;
};

export type DashboardNotificationItem = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  status: NotificationStatus;
  isSeen: boolean;
  timestamp: string;
  actionUrl: string | null;
};

export type EmployeeDashboardResponse = {
  profile: DashboardProfileSummary;
  monthSnapshot: DashboardMonthSnapshot;
  quickStats: DashboardQuickStat[];
  personalDetails: DashboardListEntry[];
  companyDetails: DashboardListEntry[];
  attendanceSummary: DashboardAttendanceSummary;
  attendanceTrend: DashboardAttendanceTrendPoint[];
  leaveBalances: LeaveBalanceResponse[];
  leaveHighlights: {
    pendingCount: number;
    upcoming: DashboardLeaveHighlight[];
    nextLeaveDate: string | null;
  };
  upcomingHolidays: DashboardHolidayHighlight[];
  notifications: DashboardNotificationItem[];
};

export type DashboardProfileSection = {
  workspaceName: string;
  profile: DashboardProfileSummary;
  personalDetails: DashboardListEntry[];
  companyDetails: DashboardListEntry[];
};

export type DashboardSummarySection = {
  monthSnapshot: DashboardMonthSnapshot;
  quickStats: DashboardQuickStat[];
};

export type DashboardAttendanceSection = {
  attendanceSummary: DashboardAttendanceSummary;
  attendanceTrend: DashboardAttendanceTrendPoint[];
};

export type DashboardTimeOffSection = {
  leaveBalances: LeaveBalanceResponse[];
  leaveHighlights: EmployeeDashboardResponse["leaveHighlights"];
  upcomingHolidays: DashboardHolidayHighlight[];
};

export type DashboardNotificationsSection = {
  notifications: DashboardNotificationItem[];
};

export type DashboardHolidaysSection = {
  workspaceName: string;
  holidays: DashboardHolidayHighlight[];
};
