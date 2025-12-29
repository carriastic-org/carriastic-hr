import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import {
  type HrAssignTeamLeadInput,
  type HrAssignTeamMembersInput,
  type HrCreateTeamInput,
  type HrTeamManagementResponse,
  type HrTeamPerson,
  canManageTeams,
} from "@/types/hr-team";
import { requireHrAdmin, requireTeamManager } from "@/server/modules/hr/utils";

const personSelect = {
  userId: true,
  designation: true,
  isTeamLead: true,
  teamId: true,
  team: {
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
          profilePhotoUrl: true,
          workEmail: true,
        },
      },
    },
  },
} as const;

const leadSelect = {
  id: true,
  email: true,
  employment: {
    select: {
      designation: true,
      teamId: true,
      isTeamLead: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  profile: {
    select: {
      firstName: true,
      lastName: true,
      preferredName: true,
      profilePhotoUrl: true,
      workEmail: true,
    },
  },
} as const;

const formatFullName = (input?: {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}) => {
  if (!input) {
    return "—";
  }
  if (input.preferredName && input.preferredName.trim().length > 0) {
    return input.preferredName.trim();
  }
  const parts = [input.firstName, input.lastName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.length > 0));
  if (!parts.length) {
    return "—";
  }
  return parts.join(" ");
};

const buildPersonFromEmployment = (
  record: {
    userId: string;
    designation: string | null;
    isTeamLead: boolean;
    teamId: string | null;
    team: { id: string; name: string } | null;
    user: {
      email: string;
      profile: {
        firstName: string | null;
        lastName: string | null;
        preferredName: string | null;
        profilePhotoUrl: string | null;
        workEmail: string | null;
      } | null;
    };
  } | null,
): HrTeamPerson | null => {
  if (!record) {
    return null;
  }
  const profile = record.user.profile ?? undefined;
  return {
    userId: record.userId,
    fullName: formatFullName(profile),
    designation: record.designation,
    email: profile?.workEmail ?? record.user.email ?? null,
    avatarUrl: profile?.profilePhotoUrl ?? null,
    teamId: record.team?.id ?? record.teamId ?? null,
    teamName: record.team?.name ?? null,
    isTeamLead: record.isTeamLead ?? false,
  };
};

const buildPersonFromUser = (
  user: {
    id: string;
    email: string;
    profile: {
      firstName: string | null;
      lastName: string | null;
      preferredName: string | null;
      profilePhotoUrl: string | null;
      workEmail: string | null;
    } | null;
    employment: {
      designation: string | null;
      teamId: string | null;
      isTeamLead: boolean | null;
      team: { id: string; name: string } | null;
    } | null;
  } | null,
): HrTeamPerson | null => {
  if (!user) {
    return null;
  }
  const profile = user.profile ?? undefined;
  return {
    userId: user.id,
    fullName: formatFullName(profile),
    designation: user.employment?.designation ?? null,
    email: profile?.workEmail ?? user.email ?? null,
    avatarUrl: profile?.profilePhotoUrl ?? null,
    teamId: user.employment?.team?.id ?? user.employment?.teamId ?? null,
    teamName: user.employment?.team?.name ?? null,
    isTeamLead: Boolean(user.employment?.isTeamLead),
  };
};

export const hrTeamService = {
  async overview(ctx: TRPCContext): Promise<HrTeamManagementResponse> {
    const viewer = requireHrAdmin(ctx);
    const organizationId = viewer.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Join an organization to view teams.",
      });
    }

    const canManage = canManageTeams(viewer.role);

    const [departments, employeeRecords, teamRecords] = await Promise.all([
      ctx.prisma.department.findMany({
        where: { organizationId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      ctx.prisma.employmentDetail.findMany({
        where: { organizationId },
        select: personSelect,
      }),
      ctx.prisma.team.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          description: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          leads: {
            select: {
              lead: {
                select: leadSelect,
              },
            },
          },
          primaryMembers: {
            select: personSelect,
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const employees = employeeRecords
      .map((record) => buildPersonFromEmployment(record))
      .filter((person): person is HrTeamPerson => Boolean(person))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const personByUserId = new Map(employees.map((person) => [person.userId, person]));

    const teams = teamRecords.map((team) => {
      const leadPeople = team.leads
        .map((entry) => buildPersonFromUser(entry.lead))
        .filter((lead): lead is HrTeamPerson => Boolean(lead));
      const members = team.primaryMembers
        .map((member) => personByUserId.get(member.userId) ?? buildPersonFromEmployment(member))
        .filter((member): member is HrTeamPerson => Boolean(member));
      return {
        id: team.id,
        name: team.name,
        description: team.description ?? null,
        departmentId: team.departmentId,
        departmentName: team.department?.name ?? "—",
        leads: leadPeople,
        leadUserIds: leadPeople.map((lead) => lead.userId),
        memberUserIds: members.map((member) => member.userId),
        memberCount: members.length,
        memberPreview: members.slice(0, 4),
      };
    });

    return {
      viewerRole: viewer.role,
      canManage,
      departments,
      employees,
      teams,
    };
  },

  async createTeam(ctx: TRPCContext, input: HrCreateTeamInput) {
    const user = requireTeamManager(ctx);
    const organizationId = user.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Join an organization to manage teams.",
      });
    }

    const name = input.name.trim();
    if (!name) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Team name is required." });
    }

    const department = await ctx.prisma.department.findFirst({
      where: { id: input.departmentId, organizationId },
      select: { id: true },
    });

    if (!department) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Select a valid department for this organization.",
      });
    }

    await ctx.prisma.team.create({
      data: {
        organizationId,
        departmentId: department.id,
        name,
        description: input.description?.trim() ? input.description.trim() : null,
      },
    });
  },

  async assignLead(ctx: TRPCContext, input: HrAssignTeamLeadInput) {
    const user = requireTeamManager(ctx);
    const organizationId = user.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Join an organization to manage teams.",
      });
    }

    const team = await ctx.prisma.team.findFirst({
      where: { id: input.teamId, organizationId },
      select: { id: true, leads: { select: { leadId: true } } },
    });

    if (!team) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
    }

    const uniqueLeadIds = Array.from(
      new Set(input.leadUserIds.filter((value): value is string => Boolean(value))),
    );

    if (uniqueLeadIds.length) {
      const validLeads = await ctx.prisma.employmentDetail.findMany({
        where: {
          organizationId,
          userId: { in: uniqueLeadIds },
        },
        select: { userId: true },
      });

      if (validLeads.length !== uniqueLeadIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Select valid teammates from this organization.",
        });
      }
    }

    const existingLeadIds = team.leads.map((lead) => lead.leadId);
    const desiredSet = new Set(uniqueLeadIds);
    const toRemove = existingLeadIds.filter((leadId) => !desiredSet.has(leadId));
    const toAdd = uniqueLeadIds.filter((leadId) => !existingLeadIds.includes(leadId));

    await ctx.prisma.$transaction(async (tx) => {
      if (toRemove.length) {
        await tx.teamLead.deleteMany({
          where: {
            teamId: team.id,
            leadId: { in: toRemove },
          },
        });
      }

      for (const leadId of toAdd) {
        await tx.teamLead.create({
          data: {
            teamId: team.id,
            leadId,
          },
        });
      }

      if (uniqueLeadIds.length) {
        await tx.employmentDetail.updateMany({
          where: {
            organizationId,
            userId: { in: uniqueLeadIds },
          },
          data: { teamId: team.id, isTeamLead: true },
        });
      }

      if (toRemove.length) {
        const stillLeads = await tx.teamLead.findMany({
          where: { leadId: { in: toRemove } },
          select: { leadId: true },
        });
        const stillLeadIds = new Set(stillLeads.map((entry) => entry.leadId));
        const toUnset = toRemove.filter((leadId) => !stillLeadIds.has(leadId));
        if (toUnset.length) {
          await tx.employmentDetail.updateMany({
            where: {
              organizationId,
              userId: { in: toUnset },
            },
            data: { isTeamLead: false },
          });
        }
      }
    });
  },

  async assignMembers(ctx: TRPCContext, input: HrAssignTeamMembersInput) {
    const user = requireTeamManager(ctx);
    const organizationId = user.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Join an organization to manage teams.",
      });
    }

    const team = await ctx.prisma.team.findFirst({
      where: { id: input.teamId, organizationId },
      select: { id: true, leads: { select: { leadId: true } } },
    });

    if (!team) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
    }

    const uniqueMemberIds = Array.from(new Set(input.memberUserIds.filter(Boolean)));
    const enforcedLeadIds = team.leads.map((lead) => lead.leadId);
    for (const leadId of enforcedLeadIds) {
      if (!uniqueMemberIds.includes(leadId)) {
        uniqueMemberIds.push(leadId);
      }
    }

    if (uniqueMemberIds.length) {
      const validMembers = await ctx.prisma.employmentDetail.findMany({
        where: {
          userId: { in: uniqueMemberIds },
        },
        select: {
          userId: true,
          organizationId: true,
        },
      });

      if (validMembers.length !== uniqueMemberIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All members must belong to this organization.",
        });
      }

      const outsider = validMembers.find((member) => member.organizationId !== organizationId);
      if (outsider) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All members must belong to this organization.",
        });
      }
    }

    const existingMembers = await ctx.prisma.employmentDetail.findMany({
      where: { organizationId, teamId: team.id },
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
            teamId: team.id,
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
            teamId: null,
          },
        });
      }
    });
  },
};
