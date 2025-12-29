import type { TRPCContext } from "@/server/api/trpc";
import type { HrCreateProjectInput, HrUpdateProjectInput } from "@/types/hr-project";
import { hrProjectService } from "./project.service";

export const hrProjectController = {
  overview: ({ ctx }: { ctx: TRPCContext }) => hrProjectService.overview(ctx),
  createProject: ({ ctx, input }: { ctx: TRPCContext; input: HrCreateProjectInput }) =>
    hrProjectService.createProject(ctx, input),
  updateProject: ({ ctx, input }: { ctx: TRPCContext; input: HrUpdateProjectInput }) =>
    hrProjectService.updateProject(ctx, input),
  deleteProject: ({ ctx, input }: { ctx: TRPCContext; input: { projectId: string } }) =>
    hrProjectService.deleteProject(ctx, input),
};
