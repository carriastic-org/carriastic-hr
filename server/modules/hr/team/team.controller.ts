import type { TRPCContext } from "@/server/api/trpc";
import type {
  HrAssignTeamLeadInput,
  HrAssignTeamMembersInput,
  HrCreateTeamInput,
  HrDeleteTeamInput,
  HrUpdateTeamInput,
} from "@/types/hr-team";
import { hrTeamService } from "./team.service";

export const hrTeamController = {
  overview: ({ ctx }: { ctx: TRPCContext }) => hrTeamService.overview(ctx),
  createTeam: ({ ctx, input }: { ctx: TRPCContext; input: HrCreateTeamInput }) =>
    hrTeamService.createTeam(ctx, input),
  updateTeam: ({ ctx, input }: { ctx: TRPCContext; input: HrUpdateTeamInput }) =>
    hrTeamService.updateTeam(ctx, input),
  assignLead: ({ ctx, input }: { ctx: TRPCContext; input: HrAssignTeamLeadInput }) =>
    hrTeamService.assignLead(ctx, input),
  assignMembers: ({ ctx, input }: { ctx: TRPCContext; input: HrAssignTeamMembersInput }) =>
    hrTeamService.assignMembers(ctx, input),
  deleteTeam: ({ ctx, input }: { ctx: TRPCContext; input: HrDeleteTeamInput }) =>
    hrTeamService.deleteTeam(ctx, input),
};
