import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { ReportController } from "./report.controller";
import {
  dailyHistorySchema,
  monthlyHistorySchema,
  submitDailyReportSchema,
  submitMonthlyReportSchema,
} from "./report.validation";

export const reportRouter = createTRPCRouter({
  submitDaily: protectedProcedure
    .input(submitDailyReportSchema)
    .mutation(({ ctx, input }) => ReportController.submitDaily(ctx, input)),
  submitMonthly: protectedProcedure
    .input(submitMonthlyReportSchema)
    .mutation(({ ctx, input }) => ReportController.submitMonthly(ctx, input)),
  dailyHistory: protectedProcedure
    .input(dailyHistorySchema)
    .query(({ ctx, input }) => ReportController.getDailyHistory(ctx, input)),
  monthlyHistory: protectedProcedure
    .input(monthlyHistorySchema)
    .query(({ ctx, input }) => ReportController.getMonthlyHistory(ctx, input)),
});
