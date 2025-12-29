import { z } from "zod";

const paginationFields = {
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(250).optional().default(20),
};

const dateRangeFields = {
  startDate: z.string().optional(),
  endDate: z.string().optional(),
};

export const dailyReportEntrySchema = z.object({
  workType: z.string().min(1, "Work type is required."),
  taskName: z.string().min(1, "Task name is required."),
  others: z.string().optional().nullable(),
  details: z.string().min(1, "Details are required."),
  workingHours: z.coerce
    .number()
    .positive("Working hours must be greater than zero.")
    .max(24, "Working hours cannot exceed 24 per entry."),
});

export const submitDailyReportSchema = z.object({
  reportDate: z.string().min(1, "Report date is required."),
  note: z.string().optional().nullable(),
  entries: z.array(dailyReportEntrySchema).min(1, "Add at least one task."),
});

export const dailyHistorySchema = z
  .object({
    ...paginationFields,
    ...dateRangeFields,
    search: z.string().optional(),
    sort: z.enum(["recent", "oldest"]).optional().default("recent"),
  })
  .optional()
  .default({});

export const monthlyReportEntrySchema = z.object({
  taskName: z.string().min(1, "Task name is required."),
  storyPoint: z.coerce
    .number()
    .nonnegative("Story points cannot be negative.")
    .max(500, "Story points look too large."),
  workingHours: z.coerce
    .number()
    .positive("Working hours must be greater than zero.")
    .max(200, "Working hours look too large."),
});

export const submitMonthlyReportSchema = z.object({
  reportMonth: z.string().min(1, "Report month is required."),
  entries: z
    .array(monthlyReportEntrySchema)
    .min(1, "Add at least one task or ticket."),
});

export const monthlyHistorySchema = z
  .object({
    ...paginationFields,
    ...dateRangeFields,
    search: z.string().optional(),
    sort: z.enum(["recent", "oldest"]).optional().default("recent"),
  })
  .optional()
  .default({});

export const hrReportsFilterSchema = z
  .object({
    ...dateRangeFields,
    employeeId: z.string().optional(),
    search: z.string().optional(),
  })
  .optional()
  .default({});
