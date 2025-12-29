import type { TRPCContext } from "@/server/api/trpc";
import type {
  HrAssignDepartmentHeadInput,
  HrAssignDepartmentMembersInput,
  HrCreateDepartmentInput,
  HrUpdateDepartmentInput,
} from "@/types/hr-department";
import { hrDepartmentService } from "./department.service";

export const hrDepartmentController = {
  overview: ({ ctx }: { ctx: TRPCContext }) => hrDepartmentService.overview(ctx),
  create: ({ ctx, input }: { ctx: TRPCContext; input: HrCreateDepartmentInput }) =>
    hrDepartmentService.createDepartment(ctx, input),
  update: ({ ctx, input }: { ctx: TRPCContext; input: HrUpdateDepartmentInput }) =>
    hrDepartmentService.updateDepartment(ctx, input),
  assignHead: ({ ctx, input }: { ctx: TRPCContext; input: HrAssignDepartmentHeadInput }) =>
    hrDepartmentService.assignHead(ctx, input),
  assignMembers: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: HrAssignDepartmentMembersInput;
  }) => hrDepartmentService.assignMembers(ctx, input),
};
