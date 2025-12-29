export type HrDashboardAttendanceState = "on-time" | "late" | "remote" | "missing";

export type HrDashboardStatCard = {
  label: string;
  value: string;
  trend: string;
  descriptor: string;
};

export type HrDashboardCoverageSummary = {
  presentCount: number;
  totalEmployees: number;
  percentLabel: string;
  changeLabel: string;
  syncedLabel: string;
};

export type HrDashboardAttendanceBreakdownCard = {
  label: string;
  value: number;
  delta: string;
  gradient: string;
};

export type HrDashboardAttendanceTrendPoint = {
  hour: string;
  onsite: number;
  remote: number;
};

export type HrDashboardAttendanceLogEntry = {
  id: string;
  name: string;
  department: string;
  checkIn: string;
  status: string;
  method: string;
  state: HrDashboardAttendanceState;
};

export type HrDashboardLeaveApprovalCard = {
  id: string;
  name: string;
  role: string;
  type: string;
  duration: string;
  balance: string;
  coverage: string;
  submitted: string;
};

export type HrDashboardQuickAction = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  cta: string;
};

export type HrDashboardWorkforcePoint = {
  label: string;
  plan: number;
  actual: number;
};

export type HrDashboardWorkforceSignal = {
  label: string;
  value: string;
  detail: string;
};

export type HrDashboardEngagementGauge = {
  value: number;
  change: string;
};

export type HrDashboardEngagementSnapshotItem = {
  label: string;
  value: string;
  detail: string;
};

export type HrDashboardTeamCapacityItem = {
  team: string;
  committed: number;
  available: number;
};

export type HrDashboardResponse = {
  date: string;
  statHighlights: HrDashboardStatCard[];
  coverageSummary: HrDashboardCoverageSummary;
  attendanceBreakdown: HrDashboardAttendanceBreakdownCard[];
  attendanceTrend: HrDashboardAttendanceTrendPoint[];
  attendanceLog: HrDashboardAttendanceLogEntry[];
  leaveApprovals: HrDashboardLeaveApprovalCard[];
  quickActions: HrDashboardQuickAction[];
  workforceCapacity: HrDashboardWorkforcePoint[];
  workforceSignals: HrDashboardWorkforceSignal[];
  engagementGauge: HrDashboardEngagementGauge;
  engagementSnapshot: HrDashboardEngagementSnapshotItem[];
  teamCapacity: HrDashboardTeamCapacityItem[];
};
