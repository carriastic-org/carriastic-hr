import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import {
  MessageService,
  type DirectoryResponse,
  type MessageListResponse,
  type SendMessageResponse,
  type ThreadDetailResponse,
} from "./message.service";
import type {
  CreateThreadInput,
  DirectoryInput,
  MessageListInput,
  SendMessageInput,
  ThreadMessagesInput,
} from "./message.validation";

const execute = async <T>(resolver: () => Promise<T>, fallbackMessage: string) => {
  try {
    return await resolver();
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: fallbackMessage,
    });
  }
};

const list = (
  ctx: TRPCContext,
  input?: MessageListInput,
): Promise<MessageListResponse> =>
  execute(() => MessageService.listThreads(ctx, input), "Failed to load messages.");

const directory = (
  ctx: TRPCContext,
  input?: DirectoryInput,
): Promise<DirectoryResponse> =>
  execute(() => MessageService.directory(ctx, input), "Failed to load members.");

const threadMessages = (
  ctx: TRPCContext,
  input: ThreadMessagesInput,
): Promise<ThreadDetailResponse> =>
  execute(() => MessageService.getThreadDetail(ctx, input), "Failed to load thread.");

const sendMessage = (
  ctx: TRPCContext,
  input: SendMessageInput,
): Promise<SendMessageResponse> =>
  execute(() => MessageService.sendMessage(ctx, input), "Failed to send message.");

const createThread = (
  ctx: TRPCContext,
  input: CreateThreadInput,
): Promise<ThreadDetailResponse> =>
  execute(() => MessageService.createThread(ctx, input), "Failed to start chat.");

export const MessageController = {
  list,
  directory,
  threadMessages,
  sendMessage,
  createThread,
};
