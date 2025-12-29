import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hrLeaveController } from "./leave.controller";
import { hrLeaveListInput, hrLeaveUpdateStatusInput } from "./leave.validation";

export const hrLeaveRouter = createTRPCRouter({
  list: protectedProcedure
    .input(hrLeaveListInput.optional())
    .query(({ ctx, input }) => hrLeaveController.list({ ctx, input })),
  updateStatus: protectedProcedure
    .input(hrLeaveUpdateStatusInput)
    .mutation(({ ctx, input }) => hrLeaveController.updateStatus({ ctx, input })),
  pendingCount: protectedProcedure.query(({ ctx }) =>
    hrLeaveController.pendingCount({
      ctx,
    }),
  ),
});
