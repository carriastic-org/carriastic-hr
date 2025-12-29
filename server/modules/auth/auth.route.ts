import { procedure, router } from "@/server/trpc";
import { z } from "zod";
import { AuthController } from "./auth.controller";
import { AuthZodSchema } from "./auth.validation";

export const AuthRouter = router({
  signupOptions: procedure.query(() => {
    return AuthController.getSignupOptionsHandler();
  }),

  register: procedure
    .input(AuthZodSchema.userRegistrationParams)
    .mutation(({ input }) => {
      return AuthController.registerUserHandler(input);
    }),

  sendUserResetPasswordLink: procedure
    .input(AuthZodSchema.userEmailParams)
    .mutation(({ input }) => {
      return AuthController.sendResetPasswordLinkHandler(input.email);
    }),

  updateUserPassword: procedure
    .input(AuthZodSchema.userPasswordUpdateParams)
    .mutation(({ input }) => {
      try {
        return AuthController.updateUserPasswordHandler(input);
      } catch (error) {
        throw new Error("Error updating password");
      }
    }),

  getUserRegistrationPayload: procedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      try {
        const decodedData = await AuthController.getUserRegistrationPayloadHandler(input);
        return decodedData;
      } catch (error) {
        throw error;
      }
    }),
  inviteDetails: procedure
    .input(AuthZodSchema.inviteTokenParams)
    .query(({ input }) => AuthController.getInviteDetailsHandler(input.token)),
  completeInvite: procedure
    .input(AuthZodSchema.completeInviteParams)
    .mutation(({ input }) => AuthController.completeInviteHandler(input)),

  IsAuthorisationChange: procedure.query(async () => {
    try {
      return await AuthController.getIsAuthorisationChange();
    } catch (error) {
      throw error;
    }
  }),

  IsTrialExpired: procedure
    .input(z.object({ email: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await AuthController.getIsTrialExpired(input.email);
        return result;
      } catch (error) {
        throw error;
      }
    }),
});
