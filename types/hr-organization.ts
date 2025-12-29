import type { UserRole } from "@prisma/client";

export const ORGANIZATION_MANAGEMENT_ROLES = ["ORG_OWNER", "SUPER_ADMIN"] as const;

export type OrganizationManagementRole =
  (typeof ORGANIZATION_MANAGEMENT_ROLES)[number];

export const canManageOrganization = (
  role?: UserRole | null,
): role is OrganizationManagementRole => {
  if (!role) {
    return false;
  }
  return (ORGANIZATION_MANAGEMENT_ROLES as readonly UserRole[]).includes(role);
};

export type HrOrganizationDetails = {
  id: string;
  name: string;
  domain: string | null;
  timezone: string | null;
  locale: string | null;
  logoUrl: string;
  createdAtIso: string;
  updatedAtIso: string;
  totalEmployees: number;
};

export type HrOrganizationAdmin = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation: string | null;
  avatarUrl: string | null;
};

export type HrOrganizationMember = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation: string | null;
};

export type HrOrganizationManagementResponse = {
  viewerRole: UserRole;
  canManage: boolean;
  organization: HrOrganizationDetails | null;
  admins: HrOrganizationAdmin[];
  eligibleMembers: HrOrganizationMember[];
  canCreateOrganizations: boolean;
};

export type HrCreateOrganizationResponse = {
  organizationId: string;
  organizationName: string;
  ownerId: string;
  ownerEmail: string;
  inviteUrl: string;
  invitationSent: boolean;
};

export type HrOrganizationListResponse = {
  organizations: HrOrganizationDetails[];
};

export type HrOrganizationDeleteResponse = {
  organizationId: string;
  message: string;
};
