import type { TRPCContext } from "@/server/api/trpc";
import { leaveService } from "./leave.service";
import type {
  CreateLeaveApplicationInput,
  LeaveSummaryInput,
} from "./leave.validation";

export const leaveController = {
  summary: ({ ctx, input }: { ctx: TRPCContext; input?: LeaveSummaryInput }) =>
    leaveService.summary(ctx, input),
  submitApplication: ({ ctx, input }: { ctx: TRPCContext; input: CreateLeaveApplicationInput }) =>
    leaveService.submitApplication(ctx, input),
};
