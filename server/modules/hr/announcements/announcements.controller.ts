import type { NotificationAudience } from "@prisma/client";

import type { TRPCContext } from "@/server/api/trpc";
import { hrAnnouncementsService } from "./announcements.service";

export const hrAnnouncementsController = {
  overview: ({ ctx }: { ctx: TRPCContext }) => hrAnnouncementsService.overview(ctx),
  send: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { title: string; body: string; audience: NotificationAudience; recipientIds?: string[] | null };
  }) => hrAnnouncementsService.send(ctx, input),
};
