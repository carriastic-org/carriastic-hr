import type { PrismaClient } from "@prisma/client";

import { NDI_ORG_ID } from "./data";

type DailySeed = {
  employeeId: string;
  reportDate: string;
  note?: string;
  entries: Array<{
    workType: string;
    taskName: string;
    details: string;
    workingHours: number;
    others?: string;
  }>;
};

type MonthlySeed = {
  employeeId: string;
  reportMonth: string;
  entries: Array<{
    taskName: string;
    storyPoint: number;
    workingHours: number;
  }>;
};

const dailyReports: DailySeed[] = [
  {
    employeeId: "emp-zahidul",
    reportDate: "2024-11-18",
    note: "Focused on UI polish and QA fixes.",
    entries: [
      {
        workType: "Development",
        taskName: "Dashboard refinements",
        details: "Cleaned up widgets and added empty-state handling.",
        workingHours: 3.5,
      },
      {
        workType: "Testing",
        taskName: "Regression sweep",
        details: "Validated attendance flow on mobile and desktop.",
        workingHours: 2,
        others: "Cross-team QA",
      },
    ],
  },
  {
    employeeId: "emp-mustahid",
    reportDate: "2024-11-18",
    note: "Morning spent on reporting APIs, afternoon on code review.",
    entries: [
      {
        workType: "Development",
        taskName: "Daily report mutations",
        details: "Implemented input validation and history aggregation.",
        workingHours: 4,
      },
      {
        workType: "Review",
        taskName: "API contract review",
        details: "Reviewed HR admin endpoints and added comments.",
        workingHours: 1.5,
      },
    ],
  },
];

const monthlyReports: MonthlySeed[] = [
  {
    employeeId: "emp-zahidul",
    reportMonth: "2024-10-01",
    entries: [
      { taskName: "App shell redesign", storyPoint: 21, workingHours: 72 },
      { taskName: "Attendance widget", storyPoint: 8, workingHours: 24 },
      { taskName: "Accessibility fixes", storyPoint: 5, workingHours: 18 },
    ],
  },
  {
    employeeId: "emp-mustahid",
    reportMonth: "2024-10-01",
    entries: [
      { taskName: "Reporting API foundation", storyPoint: 13, workingHours: 64 },
      { taskName: "TRPC guard improvements", storyPoint: 5, workingHours: 20 },
      { taskName: "Notification fanout", storyPoint: 8, workingHours: 28 },
    ],
  },
];

export const seedReports = async (prisma: PrismaClient) => {
  const dailyCount = await prisma.dailyReport.count();
  if (dailyCount === 0) {
    for (const report of dailyReports) {
      await prisma.dailyReport.create({
        data: {
          organizationId: NDI_ORG_ID,
          employeeId: report.employeeId,
          reportDate: new Date(report.reportDate),
          note: report.note,
          entries: {
            create: report.entries.map((entry) => ({
              workType: entry.workType,
              taskName: entry.taskName,
              details: entry.details,
              workingHours: entry.workingHours,
              others: entry.others ?? null,
            })),
          },
        },
      });
    }
    console.log("Seeded example daily reports.");
  } else {
    console.log("Daily reports already present, skipping daily report seed.");
  }

  const monthlyCount = await prisma.monthlyReport.count();
  if (monthlyCount === 0) {
    for (const report of monthlyReports) {
      await prisma.monthlyReport.create({
        data: {
          organizationId: NDI_ORG_ID,
          employeeId: report.employeeId,
          reportMonth: new Date(report.reportMonth),
          entries: {
            create: report.entries.map((entry) => ({
              taskName: entry.taskName,
              storyPoint: entry.storyPoint,
              workingHours: entry.workingHours,
            })),
          },
        },
      });
    }
    console.log("Seeded example monthly reports.");
  } else {
    console.log("Monthly reports already present, skipping monthly report seed.");
  }
};
