import bcrypt from "bcryptjs";
import {
  EmploymentStatus,
  EmploymentType,
  Prisma,
  UserRole,
  WorkModel,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import type {
  HrOrganizationListResponse,
  HrOrganizationManagementResponse,
  HrCreateOrganizationResponse,
  HrOrganizationDeleteResponse,
} from "@/types/hr-organization";
import { canManageOrganization } from "@/types/hr-organization";
import {
  INVITE_TOKEN_TTL_HOURS,
  buildInviteLink,
  createPlaceholderPasswordHash,
  normalizeEmail,
  normalizePhoneNumber,
  sanitizeOptional,
  sendInvitationEmail,
  splitFullName,
} from "@/server/modules/hr/employees/invite.helpers";
import { deleteUserCascade } from "@/server/modules/hr/employees/delete-user";
import {
  requireOrganizationManager,
  requireSuperAdmin,
} from "@/server/modules/hr/utils";
import { addHours, createRandomToken, hashToken } from "@/server/utils/token";
import { DEFAULT_ORGANIZATION_LOGO } from "@/lib/organization-branding";

const buildDisplayName = (
  profile: {
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
  } | null,
  fallback: string,
) => {
  if (!profile) {
    return fallback;
  }
  if (profile.preferredName?.trim()) {
    return profile.preferredName.trim();
  }
  const names = [profile.firstName, profile.lastName].filter(Boolean);
  if (names.length) {
    return names.join(" ");
  }
  return fallback;
};

const mapOrganizationRecord = (record: {
  id: string;
  name: string;
  domain: string | null;
  timezone: string | null;
  locale: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { users: number };
}) => ({
  id: record.id,
  name: record.name,
  domain: record.domain,
  timezone: record.timezone,
  locale: record.locale,
  logoUrl: record.logoUrl ?? DEFAULT_ORGANIZATION_LOGO,
  createdAtIso: record.createdAt.toISOString(),
  updatedAtIso: record.updatedAt.toISOString(),
  totalEmployees: record._count.users,
});

const generateOwnerEmployeeCode = (organizationName: string) => {
  const normalized = organizationName
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
  const prefix = normalized.slice(0, 4) || "ORG";
  return `${prefix}-OWNER-1`;
};

const handlePrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target)
      ? error.meta?.target.join(", ")
      : (error.meta?.target as string | undefined);
    if (target?.includes("domain")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "That organization domain is already in use.",
      });
    }
    if (target?.includes("email")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An account already exists for that email address.",
      });
    }
  }
  throw error;
};

export const hrOrganizationService = {
  async management(
    ctx: TRPCContext,
    organizationId?: string,
  ): Promise<HrOrganizationManagementResponse> {
    if (!ctx.session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const user = ctx.session.user;
    const viewerRole = user.role as UserRole;
    if (!canManageOrganization(viewerRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Organization management access denied.",
      });
    }

    let totalOrganizations = 0;
    if (viewerRole === "SUPER_ADMIN") {
      totalOrganizations = await ctx.prisma.organization.count();
    }
    const canCreateOrganizations =
      viewerRole === "SUPER_ADMIN" && totalOrganizations === 0;
    let targetOrganizationId = user.organizationId ?? null;

    if (viewerRole === "SUPER_ADMIN" && organizationId) {
      targetOrganizationId = organizationId;
    } else if (organizationId && organizationId !== targetOrganizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only manage your own organization.",
      });
    }

    if (!targetOrganizationId) {
      return {
        viewerRole,
        canManage: true,
        organization: null,
        admins: [],
        eligibleMembers: [],
        canCreateOrganizations,
      };
    }

    const [organization, adminRecords, eligibleRecords] = await Promise.all([
      ctx.prisma.organization.findUnique({
        where: { id: targetOrganizationId },
        select: {
          id: true,
          name: true,
          domain: true,
          timezone: true,
          locale: true,
          logoUrl: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { users: true },
          },
        },
      }),
      ctx.prisma.user.findMany({
        where: {
          organizationId: targetOrganizationId,
          role: "ORG_ADMIN",
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          role: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              preferredName: true,
              profilePhotoUrl: true,
            },
          },
          employment: {
            select: {
              designation: true,
            },
          },
        },
      }),
      ctx.prisma.user.findMany({
        where: {
          organizationId: targetOrganizationId,
          role: { in: ["HR_ADMIN", "MANAGER", "EMPLOYEE"] },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          role: true,
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
            },
          },
        },
      }),
    ]);

    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found.",
      });
    }

    return {
      viewerRole,
      canManage: true,
      organization: mapOrganizationRecord(organization),
      admins: adminRecords.map((admin) => ({
        id: admin.id,
        name: buildDisplayName(admin.profile, admin.email),
        email: admin.email,
        role: admin.role as UserRole,
        designation: admin.employment?.designation ?? null,
        avatarUrl: admin.profile?.profilePhotoUrl ?? null,
      })),
      eligibleMembers: eligibleRecords.map((member) => ({
        id: member.id,
        name: buildDisplayName(member.profile, member.email),
        email: member.email,
        role: member.role as UserRole,
        designation: member.employment?.designation ?? null,
      })),
      canCreateOrganizations,
    };
  },

  async listAll(ctx: TRPCContext): Promise<HrOrganizationListResponse> {
    requireSuperAdmin(ctx);
    const organizations = await ctx.prisma.organization.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        domain: true,
        timezone: true,
        locale: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { users: true },
        },
      },
    });

    return {
      organizations: organizations.map(mapOrganizationRecord),
    };
  },

  async updateDetails(
    ctx: TRPCContext,
    input: {
      name: string;
      domain?: string | null;
      timezone?: string | null;
      locale?: string | null;
      organizationId?: string | null;
      logoUrl?: string | null;
    },
  ) {
    if (!ctx.session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const viewer = ctx.session.user;
    let targetOrganizationId: string | null = viewer.organizationId ?? null;

    if (viewer.role === "SUPER_ADMIN") {
      targetOrganizationId = input.organizationId ?? targetOrganizationId;
    } else {
      const manager = requireOrganizationManager(ctx);
      targetOrganizationId = manager.organizationId;
      if (input.organizationId && input.organizationId !== targetOrganizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot edit another organization.",
        });
      }
    }

    if (!targetOrganizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Select an organization to update.",
      });
    }

    const nextName = input.name.trim();
    if (!nextName) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Organization name cannot be empty.",
      });
    }

    const nextDomain = sanitizeOptional(input.domain)?.toLowerCase() ?? null;
    const nextTimezone = sanitizeOptional(input.timezone);
    const nextLocale = sanitizeOptional(input.locale);
    const nextLogo = sanitizeOptional(input.logoUrl);

    if (!nextLogo) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Organization logo is required.",
      });
    }

    try {
      const updated = await ctx.prisma.organization.update({
        where: { id: targetOrganizationId },
        data: {
          name: nextName,
          domain: nextDomain,
          timezone: nextTimezone ?? null,
          locale: nextLocale ?? null,
          logoUrl: nextLogo,
        },
        select: {
          id: true,
          name: true,
          domain: true,
          timezone: true,
          locale: true,
          logoUrl: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { users: true },
          },
        },
      });

      return { organization: mapOrganizationRecord(updated) };
    } catch (error) {
      return handlePrismaError(error);
    }
  },

  async addAdmin(ctx: TRPCContext, userId: string) {
    const sessionUser = requireOrganizationManager(ctx);
    const organizationId = sessionUser.organizationId;

    const target = await ctx.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!target) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found in this organization.",
      });
    }

    if (target.role === "ORG_OWNER" || target.role === "SUPER_ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You cannot change this role to Org Admin.",
      });
    }

    if (target.role === "ORG_ADMIN") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This employee is already an Org Admin.",
      });
    }

    await ctx.prisma.user.update({
      where: { id: target.id },
      data: { role: "ORG_ADMIN" },
    });

    return { userId: target.id, role: "ORG_ADMIN" as UserRole };
  },

  async removeAdmin(ctx: TRPCContext, userId: string) {
    const sessionUser = requireOrganizationManager(ctx);
    const organizationId = sessionUser.organizationId;

    const target = await ctx.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        role: "ORG_ADMIN",
      },
      select: { id: true },
    });

    if (!target) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Org Admin not found.",
      });
    }

    await ctx.prisma.user.update({
      where: { id: target.id },
      data: { role: "HR_ADMIN" },
    });

    return { userId: target.id, role: "HR_ADMIN" as UserRole };
  },

  async createOrganization(
    ctx: TRPCContext,
    input: {
      name: string;
      domain?: string | null;
      timezone?: string | null;
      locale?: string | null;
      ownerName: string;
      ownerEmail: string;
      ownerPhone?: string | null;
      ownerDesignation?: string | null;
      sendInvite?: boolean;
      logoUrl?: string | null;
    },
  ): Promise<HrCreateOrganizationResponse> {
    const sessionUser = requireSuperAdmin(ctx);

    const organizationName = input.name.trim();
    if (!organizationName) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Organization name is required.",
      });
    }

    const existingCount = await ctx.prisma.organization.count();
    if (existingCount > 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only one organization can exist at a time.",
      });
    }

    const normalizedEmail = normalizeEmail(input.ownerEmail);
    const normalizedPhone = normalizePhoneNumber(input.ownerPhone);
    const ownerDesignation = sanitizeOptional(input.ownerDesignation) ?? "Org Owner";
    const timezone = sanitizeOptional(input.timezone) ?? "Asia/Dhaka";
    const locale = sanitizeOptional(input.locale) ?? "en-US";
    const domain = sanitizeOptional(input.domain)?.toLowerCase() ?? null;
    const logoUrl = sanitizeOptional(input.logoUrl) ?? DEFAULT_ORGANIZATION_LOGO;

    const existingUser = await ctx.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An account already exists for that email.",
      });
    }

    const placeholderPasswordHash = await createPlaceholderPasswordHash();
    const { firstName, lastName } = splitFullName(input.ownerName);
    const employeeCode = generateOwnerEmployeeCode(organizationName);

    try {
      const creation = await ctx.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: organizationName,
            domain,
            timezone,
            locale,
            logoUrl,
          },
        });

        const owner = await tx.user.create({
          data: {
            organizationId: organization.id,
            email: normalizedEmail,
            phone: normalizedPhone,
            passwordHash: placeholderPasswordHash,
            role: "ORG_OWNER",
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
            userId: owner.id,
            firstName,
            lastName,
            preferredName: firstName,
            workEmail: normalizedEmail,
            workPhone: normalizedPhone,
            workModel: WorkModel.HYBRID,
          },
        });

        await tx.employmentDetail.create({
          data: {
            userId: owner.id,
            organizationId: organization.id,
            employeeCode,
            designation: ownerDesignation,
            employmentType: EmploymentType.FULL_TIME,
            status: EmploymentStatus.INACTIVE,
            startDate: new Date(),
            primaryLocation: null,
          },
        });

        await tx.invitationToken.deleteMany({
          where: { userId: owner.id },
        });

        const rawToken = createRandomToken();
        const tokenHash = hashToken(rawToken);
        const expiresAt = addHours(INVITE_TOKEN_TTL_HOURS);

        await tx.invitationToken.create({
          data: {
            userId: owner.id,
            tokenHash,
            expiresAt,
          },
        });

        return {
          organization,
          owner,
          rawToken,
          expiresAt,
        };
      });

      const inviteLink = buildInviteLink(creation.rawToken, normalizedEmail);
      let invitationSent = false;

      if (input.sendInvite ?? true) {
        try {
          const senderDisplayName =
            ctx.session?.user?.profile?.preferredName ??
            ctx.session?.user?.profile?.firstName ??
            ctx.session?.user?.email ??
            sessionUser.email ??
            null;

          invitationSent = await sendInvitationEmail({
            to: normalizedEmail,
            inviteLink,
            organizationName,
            invitedRole: "ORG_OWNER",
            recipientName: firstName,
            expiresAt: creation.expiresAt,
            senderName: senderDisplayName,
          });
        } catch (error) {
          console.error("Failed to send org owner invite:", error);
          invitationSent = false;
        }
      }

      return {
        organizationId: creation.organization.id,
        organizationName,
        ownerId: creation.owner.id,
        ownerEmail: normalizedEmail,
        inviteUrl: inviteLink,
        invitationSent,
      };
    } catch (error) {
      return handlePrismaError(error);
    }
  },

  async deleteOrganization(
    ctx: TRPCContext,
    input: { organizationId: string; password: string },
  ): Promise<HrOrganizationDeleteResponse> {
    const sessionUser = requireSuperAdmin(ctx);

    const authRecord = await ctx.prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { passwordHash: true },
    });

    if (!authRecord?.passwordHash) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Unable to verify your account.",
      });
    }

    const isPasswordValid = await bcrypt.compare(input.password, authRecord.passwordHash);
    if (!isPasswordValid) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Incorrect password. Try again.",
      });
    }

    const organization = await ctx.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found." });
    }

    await ctx.prisma.$transaction(async (tx) => {
      const organizationId = input.organizationId;
      await tx.thread.deleteMany({ where: { organizationId } });
      await tx.notification.deleteMany({ where: { organizationId } });
      await tx.dailyReport.deleteMany({ where: { organizationId } });
      await tx.monthlyReport.deleteMany({ where: { organizationId } });
      await tx.invoice.deleteMany({ where: { organizationId } });
      await tx.project.deleteMany({ where: { organizationId } });
      await tx.holiday.deleteMany({ where: { organizationId } });
      await tx.workPolicy.deleteMany({ where: { organizationId } });
      await tx.team.deleteMany({ where: { organizationId } });
      await tx.department.deleteMany({ where: { organizationId } });
      await tx.employmentDetail.deleteMany({ where: { organizationId } });

      const orgUsers = await tx.user.findMany({
        where: { organizationId },
        select: { id: true },
      });

      for (const orgUser of orgUsers) {
        await deleteUserCascade(tx, orgUser.id);
      }

      await tx.organization.delete({ where: { id: organizationId } });
    });

    return {
      organizationId: input.organizationId,
      message: "Organization deleted.",
    };
  },
};
