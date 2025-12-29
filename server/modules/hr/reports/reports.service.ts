import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import { requireHrAdmin } from "@/server/modules/hr/utils";

const decimalToNumber = (value?: Prisma.Decimal | null) =>
  value ? Number(value) : 0;

const startOfDay = (value: Date) => {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (value: Date) => {
  const copy = new Date(value);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

const startOfMonth = (value: Date) => {
  const copy = new Date(value);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const parseDate = (value: string, label: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map((part) => Number(part));
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid ${label}.`,
    });
  }
  return date;
};

const ensureDateRange = (startDate?: string, endDate?: string, fallbackDays = 30) => {
  const now = new Date();
  let start = startOfDay(new Date(now));
  start.setDate(start.getDate() - fallbackDays);
  let end = endOfDay(now);

  if (startDate) {
    start = startOfDay(parseDate(startDate, "start date"));
  }
  if (endDate) {
    end = endOfDay(parseDate(endDate, "end date"));
  }

  if (start > end) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Start date cannot be after end date.",
    });
  }

  return { start, end };
};

const ensureMonthRange = (startDate?: string, endDate?: string, fallbackMonths = 6) => {
  const now = new Date();
  let start = startOfMonth(new Date(now));
  start.setMonth(start.getMonth() - fallbackMonths);
  let end = startOfMonth(now);

  if (startDate) {
    start = startOfMonth(parseDate(startDate, "start date"));
  }
  if (endDate) {
    end = startOfMonth(parseDate(endDate, "end date"));
  }

  if (start > end) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Start date cannot be after end date.",
    });
  }

  return { start, end };
};

const dailySearchFilter = (search?: string | null) => {
  if (!search?.trim()) {
    return {};
  }
  const term = search.trim();
  const mode = Prisma.QueryMode.insensitive;
  return {
    entries: {
      some: {
        OR: [
          { taskName: { contains: term, mode } },
          { workType: { contains: term, mode } },
          { details: { contains: term, mode } },
          { others: { contains: term, mode } },
        ],
      },
    },
  };
};

const monthlySearchFilter = (search?: string | null) => {
  if (!search?.trim()) {
    return {};
  }
  const term = search.trim();
  const mode = Prisma.QueryMode.insensitive;
  return {
    entries: {
      some: {
        taskName: { contains: term, mode },
      },
    },
  };
};

const formatEmployeeName = (employee: {
  profile: {
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
  } | null;
  email: string;
}) => {
  if (employee.profile?.preferredName) {
    return employee.profile.preferredName;
  }
  const parts = [employee.profile?.firstName, employee.profile?.lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return employee.email;
};

export type HrDailyRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  reportDate: string;
  entryCount: number;
  totalWorkingHours: number;
  workTypes: string[];
  topTasks: string[];
};

export type HrDailyTrendPoint = {
  date: string;
  label: string;
  reports: number;
  hours: number;
};

export type HrMonthlyRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  reportMonth: string;
  entryCount: number;
  totalWorkingHours: number;
  totalStoryPoints: number;
  topTasks: string[];
};

export type HrMonthlyTrendPoint = {
  month: string;
  label: string;
  reports: number;
  storyPoints: number;
};

export type HrReportOverview = {
  filters: {
    employees: Array<{ id: string; name: string; email: string | null }>;
    dateRange: { start: string; end: string };
  };
  daily: {
    totals: {
      reports: number;
      hours: number;
    };
    rows: HrDailyRow[];
    trend: HrDailyTrendPoint[];
  };
  monthly: {
    totals: {
      reports: number;
      hours: number;
      storyPoints: number;
    };
    rows: HrMonthlyRow[];
    trend: HrMonthlyTrendPoint[];
  };
};

type OverviewInput = {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  search?: string;
};

const getOverview = async (
  ctx: TRPCContext,
  input: OverviewInput = {},
): Promise<HrReportOverview> => {
  const viewer = requireHrAdmin(ctx);
  const { startDate, endDate, employeeId, search } = input;
  const { start, end } = ensureDateRange(startDate, endDate);
  const { start: monthStart, end: monthEnd } = ensureMonthRange(startDate, endDate);

  const employeeFilter = employeeId ? { employeeId } : {};

  const dailyWhere = {
    organizationId: viewer.organizationId,
    reportDate: { gte: start, lte: end },
    ...employeeFilter,
    ...dailySearchFilter(search),
  };

  const monthlyWhere = {
    organizationId: viewer.organizationId,
    reportMonth: { gte: monthStart, lte: monthEnd },
    ...employeeFilter,
    ...monthlySearchFilter(search),
  };

  const [dailyReports, monthlyReports, employees] = await Promise.all([
    ctx.prisma.dailyReport.findMany({
      where: dailyWhere,
      include: {
        entries: true,
        employee: {
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
      orderBy: { reportDate: "desc" },
      take: 200,
    }),
    ctx.prisma.monthlyReport.findMany({
      where: monthlyWhere,
      include: {
        entries: true,
        employee: {
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
      orderBy: { reportMonth: "desc" },
      take: 100,
    }),
    ctx.prisma.user.findMany({
      where: {
        organizationId: viewer.organizationId,
        status: "ACTIVE",
      },
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
      orderBy: {
        profile: {
          firstName: "asc",
        },
      },
    }),
  ]);

  const dailyRows: HrDailyRow[] = dailyReports.map((report) => {
    const totalHours = report.entries.reduce(
      (sum, entry) => sum + decimalToNumber(entry.workingHours),
      0,
    );
    const workTypes = Array.from(new Set(report.entries.map((entry) => entry.workType))).slice(0, 3);
    const topTasks = report.entries.slice(0, 3).map((entry) => entry.taskName);

    return {
      id: report.id,
      employeeId: report.employeeId,
      employeeName: formatEmployeeName(report.employee),
      reportDate: report.reportDate.toISOString(),
      entryCount: report.entries.length,
      totalWorkingHours: totalHours,
      workTypes,
      topTasks,
    };
  });

  const monthlyRows: HrMonthlyRow[] = monthlyReports.map((report) => {
    const totalHours = report.entries.reduce(
      (sum, entry) => sum + decimalToNumber(entry.workingHours),
      0,
    );
    const totalStoryPoints = report.entries.reduce(
      (sum, entry) => sum + decimalToNumber(entry.storyPoint),
      0,
    );

    return {
      id: report.id,
      employeeId: report.employeeId,
      employeeName: formatEmployeeName(report.employee),
      reportMonth: report.reportMonth.toISOString(),
      entryCount: report.entries.length,
      totalWorkingHours: totalHours,
      totalStoryPoints,
      topTasks: report.entries.slice(0, 4).map((entry) => entry.taskName),
    };
  });

  const dailyTrendMap = new Map<string, HrDailyTrendPoint>();
  dailyRows.forEach((row) => {
    const dateKey = row.reportDate.slice(0, 10);
    if (!dailyTrendMap.has(dateKey)) {
      const dateObj = new Date(row.reportDate);
      const label = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      dailyTrendMap.set(dateKey, {
        date: row.reportDate,
        label,
        reports: 0,
        hours: 0,
      });
    }
    const trend = dailyTrendMap.get(dateKey)!;
    trend.reports += 1;
    trend.hours += row.totalWorkingHours;
  });

  const monthlyTrendMap = new Map<string, HrMonthlyTrendPoint>();
  monthlyRows.forEach((row) => {
    const monthKey = row.reportMonth.slice(0, 7);
    if (!monthlyTrendMap.has(monthKey)) {
      const dateObj = new Date(row.reportMonth);
      const label = dateObj.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      monthlyTrendMap.set(monthKey, {
        month: row.reportMonth,
        label,
        reports: 0,
        storyPoints: 0,
      });
    }
    const trend = monthlyTrendMap.get(monthKey)!;
    trend.reports += 1;
    trend.storyPoints += row.totalStoryPoints;
  });

  return {
    filters: {
      employees: employees.map((employee) => ({
        id: employee.id,
        name: formatEmployeeName(employee),
        email: employee.email,
      })),
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    },
    daily: {
      totals: {
        reports: dailyRows.length,
        hours: dailyRows.reduce((sum, row) => sum + row.totalWorkingHours, 0),
      },
      rows: dailyRows,
      trend: Array.from(dailyTrendMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    },
    monthly: {
      totals: {
        reports: monthlyRows.length,
        hours: monthlyRows.reduce((sum, row) => sum + row.totalWorkingHours, 0),
        storyPoints: monthlyRows.reduce((sum, row) => sum + row.totalStoryPoints, 0),
      },
      rows: monthlyRows,
      trend: Array.from(monthlyTrendMap.values()).sort(
        (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime(),
      ),
    },
  };
};

export const HrReportsService = {
  getOverview,
};
