import { EmploymentStatus, EmploymentType, Prisma, UserRole, WorkModel } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import type {
  EmployeeDirectoryEntry,
  EmployeeStatus,
  HrEmployeeCompensationResponse,
  HrEmployeeCompensationUpdateInput,
  HrEmployeeDashboardResponse,
  HrEmployeeForm,
  HrEmployeeFormResponse,
  HrEmployeeInviteInput,
  HrEmployeeInviteResponse,
  HrEmployeeLeaveQuotaResponse,
  HrEmployeeLeaveQuotaUpdateInput,
  HrInviteRoleOption,
  HrManualInviteOptions,
  HrEmployeeProfile,
  HrEmployeeProfileResponse,
  HrEmployeeUpdateInput,
} from "@/types/hr-admin";
import { canManageCompensation } from "@/types/hr-admin";

import { getEditPermission, getTerminationPermission, requireHrAdmin } from "@/server/modules/hr/utils";
import { addHours, createRandomToken, hashToken } from "@/server/utils/token";
import {
  INVITE_TOKEN_TTL_HOURS,
  buildInviteLink,
  createPlaceholderPasswordHash,
  formatRoleLabel,
  normalizeEmail,
  normalizePhoneNumber,
  sanitizeOptional,
  sendInvitationEmail,
  splitFullName,
} from "./invite.helpers";
import { deleteUserCascade } from "./delete-user";

const inviteRoleMatrix: Record<UserRole, UserRole[]> = {
  SUPER_ADMIN: ["ORG_OWNER", "ORG_ADMIN", "MANAGER", "HR_ADMIN", "EMPLOYEE"],
  ORG_OWNER: ["ORG_ADMIN", "MANAGER", "HR_ADMIN", "EMPLOYEE"],
  ORG_ADMIN: ["MANAGER", "HR_ADMIN", "EMPLOYEE"],
  MANAGER: ["HR_ADMIN", "EMPLOYEE"],
  HR_ADMIN: ["EMPLOYEE"],
  EMPLOYEE: [],
};

const employmentStatusToDirectoryStatus: Record<
  EmploymentStatus,
  EmployeeStatus
> = {
  [EmploymentStatus.ACTIVE]: "Active",
  [EmploymentStatus.PROBATION]: "Probation",
  [EmploymentStatus.SABBATICAL]: "On Leave",
  [EmploymentStatus.INACTIVE]: "Pending",
  [EmploymentStatus.TERMINATED]: "Pending",
};

const workModelLabels: Record<WorkModel, string> = {
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

const employmentTypeLabels: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERN: "Intern",
};

const getAllowedInviteRoles = (role: UserRole): UserRole[] => inviteRoleMatrix[role] ?? [];

const normalizeEmployeeCode = (value: string) => value.trim().toUpperCase();

const parseStartDateInput = (value?: string | null) => {
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid start date." });
  }
  return parsed;
};

const employeeSelect = {
  id: true,
  role: true,
  email: true,
  phone: true,
  status: true,
  createdAt: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      preferredName: true,
      workModel: true,
      currentAddress: true,
      profilePhotoUrl: true,
    },
  },
  employment: {
    select: {
      employeeCode: true,
      designation: true,
      employmentType: true,
      status: true,
      startDate: true,
      primaryLocation: true,
      department: {
        select: {
          name: true,
        },
      },
      team: {
        select: {
          name: true,
        },
      },
      manager: {
        select: {
          profile: {
            select: {
              firstName: true,
              lastName: true,
              preferredName: true,
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.UserSelect;

type EmployeeRecord = Prisma.UserGetPayload<{ select: typeof employeeSelect }>;

const pendingApprovalSelect = {
  id: true,
  email: true,
  invitedAt: true,
  createdAt: true,
  status: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      preferredName: true,
    },
  },
  employment: {
    select: {
      designation: true,
      startDate: true,
      department: {
        select: {
          name: true,
        },
      },
    },
  },
} as const satisfies Prisma.UserSelect;

const employeeDetailSelect = {
  id: true,
  role: true,
  email: true,
  phone: true,
  status: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      preferredName: true,
      workModel: true,
      currentAddress: true,
      permanentAddress: true,
      workEmail: true,
      workPhone: true,
      profilePhotoUrl: true,
    },
  },
  employment: {
    select: {
      employeeCode: true,
      designation: true,
      employmentType: true,
      status: true,
      startDate: true,
      primaryLocation: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      manager: {
        select: {
          id: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              preferredName: true,
            },
          },
        },
      },
      casualLeaveBalance: true,
      sickLeaveBalance: true,
      annualLeaveBalance: true,
      parentalLeaveBalance: true,
      grossSalary: true,
      incomeTax: true,
    },
  },
  emergencyContacts: {
    select: {
      id: true,
      name: true,
      relationship: true,
      phone: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 1,
  },
} as const satisfies Prisma.UserSelect;

type EmployeeDetailRecord = Prisma.UserGetPayload<{ select: typeof employeeDetailSelect }>;

type NameLikeProfile = {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
} | null | undefined;

const buildFullName = (profile: NameLikeProfile, fallback?: string) => {
  if (!profile) {
    return fallback ?? "Team member";
  }

  if (profile.preferredName) {
    return profile.preferredName;
  }

  const nameParts = [profile.firstName, profile.lastName].filter(Boolean);
  if (nameParts.length) {
    return nameParts.join(" ");
  }

  return fallback ?? "Team member";
};

const buildManualInviteOptions = async ({
  prisma,
  organizationId,
  viewerRole,
}: {
  prisma: TRPCContext["prisma"];
  organizationId: string;
  viewerRole: UserRole;
}): Promise<HrManualInviteOptions> => {
  const [organization, departments, teams, locationRecords] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        domain: true,
      },
    }),
    prisma.department.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        headId: true,
        head: {
          select: {
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                preferredName: true,
              },
            },
          },
        },
      },
    }),
    prisma.team.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        departmentId: true,
        leads: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            lead: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    preferredName: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.employmentDetail.findMany({
      where: {
        organizationId,
        primaryLocation: {
          not: null,
        },
      },
      distinct: ["primaryLocation"],
      select: {
        primaryLocation: true,
      },
    }),
  ]);

  const employmentTypes = (Object.keys(employmentTypeLabels) as EmploymentType[]).map((type) => ({
    value: type,
    label: employmentTypeLabels[type],
  }));

  const workModels = (Object.keys(workModelLabels) as WorkModel[]).map((model) => ({
    value: model,
    label: workModelLabels[model],
  }));

  const locations = locationRecords
    .map((record) => record.primaryLocation?.trim())
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b));

  const allowedRoles: HrInviteRoleOption[] = getAllowedInviteRoles(viewerRole).map((role) => ({
    value: role,
    label: formatRoleLabel(role),
  }));

  return {
    organizationDomain: organization?.domain ?? null,
    organizationName: organization?.name ?? "Your organization",
    departments: departments.map((department) => ({
      id: department.id,
      name: department.name,
      headId: department.headId,
      headName: department.head
        ? buildFullName(department.head.profile, department.head.email)
        : null,
    })),
    teams: teams.map((team) => {
      const leadUser = team.leads[0]?.lead ?? null;
      return {
        id: team.id,
        name: team.name,
        departmentId: team.departmentId,
        leadId: leadUser?.id ?? null,
        leadName: leadUser ? buildFullName(leadUser.profile, leadUser.email) : null,
      };
    }),
    locations,
    employmentTypes,
    workModels,
    allowedRoles,
  };
};

const buildInitials = (profile?: EmployeeRecord["profile"] | null, fallback?: string) => {
  const createFromString = (value: string) =>
    value
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2) || "HR";

  if (profile?.preferredName) {
    return createFromString(profile.preferredName);
  }

  const initials = [profile?.firstName, profile?.lastName]
    .filter(Boolean)
    .map((part) => part![0]?.toUpperCase())
    .join("");

  if (initials) {
    return initials.slice(0, 2);
  }

  if (profile?.firstName) {
    return profile.firstName[0]?.toUpperCase() ?? "HR";
  }

  if (fallback) {
    return createFromString(fallback);
  }

  return "HR";
};

const mapEmploymentStatus = (status: EmploymentStatus): EmployeeStatus =>
  employmentStatusToDirectoryStatus[status] ?? "Active";

const formatExperience = (startDate?: Date | null) => {
  if (!startDate) {
    return "—";
  }

  const now = Date.now();
  const diffMs = now - startDate.getTime();
  if (diffMs <= 0) {
    return "—";
  }

  const years = diffMs / (1000 * 60 * 60 * 24 * 365);
  if (years < 1) {
    const months = Math.floor(years * 12);
    return months <= 1 ? "< 1 mo" : `${months} mo`;
  }

  const wholeYears = Math.floor(years);
  return `${wholeYears} yr${wholeYears > 1 ? "s" : ""}`;
};

const formatManagerName = (
  record: NonNullable<EmployeeRecord["employment"]>["manager"] | null | undefined,
) => {
  const profile = record?.profile;
  if (!profile) {
    return null;
  }

  if (profile.preferredName) {
    return profile.preferredName;
  }

  const nameParts = [profile.firstName, profile.lastName].filter(Boolean);
  return nameParts.length ? nameParts.join(" ") : null;
};

const formatDateToIso = (date?: Date | null) => (date ? date.toISOString() : null);

const mapEmployeeRecord = (
  record: EmployeeRecord,
  viewer: { id: string; role: UserRole },
): EmployeeDirectoryEntry => {
  const profile = record.profile;
  const employment = record.employment;

  const statusSource = employment?.status ?? record.status;
  const terminationPermission = getTerminationPermission(viewer.role, record.role as UserRole, {
    isSelf: viewer.id === record.id,
  });

  return {
    id: record.id,
    userRole: record.role as UserRole,
    employeeCode: employment?.employeeCode ?? null,
    name: buildFullName(profile, record.email),
    role: employment?.designation ?? "Team member",
    department: employment?.department?.name ?? null,
    squad: employment?.team?.name ?? null,
    location: employment?.primaryLocation ?? profile?.currentAddress ?? null,
    status: mapEmploymentStatus(statusSource),
    startDate: formatDateToIso(employment?.startDate),
    email: record.email,
    phone: record.phone ?? null,
    manager: formatManagerName(employment?.manager) ?? null,
    employmentType: employment
      ? employmentTypeLabels[employment.employmentType]
      : "—",
    workArrangement: profile?.workModel ? workModelLabels[profile.workModel] : null,
    avatarInitials: buildInitials(profile, record.email),
    profilePhotoUrl: profile?.profilePhotoUrl ?? null,
    experience: formatExperience(employment?.startDate),
    canTerminate: terminationPermission.allowed,
  };
};

const employmentStatusFromLabel = (status: EmployeeStatus): EmploymentStatus => {
  const match = Object.entries(employmentStatusToDirectoryStatus).find(
    ([, label]) => label === status,
  );
  return (match?.[0] as EmploymentStatus) ?? EmploymentStatus.ACTIVE;
};

const decimalToNumber = (value?: Prisma.Decimal | null) =>
  value ? Number(value) : 0;

const parseMoneyInput = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  const normalized = Math.max(0, value);
  return Number(normalized.toFixed(2));
};

const findEmploymentTypeByLabel = (label?: string | null) => {
  if (!label) {
    return EmploymentType.FULL_TIME;
  }

  const entry = Object.entries(employmentTypeLabels).find(
    ([, value]) => value.toLowerCase() === label.toLowerCase(),
  );

  return (entry?.[0] as EmploymentType) ?? EmploymentType.FULL_TIME;
};

const findWorkModelByLabel = (label?: string | null) => {
  if (!label) {
    return null;
  }

  const entry = Object.entries(workModelLabels).find(
    ([, value]) => value.toLowerCase() === label.toLowerCase(),
  );

  return (entry?.[0] as WorkModel) ?? null;
};

const mapEmployeeProfileDetail = (record: EmployeeDetailRecord): HrEmployeeProfile => {
  const profile = record.profile;
  const employment = record.employment;
  const emergencyContact = record.emergencyContacts?.[0];

  return {
    id: record.id,
    employeeCode: employment?.employeeCode ?? null,
    name: buildFullName(profile, record.email),
    role: employment?.designation ?? "Team member",
    department: employment?.department?.name ?? null,
    squad: employment?.team?.name ?? null,
    location: employment?.primaryLocation ?? profile?.currentAddress ?? null,
    status: mapEmploymentStatus(employment?.status ?? record.status),
    startDate: formatDateToIso(employment?.startDate),
    email: profile?.workEmail ?? record.email,
    phone: record.phone ?? profile?.workPhone ?? null,
    manager: formatManagerName(employment?.manager) ?? null,
    employmentType: employment ? employmentTypeLabels[employment.employmentType] : "Full-time",
    workArrangement: profile?.workModel ? workModelLabels[profile.workModel] : null,
    avatarInitials: buildInitials(profile, record.email),
    profilePhotoUrl: profile?.profilePhotoUrl ?? null,
    experience: formatExperience(employment?.startDate),
    address: profile?.currentAddress ?? profile?.permanentAddress ?? null,
    emergencyContact: emergencyContact
      ? {
          name: emergencyContact.name,
          phone: emergencyContact.phone,
          relation: emergencyContact.relationship,
        }
      : null,
    leaveBalances: {
      annual: decimalToNumber(employment?.annualLeaveBalance),
      sick: decimalToNumber(employment?.sickLeaveBalance),
      casual: decimalToNumber(employment?.casualLeaveBalance),
      parental: decimalToNumber(employment?.parentalLeaveBalance),
    },
    tags: [],
    skills: [],
    documents: [],
    salaryBand: null,
    annualSalary: null,
    lastReview: null,
    nextReview: null,
  };
};

const mapEmployeeForm = (record: EmployeeDetailRecord): HrEmployeeForm => {
  const profile = record.profile;
  const employment = record.employment;
  const emergencyContact = record.emergencyContacts?.[0];

  const fullNameParts = [profile?.firstName, profile?.lastName].filter(Boolean);
  const fullName = fullNameParts.length
    ? fullNameParts.join(" ")
    : buildFullName(profile, record.email);

  return {
    id: record.id,
    userRole: record.role as UserRole,
    employeeCode: employment?.employeeCode ?? null,
    fullName,
    preferredName: profile?.preferredName ?? null,
    email: profile?.workEmail ?? record.email,
    phone: record.phone ?? profile?.workPhone ?? null,
    address: profile?.currentAddress ?? profile?.permanentAddress ?? null,
    role: employment?.designation ?? "",
    department: employment?.department?.name ?? null,
    employmentType: employment
      ? employmentTypeLabels[employment.employmentType]
      : employmentTypeLabels[EmploymentType.FULL_TIME],
    workArrangement: profile?.workModel ? workModelLabels[profile.workModel] : null,
    workLocation: employment?.primaryLocation ?? null,
    startDate: formatDateToIso(employment?.startDate),
    status: mapEmploymentStatus(employment?.status ?? record.status),
    emergencyContact: emergencyContact
      ? {
          name: emergencyContact.name,
          phone: emergencyContact.phone,
          relation: emergencyContact.relationship,
        }
      : null,
    profilePhotoUrl: profile?.profilePhotoUrl ?? null,
    leaveBalances: {
      annual: decimalToNumber(employment?.annualLeaveBalance),
      sick: decimalToNumber(employment?.sickLeaveBalance),
      casual: decimalToNumber(employment?.casualLeaveBalance),
      parental: decimalToNumber(employment?.parentalLeaveBalance),
    },
    grossSalary: decimalToNumber(employment?.grossSalary),
    incomeTax: decimalToNumber(employment?.incomeTax),
  };
};

export const hrEmployeesService = {
  async getDashboard(ctx: TRPCContext): Promise<HrEmployeeDashboardResponse> {
    const user = requireHrAdmin(ctx);
    const viewerRole = user.role as UserRole;

    const [employees, manualInvite] = await Promise.all([
      ctx.prisma.user.findMany({
        where: {
          organizationId: user.organizationId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: employeeSelect,
      }),
      buildManualInviteOptions({
        prisma: ctx.prisma,
        organizationId: user.organizationId,
        viewerRole: user.role as UserRole,
      }),
    ]);

    return {
      viewerRole,
      viewerId: user.id,
      directory: employees.map((employee) =>
        mapEmployeeRecord(employee, { id: user.id, role: viewerRole }),
      ),
      manualInvite,
    };
  },

  async getEmployeeProfile(
    ctx: TRPCContext,
    employeeId: string,
  ): Promise<HrEmployeeProfileResponse> {
    const sessionUser = requireHrAdmin(ctx);

    const record = await ctx.prisma.user.findFirst({
      where: {
        id: employeeId,
        organizationId: sessionUser.organizationId,
      },
      select: employeeDetailSelect,
    });

    if (!record) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });
    }

    return { profile: mapEmployeeProfileDetail(record) };
  },

  async getEmployeeForm(
    ctx: TRPCContext,
    employeeId: string,
  ): Promise<HrEmployeeFormResponse> {
    const sessionUser = requireHrAdmin(ctx);
    const viewerRole = sessionUser.role as UserRole;

    const record = await ctx.prisma.user.findFirst({
      where: {
        id: employeeId,
        organizationId: sessionUser.organizationId,
      },
      select: employeeDetailSelect,
    });

    if (!record) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });
    }

    const targetRole = record.role as UserRole;
    const permission = getEditPermission(viewerRole, targetRole);
    const canEditCompensation = canManageCompensation(viewerRole);

    return {
      form: mapEmployeeForm(record),
      permissions: {
        canEdit: permission.allowed,
        viewerRole,
        targetRole,
        reason: permission.reason,
        canEditCompensation,
      },
    };
  },

  async updateEmployee(
    ctx: TRPCContext,
    input: HrEmployeeUpdateInput,
  ): Promise<HrEmployeeFormResponse> {
    const sessionUser = requireHrAdmin(ctx);
    const viewerRole = sessionUser.role as UserRole;
    const existing = await ctx.prisma.user.findFirst({
      where: {
        id: input.employeeId,
        organizationId: sessionUser.organizationId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });
    }

    const targetRole = existing.role as UserRole;
    const permission = getEditPermission(viewerRole, targetRole);
    if (!permission.allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: permission.reason ?? "You are not allowed to edit this employee.",
      });
    }

    const { firstName, lastName } = splitFullName(input.fullName);
    const employmentType = findEmploymentTypeByLabel(input.employmentType);
    const workModel = findWorkModelByLabel(input.workArrangement);
    const employmentStatus = employmentStatusFromLabel(input.status);

    let departmentId: string | null = null;
    const normalizedDepartment = input.department?.trim();
    if (normalizedDepartment) {
      const department = await ctx.prisma.department.findFirst({
        where: {
          organizationId: sessionUser.organizationId,
          name: normalizedDepartment,
        },
      });

      if (department) {
        departmentId = department.id;
      } else {
        const createdDepartment = await ctx.prisma.department.create({
          data: {
            organizationId: sessionUser.organizationId,
            name: normalizedDepartment,
          },
        });
        departmentId = createdDepartment.id;
      }
    }

    let parsedStartDate: Date | null = null;
    if (input.startDate) {
      const candidate = new Date(input.startDate);
      if (Number.isNaN(candidate.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid start date." });
      }
      parsedStartDate = candidate;
    }

    const grossSalary = parseMoneyInput(input.grossSalary);
    const incomeTax = parseMoneyInput(input.incomeTax);

    await ctx.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.employeeId },
        data: {
          email: input.email,
          phone: input.phone,
        },
      });

      await tx.employeeProfile.update({
        where: { userId: input.employeeId },
        data: {
          firstName,
          lastName,
          preferredName: input.preferredName,
          workEmail: input.email,
          workPhone: input.phone,
          currentAddress: input.address,
          workModel,
        },
      });

      await tx.employmentDetail.update({
        where: { userId: input.employeeId },
        data: {
          designation: input.role,
          employmentType,
          primaryLocation: input.workLocation,
          startDate: parsedStartDate ?? undefined,
          departmentId,
          status: employmentStatus,
          ...(grossSalary !== null ? { grossSalary } : {}),
          ...(incomeTax !== null ? { incomeTax } : {}),
        },
      });

      const hasEmergencyValues =
        Boolean(input.emergencyName?.trim()) ||
        Boolean(input.emergencyPhone?.trim()) ||
        Boolean(input.emergencyRelation?.trim());

      if (hasEmergencyValues) {
        const existingContact = await tx.emergencyContact.findFirst({
          where: { userId: input.employeeId },
        });

        const emergencyData = {
          name: input.emergencyName?.trim() || "Emergency contact",
          phone: input.emergencyPhone?.trim() || "",
          relationship: input.emergencyRelation?.trim() || "Family",
        };

        if (existingContact) {
          await tx.emergencyContact.update({
            where: { id: existingContact.id },
            data: emergencyData,
          });
        } else {
          await tx.emergencyContact.create({
            data: {
              userId: input.employeeId,
              ...emergencyData,
            },
          });
        }
      } else {
        await tx.emergencyContact.deleteMany({
          where: { userId: input.employeeId },
        });
      }
    });

    return this.getEmployeeForm(ctx, input.employeeId);
  },

  async updateLeaveBalances(
    ctx: TRPCContext,
    input: HrEmployeeLeaveQuotaUpdateInput,
  ): Promise<HrEmployeeLeaveQuotaResponse> {
    const sessionUser = requireHrAdmin(ctx);
    const employment = await ctx.prisma.employmentDetail.findFirst({
      where: {
        userId: input.employeeId,
        user: {
          organizationId: sessionUser.organizationId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!employment) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });
    }

    const clampBalance = (value: number) =>
      Number(Math.max(0, Math.min(value, 365)).toFixed(2));

    const updated = await ctx.prisma.employmentDetail.update({
      where: { id: employment.id },
      data: {
        annualLeaveBalance: clampBalance(input.annual),
        sickLeaveBalance: clampBalance(input.sick),
        casualLeaveBalance: clampBalance(input.casual),
        parentalLeaveBalance: clampBalance(input.parental),
      },
      select: {
        annualLeaveBalance: true,
        sickLeaveBalance: true,
        casualLeaveBalance: true,
        parentalLeaveBalance: true,
      },
    });

    return {
      leaveBalances: {
        annual: decimalToNumber(updated.annualLeaveBalance),
        sick: decimalToNumber(updated.sickLeaveBalance),
        casual: decimalToNumber(updated.casualLeaveBalance),
        parental: decimalToNumber(updated.parentalLeaveBalance),
      },
    };
  },

  async updateCompensation(
    ctx: TRPCContext,
    input: HrEmployeeCompensationUpdateInput,
  ): Promise<HrEmployeeCompensationResponse> {
    const sessionUser = requireHrAdmin(ctx);
    const viewerRole = sessionUser.role as UserRole;
    if (!canManageCompensation(viewerRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to update compensation details.",
      });
    }

    const employment = await ctx.prisma.employmentDetail.findFirst({
      where: {
        userId: input.employeeId,
        organizationId: sessionUser.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!employment) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });
    }

    const grossSalary = parseMoneyInput(input.grossSalary);
    const incomeTax = parseMoneyInput(input.incomeTax);

    const updated = await ctx.prisma.employmentDetail.update({
      where: { id: employment.id },
      data: {
        ...(grossSalary !== null ? { grossSalary } : {}),
        ...(incomeTax !== null ? { incomeTax } : {}),
      },
      select: {
        grossSalary: true,
        incomeTax: true,
      },
    });

    return {
      compensation: {
        grossSalary: decimalToNumber(updated.grossSalary),
        incomeTax: decimalToNumber(updated.incomeTax),
      },
    };
  },

  async inviteEmployee(
    ctx: TRPCContext,
    input: HrEmployeeInviteInput,
  ): Promise<HrEmployeeInviteResponse> {
    const sessionUser = requireHrAdmin(ctx);
    const viewerRole = sessionUser.role as UserRole;
    const allowedRoles = getAllowedInviteRoles(viewerRole);

    if (!allowedRoles.includes(input.inviteRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not allowed to invite that role.",
      });
    }

    const organization = await ctx.prisma.organization.findUnique({
      where: { id: sessionUser.organizationId },
      select: {
        id: true,
        name: true,
        domain: true,
      },
    });

    if (!organization) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Your organization is not available.",
      });
    }

    const normalizedEmail = normalizeEmail(input.workEmail);
    const employeeCode = normalizeEmployeeCode(input.employeeCode);
    let departmentId = sanitizeOptional(input.departmentId);
    const requestedManagerId = sanitizeOptional(input.managerId);
    const teamId = sanitizeOptional(input.teamId);
    const normalizedPhone = normalizePhoneNumber(input.phoneNumber);

    if (!employeeCode) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Employee ID is required.",
      });
    }

    if (!normalizedPhone) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Phone number is required.",
      });
    }

    let resolvedDepartment: { id: string; headId: string | null } | null = null;
    if (departmentId) {
      resolvedDepartment = await ctx.prisma.department.findFirst({
        where: {
          id: departmentId,
          organizationId: organization.id,
        },
        select: {
          id: true,
          headId: true,
        },
      });
      if (!resolvedDepartment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected department does not exist.",
        });
      }
    }

    let resolvedTeam:
      | {
          id: string;
          departmentId: string;
          leadId: string | null;
        }
      | null = null;

    if (teamId) {
      const teamRecord = await ctx.prisma.team.findFirst({
        where: {
          id: teamId,
          organizationId: organization.id,
        },
        select: {
          id: true,
          departmentId: true,
          leads: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: {
              leadId: true,
            },
          },
        },
      });

      if (!teamRecord) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected team does not exist.",
        });
      }

      if (departmentId && teamRecord.departmentId !== departmentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected team does not belong to that department.",
        });
      }

      if (!departmentId) {
        departmentId = teamRecord.departmentId;
        resolvedDepartment = await ctx.prisma.department.findFirst({
          where: {
            id: departmentId,
            organizationId: organization.id,
          },
          select: {
            id: true,
            headId: true,
          },
        });
      }

      resolvedTeam = {
        id: teamRecord.id,
        departmentId: teamRecord.departmentId,
        leadId: teamRecord.leads[0]?.leadId ?? null,
      };
    }

    let resolvedManagerId = requestedManagerId;
    if (!resolvedManagerId) {
      resolvedManagerId = resolvedTeam?.leadId ?? resolvedDepartment?.headId ?? null;
    }

    if (resolvedManagerId) {
      const managerExists = await ctx.prisma.user.findFirst({
        where: {
          id: resolvedManagerId,
          organizationId: organization.id,
        },
        select: { id: true },
      });

      if (!managerExists) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected manager does not exist.",
        });
      }
    }

    const designation = input.designation.trim();
    if (!designation) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Role/title cannot be empty.",
      });
    }

    const duplicateEmployee = await ctx.prisma.employmentDetail.findFirst({
      where: {
        organizationId: organization.id,
        employeeCode,
      },
      select: { id: true },
    });

    if (duplicateEmployee) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This employee ID is already in use.",
      });
    }

    const { firstName, lastName } = splitFullName(input.fullName);
    const startDate = parseStartDateInput(input.startDate);
    const placeholderPasswordHash = await createPlaceholderPasswordHash();

    const invitation = await ctx.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account already exists for that email address.",
        });
      }

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash: placeholderPasswordHash,
          role: input.inviteRole,
          status: EmploymentStatus.INACTIVE,
          invitedAt: new Date(),
          invitedById: sessionUser.id,
        },
        select: {
          id: true,
          email: true,
        },
      });

      await tx.employeeProfile.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          preferredName: firstName,
          workEmail: normalizedEmail,
          workPhone: normalizedPhone,
          workModel: input.workModel,
        },
      });

      await tx.employmentDetail.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          employeeCode,
          designation,
          employmentType: input.employmentType,
          status: EmploymentStatus.INACTIVE,
          startDate,
          departmentId: departmentId ?? undefined,
          teamId: resolvedTeam?.id ?? undefined,
          primaryLocation: sanitizeOptional(input.workLocation),
          reportingManagerId: resolvedManagerId ?? undefined,
          currentProjectNote: sanitizeOptional(input.notes),
        },
      });

      await tx.invitationToken.deleteMany({
        where: { userId: user.id },
      });

      const rawToken = createRandomToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = addHours(INVITE_TOKEN_TTL_HOURS);

      await tx.invitationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      return {
        user,
        rawToken,
        expiresAt,
      };
    });

    const inviteLink = buildInviteLink(invitation.rawToken, normalizedEmail);
    const senderDisplayName =
      ctx.session?.user?.profile?.preferredName ??
      ctx.session?.user?.profile?.firstName ??
      ctx.session?.user?.email ??
      sessionUser.email ??
      null;
    let invitationSent = false;

    if (input.sendInvite ?? true) {
      try {
        invitationSent = await sendInvitationEmail({
          to: normalizedEmail,
          inviteLink,
          organizationName: organization.name,
          invitedRole: input.inviteRole,
          recipientName: firstName,
          expiresAt: invitation.expiresAt,
          senderName: senderDisplayName,
        });
      } catch (error) {
        console.error("Failed to send invite email:", error);
        invitationSent = false;
      }
    }

    return {
      userId: invitation.user.id,
      email: normalizedEmail,
      role: input.inviteRole,
      invitationSent,
      inviteUrl: inviteLink,
    };
  },

  async deleteEmployee(ctx: TRPCContext, employeeId: string) {
    const sessionUser = requireHrAdmin(ctx);
    const viewerRole = sessionUser.role as UserRole;
    const isSelf = sessionUser.id === employeeId;

    const employee = await ctx.prisma.user.findFirst({
      where: {
        id: employeeId,
        ...(viewerRole === "SUPER_ADMIN"
          ? {}
          : { organizationId: sessionUser.organizationId }),
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!employee) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });
    }

    const terminationPermission = getTerminationPermission(viewerRole, employee.role as UserRole, {
      isSelf,
    });

    if (!terminationPermission.allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: terminationPermission.reason ?? "You cannot terminate this employee.",
      });
    }

    await ctx.prisma.$transaction(async (tx) => {
      await deleteUserCascade(tx, employeeId);
    });

    return { message: "Employee terminated." };
  },
};
