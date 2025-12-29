import type { UserRole } from "@prisma/client";

export const TEAM_MANAGEMENT_ROLES = ["MANAGER", "ORG_ADMIN", "ORG_OWNER", "SUPER_ADMIN"] as const;
export type TeamManagementRole = (typeof TEAM_MANAGEMENT_ROLES)[number];

export const canManageTeams = (
  role?: UserRole | null,
): role is TeamManagementRole => {
  if (!role) {
    return false;
  }
  return (TEAM_MANAGEMENT_ROLES as readonly UserRole[]).includes(role);
};

export type HrTeamPerson = {
  userId: string;
  fullName: string;
  designation: string | null;
  email: string | null;
  avatarUrl: string | null;
  teamId: string | null;
  teamName: string | null;
  isTeamLead: boolean;
};

export type HrTeamSummary = {
  id: string;
  name: string;
  description: string | null;
  departmentId: string;
  departmentName: string;
  leads: HrTeamPerson[];
  leadUserIds: string[];
  memberUserIds: string[];
  memberCount: number;
  memberPreview: HrTeamPerson[];
};

export type HrTeamManagementResponse = {
  viewerRole: UserRole;
  canManage: boolean;
  departments: Array<{ id: string; name: string }>;
  employees: HrTeamPerson[];
  teams: HrTeamSummary[];
};

export type HrCreateTeamInput = {
  name: string;
  departmentId: string;
  description?: string | null;
};

export type HrAssignTeamLeadInput = {
  teamId: string;
  leadUserIds: string[];
};

export type HrAssignTeamMembersInput = {
  teamId: string;
  memberUserIds: string[];
};
