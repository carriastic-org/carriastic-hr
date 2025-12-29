import {
  EmploymentStatus,
  EmploymentType,
  LeaveStatus,
  type Prisma,
  WorkModel,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { prisma } from "@/server/db";
import { leaveTypeLabelMap } from "@/lib/leave-types";
import { decimalToNumber } from "@/server/modules/leave/leave.shared";
import type {
  MyTeamOverviewResponse,
  TeamMemberSummary,
  TeamPersonSummary,
  TeamUpcomingLeave,
} from "@/types/team";

type TeamOverviewInput = {
  userId: string;
  timezone: string | null;
};

const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  [EmploymentStatus.ACTIVE]: "Active",
  [EmploymentStatus.PROBATION]: "Probation",
  [EmploymentStatus.SABBATICAL]: "On leave",
  [EmploymentStatus.INACTIVE]: "Inactive",
  [EmploymentStatus.TERMINATED]: "Former",
};

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  [EmploymentType.FULL_TIME]: "Full-time",
  [EmploymentType.PART_TIME]: "Part-time",
  [EmploymentType.CONTRACT]: "Contract",
  [EmploymentType.INTERN]: "Intern",
};

const WORK_MODEL_LABELS: Record<WorkModel, string> = {
  [WorkModel.ONSITE]: "On-site",
  [WorkModel.HYBRID]: "Hybrid",
  [WorkModel.REMOTE]: "Remote",
};

const WORK_MODEL_ACCENTS: Record<WorkModel, string> = {
  [WorkModel.ONSITE]: "from-amber-500 via-amber-400 to-amber-500",
  [WorkModel.HYBRID]: "from-sky-500 via-sky-400 to-sky-500",
  [WorkModel.REMOTE]: "from-emerald-500 via-emerald-400 to-emerald-500",
};

const ACTIVE_EMPLOYMENT_STATUSES = new Set<EmploymentStatus>([
  EmploymentStatus.ACTIVE,
  EmploymentStatus.PROBATION,
  EmploymentStatus.SABBATICAL,
]);

const UPCOMING_ANNIVERSARY_WINDOW_DAYS = 60;
const NEW_JOINER_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const formatFullName = (profile?: {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}) => {
  if (!profile) {
    return "—";
  }
  if (profile.preferredName) {
    return profile.preferredName;
  }
  return [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "—";
};

const computeTenureMonths = (startDate: Date | null) => {
  if (!startDate) {
    return 0;
  }
  const now = new Date();
  const years = now.getFullYear() - startDate.getFullYear();
  const months = now.getMonth() - startDate.getMonth();
  const totalMonths = years * 12 + months;
  return totalMonths < 0 ? 0 : totalMonths;
};

const formatTenureLabel = (totalMonths: number) => {
  if (totalMonths <= 0) {
    return "New teammate";
  }
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];
  if (years > 0) {
    parts.push(`${years} yr${years > 1 ? "s" : ""}`);
  }
  if (months > 0) {
    parts.push(`${months} mo${months > 1 ? "s" : ""}`);
  }
  return parts.join(" ") || "New teammate";
};

const buildPersonSummary = (input: {
  id: string;
  email: string | null;
  profile: {
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
    profilePhotoUrl: string | null;
    workEmail: string | null;
    workModel: WorkModel | null;
  } | null;
  employment?: {
    designation: string;
    isTeamLead?: boolean | null;
  } | null;
} | null): TeamPersonSummary | null => {
  if (!input) {
    return null;
  }
  return {
    id: input.id,
    fullName: formatFullName(input.profile ?? undefined),
    preferredName: input.profile?.preferredName ?? null,
    avatarUrl: input.profile?.profilePhotoUrl ?? null,
    designation: input.employment?.designation ?? null,
    email: input.profile?.workEmail ?? input.email ?? null,
    workModel: input.profile?.workModel ?? null,
    isTeamLead: Boolean(input.employment?.isTeamLead),
  };
};

const toMemberSummary = (
  record: Prisma.EmploymentDetailGetPayload<{
    select: typeof memberSelect;
  }>,
): TeamMemberSummary => {
  const profile = record.user.profile;
  const fullName = formatFullName(profile ?? undefined);
  const workModel = profile?.workModel ?? null;
  const workModelLabel = workModel ? WORK_MODEL_LABELS[workModel] : "Not set";
  const tenureMonths = computeTenureMonths(record.startDate);
  return {
    id: record.id,
    userId: record.userId,
    fullName,
    preferredName: profile?.preferredName ?? null,
    avatarUrl: profile?.profilePhotoUrl ?? null,
    designation: record.designation,
    employmentType: record.employmentType,
    employmentTypeLabel: EMPLOYMENT_TYPE_LABELS[record.employmentType],
    status: record.status,
    statusLabel: EMPLOYMENT_STATUS_LABELS[record.status],
    workModel,
    workModelLabel,
    location: record.primaryLocation ?? profile?.currentAddress ?? null,
    email: profile?.workEmail ?? record.user.email ?? null,
    phone: record.user.phone ?? profile?.workPhone ?? null,
    startDate: record.startDate ? record.startDate.toISOString() : null,
    startDateLabel: record.startDate ? dateFormatter.format(record.startDate) : null,
    tenureMonths,
    tenureLabel: formatTenureLabel(tenureMonths),
    isTeamLead: record.isTeamLead ?? false,
  };
};

const nextAnniversary = (startDate: Date | null) => {
  if (!startDate) {
    return null;
  }
  const today = new Date();
  const candidate = new Date(today.getFullYear(), startDate.getMonth(), startDate.getDate());
  if (candidate < today) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  const yearsCompleted = candidate.getFullYear() - startDate.getFullYear();
  const daysAway = Math.ceil((candidate.getTime() - today.getTime()) / DAY_MS);
  return {
    date: candidate,
    yearsCompleted,
    daysAway,
  };
};

const statusLabelMap: Record<LeaveStatus, string> = {
  [LeaveStatus.DRAFT]: "Draft",
  [LeaveStatus.PENDING]: "Pending",
  [LeaveStatus.PROCESSING]: "Processing",
  [LeaveStatus.APPROVED]: "Approved",
  [LeaveStatus.DENIED]: "Denied",
  [LeaveStatus.CANCELLED]: "Cancelled",
};

const memberSelect = {
  id: true,
  userId: true,
  designation: true,
  employmentType: true,
  status: true,
  startDate: true,
  primaryLocation: true,
  isTeamLead: true,
  user: {
    select: {
      id: true,
      email: true,
      phone: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          preferredName: true,
          profilePhotoUrl: true,
          workEmail: true,
          workPhone: true,
          workModel: true,
          currentAddress: true,
        },
      },
    },
  },
} as const satisfies Prisma.EmploymentDetailSelect;

export const teamService = {
  async overview({ userId, timezone }: TeamOverviewInput): Promise<MyTeamOverviewResponse> {
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const employment = await prisma.employmentDetail.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        primaryLocation: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            department: {
              select: {
                name: true,
                head: {
                  select: {
                    id: true,
                    email: true,
                    profile: {
                      select: {
                        firstName: true,
                        lastName: true,
                        preferredName: true,
                        profilePhotoUrl: true,
                        workEmail: true,
                        workModel: true,
                      },
                    },
                    employment: {
                      select: {
                        designation: true,
                        isTeamLead: true,
                      },
                    },
                  },
                },
              },
            },
            leads: {
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
                        profilePhotoUrl: true,
                        workEmail: true,
                        workModel: true,
                      },
                    },
                    employment: {
                      select: {
                        designation: true,
                        isTeamLead: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        manager: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                preferredName: true,
                profilePhotoUrl: true,
                workEmail: true,
                workModel: true,
              },
            },
            employment: {
              select: {
                designation: true,
                isTeamLead: true,
              },
            },
          },
        },
      },
    });

    if (!employment || !employment.teamId || !employment.team) {
      return {
        hasTeam: false,
        timezone,
        team: null,
        stats: {
          headcount: 0,
          active: 0,
          avgTenureMonths: 0,
          avgTenureLabel: "—",
        },
        highlights: [],
        workModelStats: [],
        members: [],
        newJoiners: [],
        anniversaries: [],
        upcomingLeaves: [],
      };
    }

    const teamId = employment.teamId;
    const organizationId = employment.organizationId;

    const members = await prisma.employmentDetail.findMany({
      where: {
        organizationId,
        teamId,
      },
      select: memberSelect,
      orderBy: {
        startDate: "asc",
      },
    });

    const memberSummaries = members.map(toMemberSummary);
    const headcount = memberSummaries.length;
    const active = memberSummaries.filter((member) =>
      ACTIVE_EMPLOYMENT_STATUSES.has(member.status),
    ).length;
    const avgTenureMonths =
      headcount === 0
        ? 0
        : Math.round(
            memberSummaries.reduce((total, member) => total + member.tenureMonths, 0) / headcount,
          );
    const avgTenureLabel = formatTenureLabel(avgTenureMonths);

    const workModelStats = [WorkModel.ONSITE, WorkModel.HYBRID, WorkModel.REMOTE].map(
      (model) => {
        const count = memberSummaries.filter((member) => member.workModel === model).length;
        const percentage = headcount ? Math.round((count / headcount) * 100) : 0;
        return {
          id: model.toLowerCase(),
          label: WORK_MODEL_LABELS[model],
          count,
          percentage,
          accent: WORK_MODEL_ACCENTS[model],
          helper: count === 1 ? "1 teammate" : `${count} teammates`,
        };
      },
    );

    const uniqueLocations = new Map<string, number>();
    memberSummaries.forEach((member) => {
      if (!member.location) return;
      uniqueLocations.set(member.location, (uniqueLocations.get(member.location) ?? 0) + 1);
    });
    const topLocation = Array.from(uniqueLocations.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];

    const earliestStartDate =
      members.reduce<Date | null>((earliest, record) => {
        if (!record.startDate) return earliest;
        if (!earliest || record.startDate < earliest) {
          return record.startDate;
        }
        return earliest;
      }, null) ?? null;

    const highlights = [
      {
        id: "headcount",
        label: "Headcount",
        value: `${headcount || 0} teammate${headcount === 1 ? "" : "s"}`,
        helper:
          headcount === 0
            ? "No active members yet"
            : `${active} active · ${headcount - active} pending`,
      },
      {
        id: "tenure",
        label: "Average tenure",
        value: avgTenureLabel,
        helper: earliestStartDate
          ? `Since ${monthYearFormatter.format(earliestStartDate)}`
          : "Start dates not recorded",
      },
      {
        id: "locations",
        label: "Locations",
        value: uniqueLocations.size ? `${uniqueLocations.size}` : "0",
        helper: uniqueLocations.size
          ? `${uniqueLocations.size === 1 ? "Single" : "Multiple"} work hubs`
          : "Location data pending",
      },
    ];

    const today = new Date();
    const newJoinerThreshold = new Date(today.getTime() - NEW_JOINER_WINDOW_DAYS * DAY_MS);
    const newJoiners = memberSummaries
      .filter((member) => {
        if (!member.startDate) return false;
        const startDate = new Date(member.startDate);
        return startDate >= newJoinerThreshold;
      })
      .slice(0, 6);

    const anniversaries = memberSummaries
      .map((member) => {
        if (!member.startDate) return null;
        const startDate = new Date(member.startDate);
        const next = nextAnniversary(startDate);
        if (!next || next.daysAway > UPCOMING_ANNIVERSARY_WINDOW_DAYS) {
          return null;
        }
        return {
          id: `${member.id}-${next.date.toISOString()}`,
          memberId: member.id,
          memberName: member.fullName,
          dateIso: next.date.toISOString(),
          dateLabel: weekdayFormatter.format(next.date),
          yearsCompleted: next.yearsCompleted,
          daysAway: next.daysAway,
        };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((a, b) => a.daysAway - b.daysAway)
      .slice(0, 5);

    const memberIdByUserId = new Map(members.map((record) => [record.userId, record.id]));
    const memberNameByUserId = new Map(
      memberSummaries.map((member) => [member.userId, member.fullName]),
    );
    const memberUserIds = members.map((record) => record.userId);

    const upcomingLeaves = memberUserIds.length
      ? await prisma.leaveRequest.findMany({
          where: {
            employeeId: {
              in: memberUserIds,
            },
            status: {
              in: [LeaveStatus.PENDING, LeaveStatus.PROCESSING, LeaveStatus.APPROVED],
            },
            endDate: {
              gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            },
          },
          select: {
            id: true,
            employeeId: true,
            leaveType: true,
            status: true,
            startDate: true,
            endDate: true,
            totalDays: true,
          },
          orderBy: {
            startDate: "asc",
          },
          take: 6,
        })
      : [];

    const formattedUpcomingLeaves: TeamUpcomingLeave[] = upcomingLeaves
      .map((leave) => {
        const memberId = memberIdByUserId.get(leave.employeeId);
        const memberName = memberNameByUserId.get(leave.employeeId);
        if (!memberId || !memberName) {
          return null;
        }
        const startLabel = weekdayFormatter.format(leave.startDate);
        const endLabel = weekdayFormatter.format(leave.endDate);
        const rangeLabel =
          leave.startDate.toDateString() === leave.endDate.toDateString()
            ? startLabel
            : `${startLabel} → ${endLabel}`;
        const statusLabel = statusLabelMap[leave.status];
        const totalDays = decimalToNumber(leave.totalDays);
        const durationLabel =
          totalDays > 0 ? `${totalDays} day${totalDays > 1 ? "s" : ""}` : "—";
        return {
          id: leave.id,
          memberId,
          memberName,
          leaveType: leave.leaveType,
          leaveTypeLabel: leaveTypeLabelMap[leave.leaveType],
          status: leave.status,
          statusLabel,
          startDate: leave.startDate.toISOString(),
          endDate: leave.endDate.toISOString(),
          rangeLabel,
          helper: `${durationLabel} • ${statusLabel}`,
        };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value));

    const leadPeople = employment.team.leads
      .map((entry) => buildPersonSummary(entry.lead ?? null))
      .filter((lead): lead is NonNullable<typeof lead> => Boolean(lead));
    const departmentManager = buildPersonSummary(
      employment.team.department?.head ?? null,
    );
    const reportingManager = buildPersonSummary(employment.manager);

    return {
      hasTeam: true,
      timezone,
      team: {
        id: employment.team.id,
        name: employment.team.name,
        description: employment.team.description ?? null,
        departmentName: employment.team.department?.name ?? null,
        leads: leadPeople,
        manager: departmentManager ?? reportingManager,
        locationHint: topLocation ?? employment.primaryLocation ?? null,
      },
      stats: {
        headcount,
        active,
        avgTenureMonths,
        avgTenureLabel,
      },
      highlights,
      workModelStats,
      members: memberSummaries,
      newJoiners,
      anniversaries,
      upcomingLeaves: formattedUpcomingLeaves,
    };
  },
};
