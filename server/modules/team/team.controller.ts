import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import { teamService } from "./team.service";

const buildInput = (ctx: TRPCContext) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return {
    userId: ctx.session.user.id,
    timezone: ctx.session.user.organization?.timezone ?? null,
  };
};

export const teamController = {
  overview: (ctx: TRPCContext) => teamService.overview(buildInput(ctx)),
};
