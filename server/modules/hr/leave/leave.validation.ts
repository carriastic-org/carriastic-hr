import { z } from "zod";

import { LeaveStatus, LeaveType } from "@prisma/client";

const manageableStatuses = ["PROCESSING", "APPROVED", "DENIED", "CANCELLED"] as const;
const sortFields = ["submittedAt", "startDate", "leaveType", "status"] as const;
const sortOrders = ["asc", "desc"] as const;

export const hrLeaveListInput = z.object({
  status: z.nativeEnum(LeaveStatus).optional(),
  leaveType: z.nativeEnum(LeaveType).optional(),
  search: z
    .string()
    .trim()
    .min(1, "Search term must include a character.")
    .max(120, "Search term is too long.")
    .optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  sortField: z.enum(sortFields).optional(),
  sortOrder: z.enum(sortOrders).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const hrLeaveUpdateStatusInput = z.object({
  requestId: z.string().min(1, "Request ID is required."),
  status: z.enum(manageableStatuses, {
    errorMap: () => ({
      message: "Invalid status for HR management.",
    }),
  }),
  note: z.string().max(2000, "Keep notes under 2000 characters.").optional().nullable(),
});

export type HrLeaveListInput = z.infer<typeof hrLeaveListInput>;
export type HrLeaveUpdateStatusInput = z.infer<typeof hrLeaveUpdateStatusInput>;
