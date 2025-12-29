import type { ProjectStatus, UserRole } from "@prisma/client";

export const PROJECT_MANAGEMENT_ROLES = [
  "SUPER_ADMIN",
  "ORG_OWNER",
  "ORG_ADMIN",
  "MANAGER",
] as const;

export type ProjectManagementRole = (typeof PROJECT_MANAGEMENT_ROLES)[number];

export const canManageProjects = (
  role?: UserRole | null,
): role is ProjectManagementRole => {
  if (!role) {
    return false;
  }
  return (PROJECT_MANAGEMENT_ROLES as readonly UserRole[]).includes(role);
};

export type HrProjectMember = {
  userId: string;
  fullName: string;
  email: string | null;
  designation: string | null;
  avatarUrl: string | null;
};

export type HrProjectSummary = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  clientName: string | null;
  status: ProjectStatus;
  startDateIso: string | null;
  endDateIso: string | null;
  projectManagerId: string | null;
  projectManagerName: string | null;
  projectManagerEmail: string | null;
  projectManagerAvatarUrl: string | null;
  memberCount: number;
  memberUserIds: string[];
  memberPreview: HrProjectMember[];
  createdAtIso: string;
  updatedAtIso: string;
};

export type HrProjectOverviewResponse = {
  viewerRole: UserRole;
  canManage: boolean;
  projects: HrProjectSummary[];
  employees: HrProjectMember[];
};

export type HrCreateProjectInput = {
  name: string;
  code?: string | null;
  description?: string | null;
  clientName?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  projectManagerId?: string | null;
  memberUserIds?: string[];
};

export type HrUpdateProjectInput = HrCreateProjectInput & {
  projectId: string;
};

export type HrDeleteProjectResponse = {
  projectId: string;
  message: string;
};
