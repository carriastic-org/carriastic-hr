import type { Gender, UserRole, WorkModel } from "@prisma/client";

export type SeedOrganization = {
  id: string;
  name: string;
  domain: string;
  timezone: string;
  locale: string;
  logoUrl: string;
};

export type SeedDepartment = {
  id: string;
  name: string;
  code: string;
  description: string;
  headId?: string | null;
};

export type SeedTeam = {
  id: string;
  name: string;
  description: string;
  departmentId: string;
};

export type SeedUserConfig = {
  id: string;
  organizationId: string;
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  preferredName: string;
  designation: string;
  employeeCode: string;
  teamId?: string | null;
  departmentId?: string | null;
  workModel?: WorkModel;
  workPhone?: string | null;
  personalPhone?: string | null;
  reportingManagerId?: string | null;
  gender?: Gender;
};

export const CARRIASTIC_ORG_ID = "org-carriastic";

export const organizations: SeedOrganization[] = [
  {
    id: CARRIASTIC_ORG_ID,
    name: "Carriastic",
    domain: "carriastic.com",
    timezone: "Asia/Dhaka",
    locale: "en-US",
    logoUrl: "/logo/app_icon.png",
  },
];

export const organizationNameById = organizations.reduce<Record<string, string>>(
  (acc, org) => {
    acc[org.id] = org.name;
    return acc;
  },
  {},
);

export const orgDepartments: Record<string, SeedDepartment[]> = {
  [CARRIASTIC_ORG_ID]: [],
};

export const orgTeams: Record<string, SeedTeam[]> = {
  [CARRIASTIC_ORG_ID]: [],
};

export const teamDepartmentMap = Object.values(orgTeams)
  .flat()
  .reduce<Record<string, string>>((acc, team) => {
    acc[team.id] = team.departmentId;
    return acc;
  }, {});

export const usersToCreate: SeedUserConfig[] = [
  {
    id: "super-admin-carriastic",
    organizationId: CARRIASTIC_ORG_ID,
    email: "carriastic@gmail.com",
    password: "Carriastic@1000",
    role: "SUPER_ADMIN",
    firstName: "Carriastic",
    lastName: "Admin",
    preferredName: "Carriastic Admin",
    designation: "Super Admin",
    employeeCode: "CARRIASTIC-0001",
    workModel: "HYBRID",
    reportingManagerId: null,
    gender: "UNDISCLOSED",
  },
];

export const teamLeadAssignments: Array<{ teamId: string; leadUserIds: string[] }> = [];

export const teamManagerAssignments: Array<{ managerId: string; teamIds: string[] }> = [];
