import type { TRPCContext } from "@/server/api/trpc";
import type { WeekdayOption } from "@/types/hr-work";
import { hrWorkService } from "./work.service";

export const hrWorkController = {
  overview: ({ ctx }: { ctx: TRPCContext }) => hrWorkService.overview(ctx),
  createHoliday: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { title: string; date: string; description?: string | null };
  }) => hrWorkService.createHoliday(ctx, input),
  updateWorkingHours: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: {
      onsiteStartTime: string;
      onsiteEndTime: string;
      remoteStartTime: string;
      remoteEndTime: string;
    };
  }) => hrWorkService.updateWorkingHours(ctx, input),
  updateWeekSchedule: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { workingDays: WeekdayOption[]; weekendDays: WeekdayOption[] };
  }) => hrWorkService.updateWeekSchedule(ctx, input),
};
