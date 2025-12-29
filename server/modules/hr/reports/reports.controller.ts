import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import { HrReportsService, type HrReportOverview } from "./reports.service";

type OverviewInput = Parameters<typeof HrReportsService.getOverview>[1];

const handle = async <T>(resolver: () => Promise<T>, message: string) => {
  try {
    return await resolver();
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message,
    });
  }
};

const overview = (ctx: TRPCContext, input?: OverviewInput): Promise<HrReportOverview> =>
  handle(() => HrReportsService.getOverview(ctx, input ?? {}), "Failed to load reports overview.");

export const HrReportsController = {
  overview,
};
