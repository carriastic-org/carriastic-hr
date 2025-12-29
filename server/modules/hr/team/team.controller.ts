import type { TRPCContext } from "@/server/api/trpc";
import type {
  HrAssignTeamLeadInput,
  HrAssignTeamMembersInput,
  HrCreateTeamInput,
} from "@/types/hr-team";
import { hrTeamService } from "./team.service";

export const hrTeamController = {
  overview: ({ ctx }: { ctx: TRPCContext }) => hrTeamService.overview(ctx),
  createTeam: ({ ctx, input }: { ctx: TRPCContext; input: HrCreateTeamInput }) =>
    hrTeamService.createTeam(ctx, input),
  assignLead: ({ ctx, input }: { ctx: TRPCContext; input: HrAssignTeamLeadInput }) =>
    hrTeamService.assignLead(ctx, input),
  assignMembers: ({ ctx, input }: { ctx: TRPCContext; input: HrAssignTeamMembersInput }) =>
    hrTeamService.assignMembers(ctx, input),
};
