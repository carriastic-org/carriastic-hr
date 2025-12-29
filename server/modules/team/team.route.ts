import { protectedProcedure } from "@/server/api/trpc";
import { router } from "@/server/trpc";

import { teamController } from "./team.controller";

export const teamRouter = router({
  overview: protectedProcedure.query(({ ctx }) => teamController.overview(ctx)),
});
