import type { UserRole } from "@prisma/client";

export const DEPARTMENT_MANAGEMENT_ROLES = ["ORG_ADMIN", "ORG_OWNER", "SUPER_ADMIN"] as const;
export type DepartmentManagementRole = (typeof DEPARTMENT_MANAGEMENT_ROLES)[number];

export const canManageDepartments = (
  role?: UserRole | null,
): role is DepartmentManagementRole => {
  if (!role) {
    return false;
  }
  return (DEPARTMENT_MANAGEMENT_ROLES as readonly UserRole[]).includes(role);
};

export type HrDepartmentPerson = {
  userId: string;
  fullName: string;
  email: string | null;
  designation: string | null;
  avatarUrl: string | null;
  departmentId: string | null;
  departmentName: string | null;
};

export type HrDepartmentSummary = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  headUserId: string | null;
  headName: string | null;
  headEmail: string | null;
  headAvatarUrl: string | null;
  memberCount: number;
  memberUserIds: string[];
  memberPreview: HrDepartmentPerson[];
  createdAtIso: string;
  updatedAtIso: string;
};

export type HrDepartmentManagementResponse = {
  viewerRole: UserRole;
  canManage: boolean;
  departments: HrDepartmentSummary[];
  employees: HrDepartmentPerson[];
};

export type HrCreateDepartmentInput = {
  name: string;
  code?: string | null;
  description?: string | null;
};

export type HrUpdateDepartmentInput = {
  departmentId: string;
  name: string;
  code?: string | null;
  description?: string | null;
};

export type HrAssignDepartmentHeadInput = {
  departmentId: string;
  headUserId?: string | null;
};

export type HrAssignDepartmentMembersInput = {
  departmentId: string;
  memberUserIds: string[];
};
