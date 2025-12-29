import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { HrReportsController } from "./reports.controller";
import { hrReportsFilterSchema } from "@/server/modules/report/report.validation";

export const hrReportRouter = createTRPCRouter({
  overview: protectedProcedure
    .input(hrReportsFilterSchema)
    .query(({ ctx, input }) => HrReportsController.overview(ctx, input)),
});
