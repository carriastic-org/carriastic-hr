import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

import { MessageController } from "./message.controller";
import { MessageValidation } from "./message.validation";

export const messageRouter = createTRPCRouter({
  list: protectedProcedure
    .input(MessageValidation.list)
    .query(({ ctx, input }) => MessageController.list(ctx, input)),
  directory: protectedProcedure
    .input(MessageValidation.directory)
    .query(({ ctx, input }) => MessageController.directory(ctx, input)),
  threadMessages: protectedProcedure
    .input(MessageValidation.threadMessages)
    .query(({ ctx, input }) => MessageController.threadMessages(ctx, input)),
  sendMessage: protectedProcedure
    .input(MessageValidation.sendMessage)
    .mutation(({ ctx, input }) => MessageController.sendMessage(ctx, input)),
  createThread: protectedProcedure
    .input(MessageValidation.createThread)
    .mutation(({ ctx, input }) => MessageController.createThread(ctx, input)),
});
