import { NotificationAudience } from "@prisma/client";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hrAnnouncementsController } from "./announcements.controller";

const sendAnnouncementInput = z
  .object({
    title: z.string().min(3, "Add a topic for the announcement.").max(160),
    body: z.string().min(10, "Write a few details so the team has context.").max(2000),
    audience: z.nativeEnum(NotificationAudience).default(NotificationAudience.ORGANIZATION),
    recipientIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (value) =>
      value.audience !== NotificationAudience.INDIVIDUAL ||
      (value.recipientIds && value.recipientIds.length > 0),
    {
      path: ["recipientIds"],
      message: "Select at least one teammate.",
    },
  );

export const hrAnnouncementsRouter = createTRPCRouter({
  overview: protectedProcedure.query(({ ctx }) => hrAnnouncementsController.overview({ ctx })),
  send: protectedProcedure
    .input(sendAnnouncementInput)
    .mutation(({ ctx, input }) => hrAnnouncementsController.send({ ctx, input })),
});
