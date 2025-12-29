import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import {
  ReportService,
  type DailyHistoryResponse,
  type MonthlyHistoryResponse,
} from "./report.service";

type DailyInput = Parameters<typeof ReportService.submitDaily>[1];
type MonthlyInput = Parameters<typeof ReportService.submitMonthly>[1];
type DailyHistoryInput = Parameters<typeof ReportService.getDailyHistory>[1];
type MonthlyHistoryInput = Parameters<typeof ReportService.getMonthlyHistory>[1];

const safeExecute = async <T>(resolver: () => Promise<T>, message: string) => {
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

const submitDaily = (ctx: TRPCContext, input: DailyInput) =>
  safeExecute(() => ReportService.submitDaily(ctx, input), "Failed to submit daily report.");

const submitMonthly = (ctx: TRPCContext, input: MonthlyInput) =>
  safeExecute(() => ReportService.submitMonthly(ctx, input), "Failed to submit monthly report.");

const getDailyHistory = (ctx: TRPCContext, input?: DailyHistoryInput): Promise<DailyHistoryResponse> =>
  safeExecute(() => ReportService.getDailyHistory(ctx, input ?? {}), "Failed to load daily reports.");

const getMonthlyHistory = (
  ctx: TRPCContext,
  input?: MonthlyHistoryInput,
): Promise<MonthlyHistoryResponse> =>
  safeExecute(
    () => ReportService.getMonthlyHistory(ctx, input ?? {}),
    "Failed to load monthly reports.",
  );

export const ReportController = {
  submitDaily,
  submitMonthly,
  getDailyHistory,
  getMonthlyHistory,
};
