import type { TRPCContext } from "@/server/api/trpc";
import { userService } from "./user.service";
import type { UpdatePasswordInput, UpdateProfileInput } from "./user.validation";

export const userController = {
  profile: ({ ctx }: { ctx: TRPCContext }) => userService.getProfile(ctx),
  updateProfile: ({ ctx, input }: { ctx: TRPCContext; input: UpdateProfileInput }) =>
    userService.updateProfile(ctx, input),
  updatePassword: ({ ctx, input }: { ctx: TRPCContext; input: UpdatePasswordInput }) =>
    userService.updatePassword(ctx, input),
};
