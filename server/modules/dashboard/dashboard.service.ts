import {
  AttendanceStatus,
  LeaveStatus,
  NotificationAudience,
  NotificationStatus,
  Prisma,
  type UserRole,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { prisma } from "@/server/db";
import { leaveTypeLabelMap } from "@/lib/leave-types";
import {
  buildBalanceResponse,
  decimalToNumber,
  employmentBalanceSelect,
  toLeaveTypeValue,
  type EmploymentLeaveBalances,
} from "@/server/modules/leave/leave.shared";
import type {
  DashboardAttendanceSection,
  DashboardAttendanceTrendPoint,
  DashboardHolidaysSection,
  DashboardNotificationsSection,
  DashboardProfileSection,
  DashboardSummarySection,
  DashboardTimeOffSection,
  EmployeeDashboardResponse,
} from "@/types/employee-dashboard";

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 10;

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const workedStatuses = new Set<AttendanceStatus>([
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
  AttendanceStatus.HALF_DAY,
  AttendanceStatus.REMOTE,
]);

const onTimeStatuses = new Set<AttendanceStatus>([
  AttendanceStatus.PRESENT,
  AttendanceStatus.REMOTE,
]);

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (value: Date, delta: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() + delta);
  return date;
};

const formatDateKey = (value: Date) => startOfDay(value).toISOString();

const buildStatusCounts = (): Record<AttendanceStatus, number> => ({
  [AttendanceStatus.PRESENT]: 0,
  [AttendanceStatus.LATE]: 0,
  [AttendanceStatus.HALF_DAY]: 0,
  [AttendanceStatus.ABSENT]: 0,
  [AttendanceStatus.REMOTE]: 0,
  [AttendanceStatus.HOLIDAY]: 0,
});

const minutesToLabel = (totalMinutes: number) => {
  if (!Number.isFinite(totalMinutes)) {
    return null;
  }
  const normalized =
    ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const paddedHour = hour12.toString().padStart(2, "0");
  const paddedMinutes = minutes.toString().padStart(2, "0");
  return `${paddedHour}:${paddedMinutes} ${period}`;
};

const inclusiveOverlapDays = (
  containerStart: Date,
  containerEnd: Date,
  rangeStart: Date,
  rangeEnd: Date,
) => {
  const start = Math.max(startOfDay(containerStart).getTime(), startOfDay(rangeStart).getTime());
  const end = Math.min(startOfDay(containerEnd).getTime(), startOfDay(rangeEnd).getTime());
  if (end < start) {
    return 0;
  }
  return Math.floor((end - start) / DAY_MS) + 1;
};

const employmentSelect = {
  ...employmentBalanceSelect,
  employeeCode: true,
  designation: true,
  employmentType: true,
  status: true,
  startDate: true,
  primaryLocation: true,
  currentProjectNote: true,
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
  currentProject: {
    select: {
      name: true,
    },
  },
} as const satisfies Prisma.EmploymentDetailSelect;

const userDashboardSelect = {
  id: true,
  email: true,
  phone: true,
  role: true,
  organization: {
    select: {
      name: true,
    },
  },
  profile: {
    select: {
      firstName: true,
      lastName: true,
      preferredName: true,
      profilePhotoUrl: true,
      gender: true,
      workModel: true,
      dateOfBirth: true,
      nationality: true,
      currentAddress: true,
      permanentAddress: true,
      workEmail: true,
      personalEmail: true,
      workPhone: true,
      personalPhone: true,
    },
  },
  employment: {
    select: employmentSelect,
  },
} as const satisfies Prisma.UserSelect;

const attendanceRecordSelect = {
  attendanceDate: true,
  status: true,
  totalWorkSeconds: true,
  checkInAt: true,
  checkOutAt: true,
} as const satisfies Prisma.AttendanceRecordSelect;

const leaveRequestSelect = {
  id: true,
  leaveType: true,
  status: true,
  startDate: true,
  endDate: true,
  totalDays: true,
} as const satisfies Prisma.LeaveRequestSelect;

const notificationBaseSelect = {
  id: true,
  title: true,
  body: true,
  type: true,
  status: true,
  actionUrl: true,
  sentAt: true,
  scheduledAt: true,
  createdAt: true,
} as const satisfies Prisma.NotificationSelect;

const buildNotificationSelect = (userId: string) =>
  ({
    ...notificationBaseSelect,
    receipts: {
      where: { userId },
      select: { isSeen: true },
      take: 1,
    },
  }) as const satisfies Prisma.NotificationSelect;

const holidaySelect = {
  id: true,
  title: true,
  description: true,
  date: true,
} as const satisfies Prisma.HolidaySelect;

const workPolicySelect = {
  onsiteStartTime: true,
  onsiteEndTime: true,
  remoteStartTime: true,
  remoteEndTime: true,
} as const satisfies Prisma.WorkPolicySelect;

const notificationStatusesForDashboard: NotificationStatus[] = [
  NotificationStatus.SENT,
  NotificationStatus.SCHEDULED,
];

const buildNotificationAudienceFilter = (userId: string, role: UserRole) => ({
  OR: [
    { audience: NotificationAudience.ORGANIZATION },
    {
      audience: NotificationAudience.ROLE,
      targetRoles: {
        has: role,
      },
    },
    {
      audience: NotificationAudience.INDIVIDUAL,
      targetUserId: userId,
    },
  ],
});

type AttendanceRecordForDashboard = Prisma.AttendanceRecordGetPayload<{
  select: typeof attendanceRecordSelect;
}>;

type LeaveRequestForDashboard = Prisma.LeaveRequestGetPayload<{
  select: typeof leaveRequestSelect;
}>;

type NotificationForDashboard = Prisma.NotificationGetPayload<{
  select: ReturnType<typeof buildNotificationSelect>;
}>;

type HolidayForDashboard = Prisma.HolidayGetPayload<{
  select: typeof holidaySelect;
}>;

type WorkPolicyForDashboard = Prisma.WorkPolicyGetPayload<{
  select: typeof workPolicySelect;
}>;

type MonthlyAttendanceSummary = {
  totalRecords: number;
  daysWorked: number;
  onTimeCount: number;
  statusCounts: Record<AttendanceStatus, number>;
  workSecondsTotal: number;
  workSecondsSamples: number;
  checkInMinutesTotal: number;
  checkInSamples: number;
};

type DashboardServiceInput = {
  userId: string;
  organizationId: string;
  organizationNameHint?: string | null;
  userRole: UserRole;
};

const summarizeMonthlyAttendance = (
  records: AttendanceRecordForDashboard[],
  monthStart: Date,
): MonthlyAttendanceSummary => {
  const summary: MonthlyAttendanceSummary = {
    totalRecords: 0,
    daysWorked: 0,
    onTimeCount: 0,
    statusCounts: buildStatusCounts(),
    workSecondsTotal: 0,
    workSecondsSamples: 0,
    checkInMinutesTotal: 0,
    checkInSamples: 0,
  };

  records.forEach((record) => {
    if (record.attendanceDate < monthStart) {
      return;
    }

    summary.totalRecords += 1;
    summary.statusCounts[record.status] += 1;

    if (workedStatuses.has(record.status)) {
      summary.daysWorked += 1;
    }
    if (onTimeStatuses.has(record.status)) {
      summary.onTimeCount += 1;
    }
    if (typeof record.totalWorkSeconds === "number") {
      summary.workSecondsTotal += record.totalWorkSeconds;
      summary.workSecondsSamples += 1;
    }
    if (record.checkInAt) {
      summary.checkInMinutesTotal +=
        record.checkInAt.getHours() * 60 + record.checkInAt.getMinutes();
      summary.checkInSamples += 1;
    }
  });

  return summary;
};

type DashboardDates = {
  now: Date;
  todayStart: Date;
  monthStart: Date;
  monthEnd: Date;
  monthEndInclusive: Date;
  trendStart: Date;
  attendanceRangeStart: Date;
};

type DashboardDataset = {
  user: Prisma.UserGetPayload<{ select: typeof userDashboardSelect }>;
  attendanceRecords: AttendanceRecordForDashboard[];
  monthlyLeaveRequests: LeaveRequestForDashboard[];
  upcomingLeaves: LeaveRequestForDashboard[];
  notifications: NotificationForDashboard[];
  upcomingHolidays: HolidayForDashboard[];
  workPolicy: WorkPolicyForDashboard | null;
  pendingCount: number;
  dates: DashboardDates;
  organizationName: string;
};

type DashboardSections = {
  profile: DashboardProfileSection;
  summary: DashboardSummarySection;
  attendance: DashboardAttendanceSection;
  timeOff: DashboardTimeOffSection;
  notifications: DashboardNotificationsSection;
  overview: EmployeeDashboardResponse;
};

const formatWorkPolicyHours = (
  policy: WorkPolicyForDashboard | null,
): string | null => {
  if (!policy) {
    return null;
  }
  const onsite =
    policy.onsiteStartTime && policy.onsiteEndTime
      ? `On-site ${policy.onsiteStartTime}-${policy.onsiteEndTime}`
      : null;
  const remote =
    policy.remoteStartTime && policy.remoteEndTime
      ? `Remote ${policy.remoteStartTime}-${policy.remoteEndTime}`
      : null;
  return [onsite, remote].filter(Boolean).join(" • ") || null;
};

const loadDashboardDataset = async (
  input: DashboardServiceInput,
): Promise<DashboardDataset> => {
  const { userId, organizationId, organizationNameHint, userRole } = input;
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEndInclusive = addDays(monthEnd, -1);
  const trendStart = addDays(todayStart, -(TREND_DAYS - 1));
  const attendanceRangeStart =
    monthStart.getTime() <= trendStart.getTime() ? monthStart : trendStart;

  const [
    userRecord,
    attendanceRecords,
    monthlyLeaveRequests,
    upcomingLeaves,
    notifications,
    upcomingHolidays,
    workPolicy,
    pendingCount,
  ] = await prisma.$transaction([
    prisma.user.findUnique({
      where: { id: userId },
      select: userDashboardSelect,
    }),
    prisma.attendanceRecord.findMany({
      where: {
        employeeId: userId,
        attendanceDate: {
          gte: attendanceRangeStart,
          lt: monthEnd,
        },
      },
      select: attendanceRecordSelect,
      orderBy: {
        attendanceDate: "asc",
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: userId,
        startDate: { lt: monthEnd },
        endDate: { gte: monthStart },
      },
      select: leaveRequestSelect,
      orderBy: {
        startDate: "asc",
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: userId,
        startDate: { gte: todayStart },
        status: {
          in: [
            LeaveStatus.PENDING,
            LeaveStatus.PROCESSING,
            LeaveStatus.APPROVED,
          ],
        },
      },
      select: leaveRequestSelect,
      orderBy: { startDate: "asc" },
      take: 4,
    }),
    prisma.notification.findMany({
      where: {
        organizationId,
        status: {
          in: notificationStatusesForDashboard,
        },
        AND: [buildNotificationAudienceFilter(userId, userRole)],
      },
      select: buildNotificationSelect(userId),
      orderBy: [
        { sentAt: "desc" },
        { scheduledAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 5,
    }),
    prisma.holiday.findMany({
      where: {
        organizationId,
        date: {
          gte: todayStart,
        },
      },
      select: holidaySelect,
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.workPolicy.findUnique({
      where: {
        organizationId,
      },
      select: workPolicySelect,
    }),
    prisma.leaveRequest.count({
      where: {
        employeeId: userId,
        status: {
          in: [LeaveStatus.PENDING, LeaveStatus.PROCESSING],
        },
      },
    }),
  ]);

  if (!userRecord) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Unable to load dashboard for this user.",
    });
  }

  const dates: DashboardDates = {
    now,
    todayStart,
    monthStart,
    monthEnd,
    monthEndInclusive,
    trendStart,
    attendanceRangeStart,
  };

  const organizationName =
    organizationNameHint ??
    userRecord.organization?.name ??
    "Workspace";

  return {
    user: userRecord,
    attendanceRecords,
    monthlyLeaveRequests,
    upcomingLeaves,
    notifications,
    upcomingHolidays,
    workPolicy,
    pendingCount,
    dates,
    organizationName,
  };
};

const buildDashboardSections = (dataset: DashboardDataset): DashboardSections => {
  const {
    user,
    attendanceRecords,
    monthlyLeaveRequests,
    upcomingLeaves,
    notifications,
    pendingCount,
    upcomingHolidays,
    workPolicy,
    dates,
    organizationName,
  } = dataset;
  const { monthStart, monthEndInclusive, trendStart } = dates;

  const attendanceByKey = attendanceRecords.reduce<
    Record<string, AttendanceRecordForDashboard>
  >((acc, record) => {
    acc[formatDateKey(record.attendanceDate)] = record;
    return acc;
  }, {});

  const attendanceTrend: DashboardAttendanceTrendPoint[] = [];
  for (let index = 0; index < TREND_DAYS; index += 1) {
    const date = addDays(trendStart, index);
    const key = formatDateKey(date);
    const record = attendanceByKey[key];
    attendanceTrend.push({
      date: date.toISOString(),
      status: record?.status ?? AttendanceStatus.ABSENT,
      workedSeconds: record?.totalWorkSeconds ?? 0,
      checkInAt: record?.checkInAt ? record.checkInAt.toISOString() : null,
      checkOutAt: record?.checkOutAt ? record.checkOutAt.toISOString() : null,
    });
  }

  const monthlyAttendance = summarizeMonthlyAttendance(
    attendanceRecords,
    monthStart,
  );
  const onTimePercentage = monthlyAttendance.totalRecords
    ? (monthlyAttendance.onTimeCount / monthlyAttendance.totalRecords) * 100
    : 0;
  const averageCheckIn =
    monthlyAttendance.checkInSamples > 0
      ? minutesToLabel(
          monthlyAttendance.checkInMinutesTotal /
            monthlyAttendance.checkInSamples,
        )
      : null;
  const averageWorkSeconds =
    monthlyAttendance.workSecondsSamples > 0
      ? Math.round(
          monthlyAttendance.workSecondsTotal /
            monthlyAttendance.workSecondsSamples,
        )
      : 0;
  const hoursLogged =
    Math.round((monthlyAttendance.workSecondsTotal / 3600) * 10) / 10;

  const leaveBalances = user.employment
    ? buildBalanceResponse(user.employment as EmploymentLeaveBalances)
    : [];
  const totalLeaveBalance = leaveBalances.reduce(
    (total, entry) => total + entry.remaining,
    0,
  );
  const leaveLeader = leaveBalances.reduce(
    (leader, entry) =>
      !leader || entry.remaining > leader.remaining ? entry : leader,
    leaveBalances[0] ?? null,
  );

  const leavesTaken = monthlyLeaveRequests.reduce((total, request) => {
    if (
      request.status !== LeaveStatus.APPROVED &&
      request.status !== LeaveStatus.PROCESSING
    ) {
      return total;
    }
    return (
      total +
      inclusiveOverlapDays(
        monthStart,
        monthEndInclusive,
        request.startDate,
        request.endDate,
      )
    );
  }, 0);

  const upcomingHighlights = upcomingLeaves.map((leave) => ({
    id: leave.id,
    leaveType: leave.leaveType,
    leaveTypeLabel: leaveTypeLabelMap[toLeaveTypeValue(leave.leaveType)],
    status: leave.status,
    startDate: leave.startDate.toISOString(),
    endDate: leave.endDate.toISOString(),
    totalDays: decimalToNumber(leave.totalDays),
  }));
  const nextLeaveDate =
    upcomingLeaves.length > 0 ? upcomingLeaves[0].startDate.toISOString() : null;

  const notificationsSummary = notifications.map((record) => {
    const receipt = record.receipts?.[0];
    return {
      id: record.id,
      title: record.title,
      body: record.body,
      type: record.type,
      status: record.status,
      isSeen: receipt?.isSeen ?? false,
      actionUrl: record.actionUrl ?? null,
      timestamp: (
        record.sentAt ?? record.scheduledAt ?? record.createdAt
      ).toISOString(),
    };
  });

  const profile = user.profile;
  const employment = user.employment;
  const workHoursLabel = formatWorkPolicyHours(workPolicy);
  const baseName = [profile?.firstName, profile?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const fullName = baseName || profile?.preferredName || user.email;
  const managerName = employment?.manager?.profile
    ? [
        employment.manager.profile.preferredName,
        employment.manager.profile.firstName,
        employment.manager.profile.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || null
    : null;
  const tags = [
    employment?.team?.name,
    employment?.employmentType,
    profile?.workModel,
  ]
    .filter((tag): tag is string => Boolean(tag))
    .map((tag) => tag.trim());

  const personalDetails = [
    { label: "Work Email", value: profile?.workEmail ?? user.email },
    { label: "Personal Email", value: profile?.personalEmail ?? null },
    {
      label: "Work Phone",
      value: profile?.workPhone ?? user.phone ?? null,
    },
    {
      label: "Personal Phone",
      value: profile?.personalPhone ?? null,
    },
    {
      label: "Work Model",
      value: profile?.workModel ?? null,
    },
    {
      label: "Date of Birth",
      value: profile?.dateOfBirth ? profile.dateOfBirth.toISOString() : null,
    },
    {
      label: "Current Address",
      value: profile?.currentAddress ?? null,
    },
    {
      label: "Permanent Address",
      value: profile?.permanentAddress ?? null,
    },
    {
      label: "Nationality",
      value: profile?.nationality ?? null,
    },
  ];

  const companyDetails = [
    {
      label: "Employee ID",
      value: employment?.employeeCode ?? null,
    },
    {
      label: "Department",
      value: employment?.department?.name ?? null,
    },
    {
      label: "Team",
      value: employment?.team?.name ?? null,
    },
    {
      label: "Designation",
      value: employment?.designation ?? null,
    },
    {
      label: "Reporting Manager",
      value: managerName,
    },
    {
      label: "Employment Type",
      value: employment?.employmentType ?? null,
    },
    {
      label: "Status",
      value: employment?.status ?? null,
    },
    {
      label: "Work Hours",
      value: workHoursLabel,
    },
    {
      label: "Location",
      value: employment?.primaryLocation ?? null,
    },
    {
      label: "Project",
      value:
        employment?.currentProject?.name ??
        employment?.currentProjectNote ??
        null,
    },
    {
      label: "Joined",
      value: employment?.startDate ? employment.startDate.toISOString() : null,
    },
  ];

  const monthSnapshot = {
    daysWorked: monthlyAttendance.daysWorked,
    hoursLogged,
    leavesTaken,
  };

  const pendingHelper =
    pendingCount > 0
      ? `${organizationName} needs a response`
      : "All caught up";

  const quickStats = [
    {
      id: "leave-balance",
      label: "Leave balance",
      value: `${Math.round(totalLeaveBalance * 10) / 10}d`,
      helper: leaveLeader
        ? `${leaveLeader.label} most remaining`
        : "No leave data yet",
    },
    {
      id: "attendance",
      label: "Attendance",
      value: `${Math.round(onTimePercentage)}%`,
      helper: "On-time this month",
    },
    {
      id: "pending",
      label: "Pending actions",
      value: pendingCount.toString(),
      helper: pendingHelper,
    },
    {
      id: "upcoming",
      label: "Next time off",
      value: nextLeaveDate
        ? shortDateFormatter.format(new Date(nextLeaveDate))
        : "—",
      helper: nextLeaveDate ? "Scheduled leave" : "No upcoming leave",
    },
  ];

  const profileSection: DashboardProfileSection = {
    workspaceName: organizationName,
    profile: {
      fullName,
      preferredName: profile?.preferredName ?? null,
      designation: employment?.designation ?? null,
      avatarUrl: profile?.profilePhotoUrl ?? null,
      joiningDate: employment?.startDate ? employment.startDate.toISOString() : null,
      teamName: employment?.team?.name ?? null,
      departmentName: employment?.department?.name ?? null,
      managerName,
      employmentType: employment?.employmentType ?? null,
      employmentStatus: employment?.status ?? null,
      workModel: profile?.workModel ?? null,
      workHours: workHoursLabel,
      currentProject: employment?.currentProject?.name ?? null,
      currentProjectNote: employment?.currentProjectNote ?? null,
      primaryLocation: employment?.primaryLocation ?? null,
      tags,
    },
    personalDetails,
    companyDetails,
  };

  const summarySection: DashboardSummarySection = {
    monthSnapshot,
    quickStats,
  };

  const attendanceSummary = {
    monthLabel: monthFormatter.format(monthStart),
    totalRecords: monthlyAttendance.totalRecords,
    onTimePercentage: Math.round(onTimePercentage * 10) / 10,
    averageCheckIn,
    averageWorkSeconds,
    statusCounts: monthlyAttendance.statusCounts,
  };

  const attendanceSection: DashboardAttendanceSection = {
    attendanceSummary,
    attendanceTrend,
  };

  const leaveHighlights = {
    pendingCount,
    upcoming: upcomingHighlights,
    nextLeaveDate,
  };

  const upcomingHolidayHighlights = upcomingHolidays.map((holiday) => ({
    id: holiday.id,
    title: holiday.title,
    description: holiday.description ?? null,
    date: holiday.date.toISOString(),
  }));

  const timeOffSection: DashboardTimeOffSection = {
    leaveBalances,
    leaveHighlights,
    upcomingHolidays: upcomingHolidayHighlights,
  };

  const notificationsSection: DashboardNotificationsSection = {
    notifications: notificationsSummary,
  };

  const overview: EmployeeDashboardResponse = {
    profile: profileSection.profile,
    monthSnapshot: summarySection.monthSnapshot,
    quickStats: summarySection.quickStats,
    personalDetails: profileSection.personalDetails,
    companyDetails: profileSection.companyDetails,
    attendanceSummary: attendanceSection.attendanceSummary,
    attendanceTrend: attendanceSection.attendanceTrend,
    leaveBalances: timeOffSection.leaveBalances,
    leaveHighlights: timeOffSection.leaveHighlights,
    upcomingHolidays: timeOffSection.upcomingHolidays,
    notifications: notificationsSection.notifications,
  };

  return {
    profile: profileSection,
    summary: summarySection,
    attendance: attendanceSection,
    timeOff: timeOffSection,
    notifications: notificationsSection,
    overview,
  };
};

const getHolidaysSection = async (
  input: DashboardServiceInput,
): Promise<DashboardHolidaysSection> => {
  const { organizationId, organizationNameHint } = input;
  const holidayRecords = await prisma.holiday.findMany({
    where: { organizationId },
    select: holidaySelect,
    orderBy: { date: "asc" },
  });

  let workspaceName = organizationNameHint;
  if (!workspaceName) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    workspaceName = organization?.name ?? null;
  }

  return {
    workspaceName: workspaceName ?? "Workspace",
    holidays: holidayRecords.map((record) => ({
      id: record.id,
      title: record.title,
      description: record.description ?? null,
      date: record.date.toISOString(),
    })),
  };
};

const resolveSections = async (input: DashboardServiceInput) => {
  const dataset = await loadDashboardDataset(input);
  return buildDashboardSections(dataset);
};

const getOverview = async (input: DashboardServiceInput) => {
  const sections = await resolveSections(input);
  return sections.overview;
};

const getProfileSection = async (input: DashboardServiceInput) => {
  const sections = await resolveSections(input);
  return sections.profile;
};

const getSummarySection = async (input: DashboardServiceInput) => {
  const sections = await resolveSections(input);
  return sections.summary;
};

const getAttendanceSection = async (input: DashboardServiceInput) => {
  const sections = await resolveSections(input);
  return sections.attendance;
};

const getTimeOffSection = async (input: DashboardServiceInput) => {
  const sections = await resolveSections(input);
  return sections.timeOff;
};

const getNotificationsSection = async (input: DashboardServiceInput) => {
  const sections = await resolveSections(input);
  return sections.notifications;
};

export const DashboardService = {
  getOverview,
  getProfileSection,
  getSummarySection,
  getAttendanceSection,
  getTimeOffSection,
  getNotificationsSection,
  getHolidaysSection,
};
