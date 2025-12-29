import { Prisma, ProjectStatus, type UserRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import type {
  HrCreateProjectInput,
  HrDeleteProjectResponse,
  HrProjectMember,
  HrProjectOverviewResponse,
  HrProjectSummary,
  HrUpdateProjectInput,
} from "@/types/hr-project";
import { canManageProjects } from "@/types/hr-project";
import { requireProjectManager } from "@/server/modules/hr/utils";

const employmentSelect = {
  userId: true,
  designation: true,
  currentProjectId: true,
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
  if (profile?.preferredName?.trim()) {
    return profile.preferredName.trim();
  }
  const parts = [profile?.firstName, profile?.lastName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (parts.length) {
    return parts.join(" ");
  }
  return fallback?.trim() || "—";
};

const toMember = (
  record: Prisma.EmploymentDetailGetPayload<{ select: typeof employmentSelect }>,
): HrProjectMember => ({
  userId: record.userId,
  fullName: formatFullName(record.user.profile, record.user.email),
  email: record.user.profile?.workEmail ?? record.user.email ?? null,
  designation: record.designation ?? null,
  avatarUrl: record.user.profile?.profilePhotoUrl ?? null,
});

const sanitizeOptional = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseOptionalDate = (label: string, value?: string | null) => {
  const normalized = sanitizeOptional(value);
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${label} must be a valid date.`,
    });
  }
  return parsed;
};

const ensureValidDateRange = (start: Date | null, end: Date | null) => {
  if (start && end && end.getTime() < start.getTime()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "End date can’t be before the start date.",
    });
  }
};

const uniqueIds = (values?: string[]) =>
  Array.from(
    new Set(
      (values ?? [])
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value): value is string => value.length > 0),
    ),
  );

const handleProjectConstraintError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target)
      ? error.meta?.target.join(",")
      : (error.meta?.target as string | undefined);
    if (target?.includes("name")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A project with that name already exists in this organization.",
      });
    }
    if (target?.includes("code")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A project with that code already exists in this organization.",
      });
    }
  }
  throw error;
};

const mapProjectSummary = ({
  project,
  members,
  manager,
}: {
  project: Prisma.ProjectGetPayload<{
    select: {
      id: true;
      name: true;
      code: true;
      description: true;
      clientName: true;
      status: true;
      startDate: true;
      endDate: true;
      projectManager: true;
      createdAt: true;
      updatedAt: true;
    };
  }>;
  members: HrProjectMember[];
  manager: HrProjectMember | null;
}): HrProjectSummary => ({
  id: project.id,
  name: project.name,
  code: project.code ?? null,
  description: project.description ?? null,
  clientName: project.clientName ?? null,
  status: project.status,
  startDateIso: project.startDate ? project.startDate.toISOString() : null,
  endDateIso: project.endDate ? project.endDate.toISOString() : null,
  projectManagerId: project.projectManager ?? null,
  projectManagerName: manager?.fullName ?? null,
  projectManagerEmail: manager?.email ?? null,
  projectManagerAvatarUrl: manager?.avatarUrl ?? null,
  memberCount: members.length,
  memberUserIds: members.map((member) => member.userId),
  memberPreview: members.slice(0, 4),
  createdAtIso: project.createdAt.toISOString(),
  updatedAtIso: project.updatedAt.toISOString(),
});

const assertOrganizationContext = (organizationId?: string | null) => {
  if (!organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Join an organization to manage projects.",
    });
  }
};

const ensureMembersBelongToOrg = async (
  ctx: TRPCContext,
  organizationId: string,
  userIds: string[],
) => {
  if (!userIds.length) {
    return;
  }
  const validMembers = await ctx.prisma.employmentDetail.findMany({
    where: {
      organizationId,
      userId: { in: userIds },
    },
    select: { userId: true },
  });
  if (validMembers.length !== userIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Select employees that belong to this organization.",
    });
  }
};

const ensureManagerBelongsToOrg = async (
  ctx: TRPCContext,
  organizationId: string,
  userId: string,
) => {
  const manager = await ctx.prisma.employmentDetail.findFirst({
    where: { organizationId, userId },
    select: { userId: true },
  });
  if (!manager) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Select a project manager that belongs to this organization.",
    });
  }
};

const assignMembers = (
  ctx: TRPCContext,
  organizationId: string,
  projectId: string,
  userIds: string[],
) => {
  if (!userIds.length) {
    return Promise.resolve();
  }
  return ctx.prisma.employmentDetail.updateMany({
    where: {
      organizationId,
      userId: { in: userIds },
    },
    data: {
      currentProjectId: projectId,
      currentProjectNote: null,
    },
  });
};

export const hrProjectService = {
  async overview(ctx: TRPCContext): Promise<HrProjectOverviewResponse> {
    const viewer = requireProjectManager(ctx);
    const organizationId = viewer.organizationId;
    assertOrganizationContext(organizationId);

    const [projectRecords, employmentRecords] = await Promise.all([
      ctx.prisma.project.findMany({
        where: { organizationId: organizationId! },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          clientName: true,
          status: true,
          startDate: true,
          endDate: true,
          projectManager: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      ctx.prisma.employmentDetail.findMany({
        where: { organizationId: organizationId! },
        select: employmentSelect,
      }),
    ]);

    const employees = employmentRecords
      .map((record) => toMember(record))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const employeeByUserId = new Map<string, HrProjectMember>(
      employees.map((employee) => [employee.userId, employee]),
    );

    const membersByProject = new Map<string, HrProjectMember[]>();
    for (const record of employmentRecords) {
      if (!record.currentProjectId) continue;
      const member = employeeByUserId.get(record.userId);
      if (!member) continue;
      const members = membersByProject.get(record.currentProjectId) ?? [];
      members.push(member);
      membersByProject.set(record.currentProjectId, members);
    }

    const projects: HrProjectSummary[] = projectRecords.map((project) => {
      const members = membersByProject.get(project.id) ?? [];
      const manager = project.projectManager
        ? employeeByUserId.get(project.projectManager) ?? null
        : null;
      return mapProjectSummary({ project, members, manager });
    });

    return {
      viewerRole: viewer.role as UserRole,
      canManage: canManageProjects(viewer.role as UserRole),
      projects,
      employees,
    };
  },

  async createProject(ctx: TRPCContext, input: HrCreateProjectInput) {
    const user = requireProjectManager(ctx);
    const organizationId = user.organizationId;
    assertOrganizationContext(organizationId);

    const name = input.name?.trim();
    if (!name) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Project name is required." });
    }

    const code = sanitizeOptional(input.code);
    const description = sanitizeOptional(input.description);
    const clientName = sanitizeOptional(input.clientName);
    const status = input.status ?? ProjectStatus.ACTIVE;
    const startDate = parseOptionalDate("Start date", input.startDate);
    const endDate = parseOptionalDate("End date", input.endDate);
    ensureValidDateRange(startDate, endDate);

    const uniqueMembers = uniqueIds(input.memberUserIds);
    if (uniqueMembers.length) {
      await ensureMembersBelongToOrg(ctx, organizationId!, uniqueMembers);
    }

    const managerInput = sanitizeOptional(input.projectManagerId);
    const managerId = managerInput ?? null;
    if (managerInput) {
      await ensureManagerBelongsToOrg(ctx, organizationId!, managerInput);
    }

    try {
      const project = await ctx.prisma.project.create({
        data: {
          organizationId: organizationId!,
          name,
          code,
          description,
          clientName,
          status,
          startDate,
          endDate,
          projectManager: managerId,
        },
      });

      if (uniqueMembers.length) {
        await assignMembers(ctx, organizationId!, project.id, uniqueMembers);
      }

      return { projectId: project.id };
    } catch (error) {
      handleProjectConstraintError(error);
    }
  },

  async updateProject(ctx: TRPCContext, input: HrUpdateProjectInput) {
    const user = requireProjectManager(ctx);
    const organizationId = user.organizationId;
    assertOrganizationContext(organizationId);

    const project = await ctx.prisma.project.findFirst({
      where: { id: input.projectId, organizationId: organizationId! },
      select: { id: true },
    });

    if (!project) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
    }

    const name = input.name?.trim();
    if (!name) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Project name is required." });
    }

    const code = sanitizeOptional(input.code);
    const description = sanitizeOptional(input.description);
    const clientName = sanitizeOptional(input.clientName);
    const status = input.status ?? ProjectStatus.ACTIVE;
    const startDate = parseOptionalDate("Start date", input.startDate);
    const endDate = parseOptionalDate("End date", input.endDate);
    ensureValidDateRange(startDate, endDate);

    const uniqueMembers = uniqueIds(input.memberUserIds);
    if (uniqueMembers.length) {
      await ensureMembersBelongToOrg(ctx, organizationId!, uniqueMembers);
    }

    const managerInput = sanitizeOptional(input.projectManagerId);
    const managerId = managerInput ?? null;
    if (managerInput) {
      await ensureManagerBelongsToOrg(ctx, organizationId!, managerInput);
    }

    const existingMembers = await ctx.prisma.employmentDetail.findMany({
      where: { organizationId: organizationId!, currentProjectId: project.id },
      select: { userId: true },
    });

    const existingIds = existingMembers.map((member) => member.userId);
    const desiredSet = new Set(uniqueMembers);
    const existingSet = new Set(existingIds);

    const toRemove = existingIds.filter((userId) => !desiredSet.has(userId));
    const toAdd = uniqueMembers.filter((userId) => !existingSet.has(userId));

    try {
      await ctx.prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: project.id },
          data: {
            name,
            code,
            description,
            clientName,
            status,
            startDate,
            endDate,
            projectManager: managerId,
          },
        });

        if (toRemove.length) {
          await tx.employmentDetail.updateMany({
            where: {
              organizationId: organizationId!,
              userId: { in: toRemove },
              currentProjectId: project.id,
            },
            data: {
              currentProjectId: null,
              currentProjectNote: null,
            },
          });
        }

        if (toAdd.length) {
          await tx.employmentDetail.updateMany({
            where: {
              organizationId: organizationId!,
              userId: { in: toAdd },
            },
            data: {
              currentProjectId: project.id,
              currentProjectNote: null,
            },
          });
        }
      });
    } catch (error) {
      handleProjectConstraintError(error);
    }
  },

  async deleteProject(
    ctx: TRPCContext,
    input: { projectId: string },
  ): Promise<HrDeleteProjectResponse> {
    const user = requireProjectManager(ctx);
    const organizationId = user.organizationId;
    assertOrganizationContext(organizationId);

    const project = await ctx.prisma.project.findFirst({
      where: { id: input.projectId, organizationId: organizationId! },
      select: { id: true },
    });

    if (!project) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
    }

    await ctx.prisma.$transaction(async (tx) => {
      await tx.employmentDetail.updateMany({
        where: {
          organizationId: organizationId!,
          currentProjectId: project.id,
        },
        data: {
          currentProjectId: null,
          currentProjectNote: null,
        },
      });

      await tx.project.delete({
        where: { id: project.id },
      });
    });

    return {
      projectId: project.id,
      message: "Project deleted successfully.",
    };
  },
};
