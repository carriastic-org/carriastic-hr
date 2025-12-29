import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hrAttendanceController } from "./attendance.controller";
import {
  hrAttendanceHistorySchema,
  hrAttendanceManualEntrySchema,
  hrAttendanceOverviewSchema,
} from "./attendance.validation";

export const hrAttendanceRouter = createTRPCRouter({
  overview: protectedProcedure
    .input(hrAttendanceOverviewSchema)
    .query(({ ctx, input }) => hrAttendanceController.overview({ ctx, input })),
  history: protectedProcedure
    .input(hrAttendanceHistorySchema)
    .query(({ ctx, input }) => hrAttendanceController.history({ ctx, input })),
  recordManualEntry: protectedProcedure
    .input(hrAttendanceManualEntrySchema)
    .mutation(({ ctx, input }) =>
      hrAttendanceController.recordManualEntry({ ctx, input }),
    ),
});
