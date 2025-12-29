import type { TRPCContext } from "@/server/api/trpc";
import type {
  HrEmployeeCompensationUpdateInput,
  HrEmployeeInviteInput,
  HrEmployeeLeaveQuotaUpdateInput,
  HrEmployeeUpdateInput,
} from "@/types/hr-admin";
import { hrEmployeesService } from "./employees.service";

export const hrEmployeesController = {
  dashboard: ({ ctx }: { ctx: TRPCContext }) => hrEmployeesService.getDashboard(ctx),
  profile: ({ ctx, employeeId }: { ctx: TRPCContext; employeeId: string }) =>
    hrEmployeesService.getEmployeeProfile(ctx, employeeId),
  form: ({ ctx, employeeId }: { ctx: TRPCContext; employeeId: string }) =>
    hrEmployeesService.getEmployeeForm(ctx, employeeId),
  update: ({ ctx, input }: { ctx: TRPCContext; input: HrEmployeeUpdateInput }) =>
    hrEmployeesService.updateEmployee(ctx, input),
  updateLeaveQuota: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: HrEmployeeLeaveQuotaUpdateInput;
  }) => hrEmployeesService.updateLeaveBalances(ctx, input),
  delete: ({ ctx, employeeId }: { ctx: TRPCContext; employeeId: string }) =>
    hrEmployeesService.deleteEmployee(ctx, employeeId),
  invite: ({ ctx, input }: { ctx: TRPCContext; input: HrEmployeeInviteInput }) =>
    hrEmployeesService.inviteEmployee(ctx, input),
  updateCompensation: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: HrEmployeeCompensationUpdateInput;
  }) => hrEmployeesService.updateCompensation(ctx, input),
};
