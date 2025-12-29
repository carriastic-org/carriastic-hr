import { z } from "zod";

import { leaveTypeValues } from "@/lib/leave-types";

export const leaveAttachmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  type: z.string().max(120).optional(),
  size: z
    .number()
    .int()
    .min(0)
    .max(5 * 1024 * 1024, { message: "Attachments must be smaller than 5 MB." })
    .optional(),
  storageKey: z.string().min(1, { message: "Attachment reference is missing." }),
});

export type LeaveAttachmentInput = z.infer<typeof leaveAttachmentSchema>;

export const createLeaveApplicationSchema = z
  .object({
    leaveType: z.enum(leaveTypeValues),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().min(10).max(2000),
    note: z.string().max(2000).optional(),
    attachments: z.array(leaveAttachmentSchema).max(3).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after the start date.",
        path: ["endDate"],
      });
    }
    if (data.leaveType === "SICK" && (!data.attachments || data.attachments.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Supporting documentation is required for sick leave.",
        path: ["attachments"],
      });
    }
  });

export type CreateLeaveApplicationInput = z.infer<typeof createLeaveApplicationSchema>;

export const leaveSummarySchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

export type LeaveSummaryInput = z.infer<typeof leaveSummarySchema>;
