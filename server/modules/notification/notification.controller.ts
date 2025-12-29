import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import {
  NotificationService,
  type NotificationDetailResponse,
  type NotificationListInput,
  type NotificationListResponse,
  type NotificationMarkSeenResponse,
  type NotificationUnseenCountResponse,
} from "./notification.service";

const safeExecute = async <T>(resolver: () => Promise<T>, message: string) => {
  try {
    return await resolver();
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message,
    });
  }
};

const list = (
  ctx: TRPCContext,
  input?: NotificationListInput,
): Promise<NotificationListResponse> =>
  safeExecute(
    () => NotificationService.list(ctx, input),
    "Failed to load notifications.",
  );

const detail = (
  ctx: TRPCContext,
  input: { id: string },
): Promise<NotificationDetailResponse> =>
  safeExecute(
    () => NotificationService.getById(ctx, input),
    "Failed to load notification.",
  );

const unseenCount = (ctx: TRPCContext): Promise<NotificationUnseenCountResponse> =>
  safeExecute(
    () => NotificationService.getUnseenCount(ctx),
    "Failed to load notification count.",
  );

const markAsSeen = (
  ctx: TRPCContext,
  input: { id: string },
): Promise<NotificationMarkSeenResponse> =>
  safeExecute(
    () => NotificationService.markAsSeen(ctx, input),
    "Failed to update notification.",
  );

export const NotificationController = {
  list,
  detail,
  unseenCount,
  markAsSeen,
};
