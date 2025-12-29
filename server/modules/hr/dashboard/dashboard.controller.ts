import type { TRPCContext } from "@/server/api/trpc";
import type { HrDashboardOverviewInput } from "./dashboard.validation";
import { hrDashboardService } from "./dashboard.service";

export const hrDashboardController = {
  overview: ({ ctx, input }: { ctx: TRPCContext; input?: HrDashboardOverviewInput }) =>
    hrDashboardService.overview(ctx, input),
};
