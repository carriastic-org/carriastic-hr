import type { TRPCContext } from "@/server/api/trpc";
import { hrLeaveService } from "./leave.service";
import type {
  HrLeaveListInput,
  HrLeaveUpdateStatusInput,
} from "./leave.validation";

export const hrLeaveController = {
  list: ({ ctx, input }: { ctx: TRPCContext; input?: HrLeaveListInput }) =>
    hrLeaveService.listRequests(ctx, input),
  updateStatus: ({ ctx, input }: { ctx: TRPCContext; input: HrLeaveUpdateStatusInput }) =>
    hrLeaveService.updateStatus(ctx, input),
  pendingCount: ({ ctx }: { ctx: TRPCContext }) => hrLeaveService.pendingCount(ctx),
};
