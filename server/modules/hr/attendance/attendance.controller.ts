import type { TRPCContext } from "@/server/api/trpc";
import { hrAttendanceService } from "./attendance.service";
import type {
  HrAttendanceHistoryInput,
  HrAttendanceManualEntryInput,
  HrAttendanceOverviewInput,
} from "./attendance.validation";

export const hrAttendanceController = {
  overview: ({ ctx, input }: { ctx: TRPCContext; input: HrAttendanceOverviewInput }) =>
    hrAttendanceService.overview(ctx, input),
  history: ({ ctx, input }: { ctx: TRPCContext; input: HrAttendanceHistoryInput }) =>
    hrAttendanceService.history(ctx, input),
  recordManualEntry: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: HrAttendanceManualEntryInput;
  }) => hrAttendanceService.recordManualEntry(ctx, input),
};
