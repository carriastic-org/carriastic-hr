import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hrDashboardController } from "./dashboard.controller";
import { hrDashboardOverviewSchema } from "./dashboard.validation";

export const hrDashboardRouter = createTRPCRouter({
  overview: protectedProcedure
    .input(hrDashboardOverviewSchema)
    .query(({ ctx, input }) =>
      hrDashboardController.overview({
        ctx,
        input: input ?? {},
      }),
    ),
});
