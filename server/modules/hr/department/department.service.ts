import { Prisma, type UserRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import {
  type HrAssignDepartmentHeadInput,
  type HrAssignDepartmentMembersInput,
  type HrCreateDepartmentInput,
  type HrDepartmentManagementResponse,
  type HrDepartmentPerson,
  type HrUpdateDepartmentInput,
  canManageDepartments,
} from "@/types/hr-department";
import { requireDepartmentManager } from "@/server/modules/hr/utils";

const employmentSelect = {
  userId: true,
  designation: true,
  departmentId: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
  user: {
    select: {
      email: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          preferredName: true,
          workEmail: true,
          profilePhotoUrl: true,
        },
      },
    },
  },
} as const satisfies Prisma.EmploymentDetailSelect;

const formatFullName = (
  profile?:
    | {
        firstName: string | null;
        lastName: string | null;
        preferredName: string | null;
      }
    | null,
  fallback?: string | null,
) => {
  if (!profile) {
    return fallback?.trim() || "—";
  }
  if (profile.preferredName?.trim()) {
    return profile.preferredName.trim();
  }
  const parts = [profile.firstName, profile.lastName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (!parts.length) {
    return fallback?.trim() || "—";
  }
  return parts.join(" ");
};

const mapEmploymentToPerson = (
  record: Prisma.EmploymentDetailGetPayload<{ select: typeof employmentSelect }>,
): HrDepartmentPerson => ({
  userId: record.userId,
  fullName: formatFullName(record.user.profile, record.user.email),
  email: record.user.profile?.workEmail ?? record.user.email ?? null,
  designation: record.designation ?? null,
  avatarUrl: record.user.profile?.profilePhotoUrl ?? null,
  departmentId: record.department?.id ?? record.departmentId ?? null,
  departmentName: record.department?.name ?? null,
});

const sanitizeOptional = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const handleDepartmentConstraintError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target)
      ? error.meta?.target.join(",")
      : (error.meta?.target as string | undefined);
    if (target?.includes("name")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A department with that name already exists.",
      });
    }
    if (target?.includes("code")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A department with that code already exists.",
      });
    }
  }
  throw error;
};

const getHeadDisplay = (head?: {
  email: string;
  profile: {
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
    profilePhotoUrl: string | null;
  } | null;
} | null) => {
  if (!head) {
    return {
      name: null,
      email: null,
      avatarUrl: null,
    };
  }
  return {
    name: formatFullName(head.profile, head.email) || head.email,
    email: head.email,
    avatarUrl: head.profile?.profilePhotoUrl ?? null,
  };
};

export const hrDepartmentService = {
  async overview(ctx: TRPCContext): Promise<HrDepartmentManagementResponse> {
    const viewer = requireDepartmentManager(ctx);
    const organizationId = viewer.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Join an organization to manage departments.",
      });
    }

    const [departmentRecords, employmentRecords] = await Promise.all([
      ctx.prisma.department.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          headId: true,
          head: {
            select: {
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  preferredName: true,
                  profilePhotoUrl: true,
                },
              },
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      }),
      ctx.prisma.employmentDetail.findMany({
        where: { organizationId },
        select: employmentSelect,
      }),
    ]);

    const employees = employmentRecords
      .map((record) => mapEmploymentToPerson(record))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const membersByDepartment = new Map<string, HrDepartmentPerson[]>();
    for (const person of employees) {
      if (!person.departmentId) continue;
      const members = membersByDepartment.get(person.departmentId) ?? [];
      members.push(person);
      membersByDepartment.set(person.departmentId, members);
    }

    const departments = departmentRecords.map((department) => {
      const members = membersByDepartment.get(department.id) ?? [];
      const headDisplay = getHeadDisplay(department.head);
      return {
        id: department.id,
        name: department.name,
        code: department.code ?? null,
        description: department.description ?? null,
        headUserId: department.headId ?? null,
        headName: headDisplay.name,
        headEmail: headDisplay.email,
        headAvatarUrl: headDisplay.avatarUrl,
        memberCount: members.length,
        memberUserIds: members.map((member) => member.userId),
        memberPreview: members.slice(0, 4),
        createdAtIso: department.createdAt.toISOString(),
        updatedAtIso: department.updatedAt.toISOString(),
      };
    });

    return {
      viewerRole: viewer.role as UserRole,
      canManage: canManageDepartments(viewer.role as UserRole),
      departments,
      employees,
    };
  },

  async createDepartment(ctx: TRPCContext, input: HrCreateDepartmentInput) {
    const viewer = requireDepartmentManager(ctx);
    const organizationId = viewer.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Join an organization to create departments.",
      });
    }

    const name = input.name.trim();
    if (!name) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Department name is required.",
      });
    }

    const code = sanitizeOptional(input.code);
    const description = sanitizeOptional(input.description);

    try {
      await ctx.prisma.department.create({
        data: {
          organizationId,
          name,
          code,
          description,
        },
      });
    } catch (error) {
      handleDepartmentConstraintError(error);
    }
  },

  async updateDepartment(ctx: TRPCContext, input: HrUpdateDepartmentInput) {
    const viewer = requireDepartmentManager(ctx);
    const organizationId = viewer.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Join an organization to update departments.",
      });
    }

    const existing = await ctx.prisma.department.findFirst({
      where: { id: input.departmentId, organizationId },
      select: { id: true },
    });

    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Department not found.",
      });
    }

    const name = input.name.trim();
    if (!name) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Department name cannot be empty.",
      });
    }

    const code = sanitizeOptional(input.code);
    const description = sanitizeOptional(input.description);

    try {
      await ctx.prisma.department.update({
        where: { id: existing.id },
        data: {
          name,
          code,
          description,
        },
      });
    } catch (error) {
      handleDepartmentConstraintError(error);
    }
  },

  async assignHead(ctx: TRPCContext, input: HrAssignDepartmentHeadInput) {
    const viewer = requireDepartmentManager(ctx);
    const organizationId = viewer.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Join an organization to assign department managers.",
      });
    }

    const department = await ctx.prisma.department.findFirst({
      where: { id: input.departmentId, organizationId },
      select: { id: true },
    });

    if (!department) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Department not found.",
      });
    }

    let headId: string | null = null;
    if (input.headUserId) {
      const employment = await ctx.prisma.employmentDetail.findFirst({
        where: {
          userId: input.headUserId,
          organizationId,
        },
        select: { userId: true },
      });
      if (!employment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Select a manager from this organization.",
        });
      }
      headId = employment.userId;
    }

    await ctx.prisma.$transaction(async (tx) => {
      await tx.department.update({
        where: { id: department.id },
        data: {
          headId,
        },
      });

      if (headId) {
        await tx.employmentDetail.updateMany({
          where: {
            organizationId,
            userId: headId,
          },
          data: {
            departmentId: department.id,
          },
        });
      }
    });
  },

  async assignMembers(ctx: TRPCContext, input: HrAssignDepartmentMembersInput) {
    const viewer = requireDepartmentManager(ctx);
    const organizationId = viewer.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Join an organization to update department members.",
      });
    }

    const department = await ctx.prisma.department.findFirst({
      where: { id: input.departmentId, organizationId },
      select: { id: true, headId: true },
    });

    if (!department) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Department not found.",
      });
    }

    const uniqueMemberIds = Array.from(new Set(input.memberUserIds.filter(Boolean)));
    if (department.headId && !uniqueMemberIds.includes(department.headId)) {
      uniqueMemberIds.push(department.headId);
    }

    if (uniqueMemberIds.length) {
      const memberRecords = await ctx.prisma.employmentDetail.findMany({
        where: {
          organizationId,
          userId: { in: uniqueMemberIds },
        },
        select: { userId: true },
      });

      if (memberRecords.length !== uniqueMemberIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All members must belong to this organization.",
        });
      }
    }

    const existingMembers = await ctx.prisma.employmentDetail.findMany({
      where: {
        organizationId,
        departmentId: department.id,
      },
      select: { userId: true },
    });

    const memberSet = new Set(uniqueMemberIds);
    const toRemove = existingMembers
      .filter((member) => !memberSet.has(member.userId))
      .map((member) => member.userId);

    await ctx.prisma.$transaction(async (tx) => {
      if (memberSet.size) {
        await tx.employmentDetail.updateMany({
          where: {
            organizationId,
            userId: { in: Array.from(memberSet) },
          },
          data: {
            departmentId: department.id,
          },
        });
      }

      if (toRemove.length) {
        await tx.employmentDetail.updateMany({
          where: {
            organizationId,
            userId: { in: toRemove },
          },
          data: {
            departmentId: null,
          },
        });
      }
    });
  },
};
