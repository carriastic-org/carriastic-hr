import { protectedProcedure } from "@/server/api/trpc";
import { router } from "@/server/trpc";

import { DashboardController } from "./dashboard.controller";

export const dashboardRouter = router({
  overview: protectedProcedure.query(({ ctx }) =>
    DashboardController.getOverview(ctx),
  ),
  profile: protectedProcedure.query(({ ctx }) =>
    DashboardController.getProfile(ctx),
  ),
  summary: protectedProcedure.query(({ ctx }) =>
    DashboardController.getSummary(ctx),
  ),
  attendance: protectedProcedure.query(({ ctx }) =>
    DashboardController.getAttendance(ctx),
  ),
  timeOff: protectedProcedure.query(({ ctx }) =>
    DashboardController.getTimeOff(ctx),
  ),
  notifications: protectedProcedure.query(({ ctx }) =>
    DashboardController.getNotifications(ctx),
  ),
  holidays: protectedProcedure.query(({ ctx }) =>
    DashboardController.getHolidays(ctx),
  ),
});
