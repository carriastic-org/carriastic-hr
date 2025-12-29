import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import { DashboardService } from "./dashboard.service";

const handleRequest = async <T>(resolver: () => Promise<T>, errorMessage: string) => {
  try {
    return await resolver();
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: errorMessage,
    });
  }
};

const buildDashboardInput = (ctx: TRPCContext) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const organizationId =
    ctx.session.user.organization?.id ?? ctx.session.user.organizationId;

  if (!organizationId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Missing organization context for dashboard.",
    });
  }

  return {
    userId: ctx.session.user.id,
    organizationId,
    organizationNameHint: ctx.session.user.organization?.name ?? null,
    userRole: ctx.session.user.role,
  };
};

const getOverview = (ctx: TRPCContext) =>
  handleRequest(
    () => DashboardService.getOverview(buildDashboardInput(ctx)),
    "Failed to load dashboard overview.",
  );

const getProfile = (ctx: TRPCContext) =>
  handleRequest(
    () => DashboardService.getProfileSection(buildDashboardInput(ctx)),
    "Failed to load profile section.",
  );

const getSummary = (ctx: TRPCContext) =>
  handleRequest(
    () => DashboardService.getSummarySection(buildDashboardInput(ctx)),
    "Failed to load summary section.",
  );

const getAttendance = (ctx: TRPCContext) =>
  handleRequest(
    () => DashboardService.getAttendanceSection(buildDashboardInput(ctx)),
    "Failed to load attendance section.",
  );

const getTimeOff = (ctx: TRPCContext) =>
  handleRequest(
    () => DashboardService.getTimeOffSection(buildDashboardInput(ctx)),
    "Failed to load time off section.",
  );

const getNotifications = (ctx: TRPCContext) =>
  handleRequest(
    () => DashboardService.getNotificationsSection(buildDashboardInput(ctx)),
    "Failed to load notifications.",
  );

const getHolidays = (ctx: TRPCContext) =>
  handleRequest(
    () => DashboardService.getHolidaysSection(buildDashboardInput(ctx)),
    "Failed to load holidays.",
  );

export const DashboardController = {
  getOverview,
  getProfile,
  getSummary,
  getAttendance,
  getTimeOff,
  getNotifications,
  getHolidays,
};
