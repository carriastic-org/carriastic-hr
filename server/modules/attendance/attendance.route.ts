import { protectedProcedure } from "@/server/api/trpc";
import { router } from "@/server/trpc";

import { attendanceController } from "./attendance.controller";
import { AttendanceValidation } from "./attendance.validation";

export const attendanceRouter = router({
  today: protectedProcedure.query(({ ctx }) =>
    attendanceController.today(ctx),
  ),
  startDay: protectedProcedure
    .input(AttendanceValidation.startDay)
    .mutation(({ ctx, input }) => attendanceController.startDay(ctx, input)),
  completeDay: protectedProcedure
    .input(AttendanceValidation.completeDay)
    .mutation(({ ctx, input }) => attendanceController.completeDay(ctx, input)),
  history: protectedProcedure
    .input(AttendanceValidation.history)
    .query(({ ctx, input }) => attendanceController.history(ctx, input)),
});
