import { z } from "zod";

export const hrAttendanceOverviewSchema = z.object({
  date: z.string().min(1, "Date is required"),
});

export const hrAttendanceHistorySchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  month: z.number().int().min(0).max(11),
  year: z.number().int().min(1970),
});

export const hrAttendanceManualEntrySchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  date: z.string().min(1, "Date is required"),
  checkIn: z.string().min(1, "Check-in is required"),
  checkOut: z.string().optional().nullable(),
  workType: z.enum(["REMOTE", "ONSITE"]),
});

export type HrAttendanceOverviewInput = z.infer<typeof hrAttendanceOverviewSchema>;
export type HrAttendanceHistoryInput = z.infer<typeof hrAttendanceHistorySchema>;
export type HrAttendanceManualEntryInput = z.infer<typeof hrAttendanceManualEntrySchema>;
