import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";

type Nullable<T> = T | null | undefined;

type DailyReportWithEntries = Prisma.DailyReportGetPayload<{
  include: { entries: true };
}>;

type MonthlyReportWithEntries = Prisma.MonthlyReportGetPayload<{
  include: { entries: true };
}>;

const decimalToNumber = (value: Nullable<Prisma.Decimal>): number =>
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

const resolveEmployeeContext = (ctx: TRPCContext) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const organizationId = ctx.session.user.organization?.id ?? ctx.session.user.organizationId;
  if (!organizationId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Missing organization context.",
    });
  }

  const preferredName = ctx.session.user.profile?.preferredName;
  const fallbackName = [ctx.session.user.profile?.firstName, ctx.session.user.profile?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const viewerName = preferredName ?? (fallbackName || ctx.session.user.email);

  return {
    employeeId: ctx.session.user.id,
    organizationId,
    viewerName,
  };
};

export type DailyReportEntryResponse = {
  id: string;
  workType: string;
  taskName: string;
  others: string | null;
  details: string;
  workingHours: number;
};

export type DailyReportResponse = {
  id: string;
  reportDate: string;
  note: string | null;
  submittedAt: string;
  totalWorkingHours: number;
  entryCount: number;
  entries: DailyReportEntryResponse[];
};

export type MonthlyReportEntryResponse = {
  id: string;
  taskName: string;
  storyPoint: number;
  workingHours: number;
};

export type MonthlyReportResponse = {
  id: string;
  reportMonth: string;
  submittedAt: string;
  entryCount: number;
  totalWorkingHours: number;
  totalStoryPoints: number;
  entries: MonthlyReportEntryResponse[];
};

export type ReportHistoryMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type DailyHistoryResponse = {
  items: DailyReportResponse[];
  pagination: ReportHistoryMeta;
  totals: {
    workingHours: number;
    entryCount: number;
  };
};

export type MonthlyHistoryResponse = {
  items: MonthlyReportResponse[];
  pagination: ReportHistoryMeta;
  totals: {
    workingHours: number;
    storyPoints: number;
    entryCount: number;
  };
};

const buildSearchFilter = (search?: string | null): Prisma.DailyReportWhereInput => {
  if (!search?.trim()) {
    return {};
  }
  const value = search.trim();
  const mode = Prisma.QueryMode.insensitive;
  const clauses: Prisma.DailyReportEntryWhereInput[] = [
    { taskName: { contains: value, mode } },
    { details: { contains: value, mode } },
    { others: { contains: value, mode } },
    { workType: { contains: value, mode } },
  ];
  return {
    entries: {
      some: {
        OR: clauses,
      },
    },
  };
};

const buildMonthlySearchFilter = (search?: string | null): Prisma.MonthlyReportWhereInput => {
  if (!search?.trim()) {
    return {};
  }
  const value = search.trim();
  const mode = Prisma.QueryMode.insensitive;
  const numericValue = Number(value);
  const clauses: Prisma.MonthlyReportEntryWhereInput[] = [
    { taskName: { contains: value, mode } },
  ];
  if (!Number.isNaN(numericValue)) {
    clauses.push({
      storyPoint: { equals: new Prisma.Decimal(numericValue) },
    });
  }
  return {
    entries: {
      some: {
        OR: clauses,
      },
    },
  };
};

type DateRange = {
  start?: Date;
  end?: Date;
};

const buildTodayRange = (): Required<DateRange> => {
  const now = new Date();
  return {
    start: startOfDay(now),
    end: endOfDay(now),
  };
};

const buildCurrentMonthRange = (): Required<DateRange> => {
  const now = new Date();
  const start = startOfMonth(now);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0); // move to last day of current month
  return {
    start,
    end: endOfDay(end),
  };
};

const ensureDateRange = (startDate?: string, endDate?: string, fallback?: () => DateRange | null) => {
  if (!startDate && !endDate) {
    return fallback ? fallback() : null;
  }

  const start = startDate ? startOfDay(parseDate(startDate, "start date")) : undefined;
  const end = endDate ? endOfDay(parseDate(endDate, "end date")) : undefined;

  if (start && end && start > end) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Start date cannot be after end date.",
    });
  }

  return { start, end };
};

const ensureMonthRange = (
  startDate?: string,
  endDate?: string,
  fallback?: () => DateRange | null,
) => {
  if (!startDate && !endDate) {
    return fallback ? fallback() : null;
  }

  const start = startDate ? startOfMonth(parseDate(startDate, "start date")) : undefined;
  const end = endDate ? startOfMonth(parseDate(endDate, "end date")) : undefined;

  if (start && end && start > end) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Start date cannot be after end date.",
    });
  }

  return { start, end };
};

const submitDaily = async (
  ctx: TRPCContext,
  input: {
    reportDate: string;
    note?: string | null;
    entries: Array<{
      workType: string;
      taskName: string;
      others?: string | null;
      details: string;
      workingHours: number;
    }>;
  },
) => {
  const { employeeId, organizationId } = resolveEmployeeContext(ctx);
  const reportDate = startOfDay(parseDate(input.reportDate, "report date"));

  const entries = input.entries.map((entry) => ({
    workType: entry.workType,
    taskName: entry.taskName,
    others: entry.others?.trim() || null,
    details: entry.details,
    workingHours: new Prisma.Decimal(entry.workingHours),
  }));

  const record = await ctx.prisma.dailyReport.upsert({
    where: { employeeId_reportDate: { employeeId, reportDate } },
    update: {
      note: input.note?.trim() || null,
      entries: {
        deleteMany: {},
        createMany: { data: entries },
      },
    },
    create: {
      organizationId,
      employeeId,
      reportDate,
      note: input.note?.trim() || null,
      entries: {
        createMany: { data: entries },
      },
    },
    include: {
      entries: true,
    },
  });

  return {
    id: record.id,
    reportDate: record.reportDate.toISOString(),
    entryCount: record.entries.length,
  };
};

const submitMonthly = async (
  ctx: TRPCContext,
  input: {
    reportMonth: string;
    entries: Array<{
      taskName: string;
      storyPoint: number;
      workingHours: number;
    }>;
  },
) => {
  const { employeeId, organizationId } = resolveEmployeeContext(ctx);
  const reportMonth = startOfMonth(parseDate(input.reportMonth, "report month"));

  const entries = input.entries.map((entry) => ({
    taskName: entry.taskName,
    storyPoint: new Prisma.Decimal(entry.storyPoint),
    workingHours: new Prisma.Decimal(entry.workingHours),
  }));

  const record = await ctx.prisma.monthlyReport.upsert({
    where: { employeeId_reportMonth: { employeeId, reportMonth } },
    update: {
      entries: {
        deleteMany: {},
        createMany: { data: entries },
      },
    },
    create: {
      organizationId,
      employeeId,
      reportMonth,
      entries: {
        createMany: { data: entries },
      },
    },
    include: {
      entries: true,
    },
  });

  return {
    id: record.id,
    reportMonth: record.reportMonth.toISOString(),
    entryCount: record.entries.length,
  };
};

const getDailyHistory = async (
  ctx: TRPCContext,
  input: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
    search?: string;
    sort?: "recent" | "oldest";
  } = {},
): Promise<DailyHistoryResponse> => {
  const { employeeId } = resolveEmployeeContext(ctx);
  const { page = 1, pageSize = 20, sort = "recent", startDate, endDate, search } = input;
  const range = ensureDateRange(startDate, endDate, buildTodayRange);

  const where: Prisma.DailyReportWhereInput = {
    employeeId,
    ...(range
      ? {
          reportDate: {
            ...(range.start ? { gte: range.start } : {}),
            ...(range.end ? { lte: range.end } : {}),
          },
        }
      : {}),
    ...buildSearchFilter(search),
  };

  const orderBy = { reportDate: sort === "recent" ? "desc" : "asc" } as const;

  const [items, totalItems, aggregate] = (await ctx.prisma.$transaction([
    ctx.prisma.dailyReport.findMany({
      where,
      include: {
        entries: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    ctx.prisma.dailyReport.count({ where }),
    ctx.prisma.dailyReportEntry.aggregate({
      _sum: { workingHours: true },
      where: {
        report: {
          is: where,
        },
      },
    }),
  ])) as [DailyReportWithEntries[], number, Prisma.AggregateDailyReportEntry];

  const mapped: DailyReportResponse[] = items.map((report) => {
    const entryCount = report.entries.length;
    const totalHours = report.entries.reduce(
      (sum, entry) => sum + decimalToNumber(entry.workingHours),
      0,
    );
    return {
      id: report.id,
      reportDate: report.reportDate.toISOString(),
      note: report.note,
      submittedAt: report.submittedAt.toISOString(),
      entryCount,
      totalWorkingHours: totalHours,
      entries: report.entries.map((entry) => ({
        id: entry.id,
        workType: entry.workType,
        taskName: entry.taskName,
        others: entry.others,
        details: entry.details,
        workingHours: decimalToNumber(entry.workingHours),
      })),
    };
  });

  const totals = {
    workingHours: decimalToNumber(aggregate._sum?.workingHours),
    entryCount: mapped.reduce((sum, item) => sum + item.entryCount, 0),
  };

  return {
    items: mapped,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    },
    totals,
  };
};

const getMonthlyHistory = async (
  ctx: TRPCContext,
  input: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
    search?: string;
    sort?: "recent" | "oldest";
  } = {},
): Promise<MonthlyHistoryResponse> => {
  const { employeeId } = resolveEmployeeContext(ctx);
  const { page = 1, pageSize = 12, sort = "recent", startDate, endDate, search } = input;
  const range = ensureMonthRange(startDate, endDate, buildCurrentMonthRange);

  const where: Prisma.MonthlyReportWhereInput = {
    employeeId,
    ...(range
      ? {
          reportMonth: {
            ...(range.start ? { gte: range.start } : {}),
            ...(range.end ? { lte: range.end } : {}),
          },
        }
      : {}),
    ...buildMonthlySearchFilter(search),
  };

  const orderBy = { reportMonth: sort === "recent" ? "desc" : "asc" } as const;

  const [items, totalItems, aggregate] = (await ctx.prisma.$transaction([
    ctx.prisma.monthlyReport.findMany({
      where,
      include: {
        entries: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    ctx.prisma.monthlyReport.count({ where }),
    ctx.prisma.monthlyReportEntry.aggregate({
      _sum: {
        workingHours: true,
        storyPoint: true,
      },
      where: {
        report: {
          is: where,
        },
      },
    }),
  ])) as [MonthlyReportWithEntries[], number, Prisma.AggregateMonthlyReportEntry];

  const mapped: MonthlyReportResponse[] = items.map((report) => {
    const entryCount = report.entries.length;
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
      reportMonth: report.reportMonth.toISOString(),
      submittedAt: report.submittedAt.toISOString(),
      entryCount,
      totalWorkingHours: totalHours,
      totalStoryPoints,
      entries: report.entries.map((entry) => ({
        id: entry.id,
        taskName: entry.taskName,
        storyPoint: decimalToNumber(entry.storyPoint),
        workingHours: decimalToNumber(entry.workingHours),
      })),
    };
  });

  const totals = {
    workingHours: decimalToNumber(aggregate._sum?.workingHours),
    storyPoints: decimalToNumber(aggregate._sum?.storyPoint),
    entryCount: mapped.reduce((sum, item) => sum + item.entryCount, 0),
  };

  return {
    items: mapped,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    },
    totals,
  };
};

export const ReportService = {
  submitDaily,
  submitMonthly,
  getDailyHistory,
  getMonthlyHistory,
};
