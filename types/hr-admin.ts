import type { EmploymentType, UserRole, WorkModel } from "@prisma/client";

export type EmployeeStatus = "Active" | "On Leave" | "Probation" | "Pending";

export type EmployeeDocumentStatus = "Signed" | "Pending" | "Missing";

export type EmployeeDirectoryEntry = {
  id: string;
  employeeCode: string | null;
  name: string;
  role: string;
  userRole: UserRole;
  department: string | null;
  squad: string | null;
  location: string | null;
  status: EmployeeStatus;
  startDate: string | null;
  email: string;
  phone: string | null;
  manager: string | null;
  employmentType: string;
  workArrangement: string | null;
  avatarInitials: string;
  experience: string;
  profilePhotoUrl: string | null;
  canTerminate: boolean;
};

export type HrInviteRoleOption = {
  value: UserRole;
  label: string;
};

export const COMPENSATION_MANAGER_ROLES = [
  "HR_ADMIN",
  "MANAGER",
  "ORG_ADMIN",
  "ORG_OWNER",
  "SUPER_ADMIN",
] as const;

export type CompensationManagerRole =
  (typeof COMPENSATION_MANAGER_ROLES)[number];

export const canManageCompensation = (
  role?: UserRole | null,
): role is CompensationManagerRole => {
  if (!role) {
    return false;
  }
  return (COMPENSATION_MANAGER_ROLES as readonly UserRole[]).includes(role);
};

export type HrManualInviteOptions = {
  organizationDomain: string | null;
  organizationName: string;
  departments: Array<{
    id: string;
    name: string;
    headId: string | null;
    headName: string | null;
  }>;
  teams: Array<{
    id: string;
    name: string;
    departmentId: string;
    leadId: string | null;
    leadName: string | null;
  }>;
  locations: string[];
  employmentTypes: Array<{ value: EmploymentType; label: string }>;
  workModels: Array<{ value: WorkModel; label: string }>;
  allowedRoles: HrInviteRoleOption[];
};

export type HrEmployeeFormPermissions = {
  canEdit: boolean;
  viewerRole: UserRole;
  targetRole: UserRole;
  reason: string | null;
  canEditCompensation: boolean;
};

export type HrEmployeeDashboardResponse = {
  directory: EmployeeDirectoryEntry[];
  viewerRole: UserRole;
  viewerId: string;
  manualInvite: HrManualInviteOptions;
};

export type HrEmployeeDocument = {
  name: string;
  status: EmployeeDocumentStatus;
};

export type HrEmployeeEmergencyContact = {
  name: string;
  phone: string;
  relation: string;
};

export type HrEmployeeLeaveBalances = {
  annual: number;
  sick: number;
  casual: number;
  parental: number;
};

export type HrEmployeeProfile = {
  id: string;
  employeeCode: string | null;
  name: string;
  role: string;
  department: string | null;
  squad: string | null;
  location: string | null;
  status: EmployeeStatus;
  startDate: string | null;
  email: string;
  phone: string | null;
  manager: string | null;
  employmentType: string;
  workArrangement: string | null;
  avatarInitials: string;
  profilePhotoUrl: string | null;
  experience: string;
  address: string | null;
  emergencyContact: HrEmployeeEmergencyContact | null;
  leaveBalances: HrEmployeeLeaveBalances;
  tags: string[];
  skills: string[];
  documents: HrEmployeeDocument[];
  salaryBand: string | null;
  annualSalary: number | null;
  lastReview: string | null;
  nextReview: string | null;
};

export type HrEmployeeProfileResponse = {
  profile: HrEmployeeProfile;
};

export type HrEmployeeForm = {
  id: string;
  userRole: UserRole;
  employeeCode: string | null;
  fullName: string;
  preferredName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  role: string;
  department: string | null;
  employmentType: string;
  workArrangement: string | null;
  workLocation: string | null;
  startDate: string | null;
  status: EmployeeStatus;
  emergencyContact: HrEmployeeEmergencyContact | null;
  profilePhotoUrl: string | null;
  leaveBalances: HrEmployeeLeaveBalances;
  grossSalary: number;
  incomeTax: number;
};

export type HrEmployeeFormResponse = {
  form: HrEmployeeForm;
  permissions: HrEmployeeFormPermissions;
};

export type HrEmployeeUpdateInput = {
  employeeId: string;
  fullName: string;
  preferredName?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  role: string;
  department?: string | null;
  employmentType: string;
  workArrangement?: string | null;
  workLocation?: string | null;
  startDate?: string | null;
  status: EmployeeStatus;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  emergencyRelation?: string | null;
  grossSalary?: number | null;
  incomeTax?: number | null;
};

export type HrEmployeeLeaveQuotaUpdateInput = {
  employeeId: string;
  annual: number;
  sick: number;
  casual: number;
  parental: number;
};

export type HrEmployeeLeaveQuotaResponse = {
  leaveBalances: HrEmployeeLeaveBalances;
};

export type HrEmployeeCompensationUpdateInput = {
  employeeId: string;
  grossSalary: number;
  incomeTax: number;
};

export type HrEmployeeCompensationResponse = {
  compensation: {
    grossSalary: number;
    incomeTax: number;
  };
};

export type HrEmployeeInviteResponse = {
  userId: string;
  email: string;
  role: UserRole;
  invitationSent: boolean;
  inviteUrl: string;
};

export type HrEmployeeInviteInput = {
  fullName: string;
  employeeCode: string;
  workEmail: string;
  inviteRole: UserRole;
  designation: string;
  departmentId?: string | null;
  teamId?: string | null;
  managerId?: string | null;
  phoneNumber: string;
  startDate?: string | null;
  workLocation?: string | null;
  employmentType: EmploymentType;
  workModel: WorkModel;
  notes?: string | null;
  sendInvite?: boolean;
};
