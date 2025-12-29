import type {
  EmploymentStatus,
  EmploymentType,
  LeaveStatus,
  LeaveType,
  WorkModel,
} from "@prisma/client";

export type TeamPersonSummary = {
  id: string;
  fullName: string;
  preferredName: string | null;
  avatarUrl: string | null;
  designation: string | null;
  email: string | null;
  workModel: WorkModel | null;
  isTeamLead: boolean;
};

export type TeamMemberSummary = {
  id: string;
  userId: string;
  fullName: string;
  preferredName: string | null;
  avatarUrl: string | null;
  designation: string | null;
  employmentType: EmploymentType;
  employmentTypeLabel: string;
  status: EmploymentStatus;
  statusLabel: string;
  workModel: WorkModel | null;
  workModelLabel: string;
  location: string | null;
  email: string | null;
  phone: string | null;
  startDate: string | null;
  startDateLabel: string | null;
  tenureMonths: number;
  tenureLabel: string;
  isTeamLead: boolean;
};

export type TeamHighlight = {
  id: string;
  label: string;
  value: string;
  helper: string;
};

export type TeamWorkModelStat = {
  id: string;
  label: string;
  count: number;
  percentage: number;
  accent: string;
  helper: string;
};

export type TeamAnniversary = {
  id: string;
  memberId: string;
  memberName: string;
  dateIso: string;
  dateLabel: string;
  yearsCompleted: number;
  daysAway: number;
};

export type TeamUpcomingLeave = {
  id: string;
  memberId: string;
  memberName: string;
  leaveType: LeaveType;
  leaveTypeLabel: string;
  status: LeaveStatus;
  statusLabel: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  helper: string;
};

export type TeamSummary = {
  id: string;
  name: string;
  description: string | null;
  departmentName: string | null;
  leads: TeamPersonSummary[];
  manager: TeamPersonSummary | null;
  locationHint: string | null;
};

export type MyTeamOverviewResponse = {
  hasTeam: boolean;
  timezone: string | null;
  team: TeamSummary | null;
  stats: {
    headcount: number;
    active: number;
    avgTenureMonths: number;
    avgTenureLabel: string;
  };
  highlights: TeamHighlight[];
  workModelStats: TeamWorkModelStat[];
  members: TeamMemberSummary[];
  newJoiners: TeamMemberSummary[];
  anniversaries: TeamAnniversary[];
  upcomingLeaves: TeamUpcomingLeave[];
};
