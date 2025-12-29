import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { leaveController } from "./leave.controller";
import {
  createLeaveApplicationSchema,
  leaveSummarySchema,
} from "./leave.validation";

export const leaveRouter = createTRPCRouter({
  summary: protectedProcedure
    .input(leaveSummarySchema.optional())
    .query(({ ctx, input }) => leaveController.summary({ ctx, input })),
  submitApplication: protectedProcedure
    .input(createLeaveApplicationSchema)
    .mutation(({ ctx, input }) => leaveController.submitApplication({ ctx, input })),
});
