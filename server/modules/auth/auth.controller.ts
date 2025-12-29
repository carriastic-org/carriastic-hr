import { UserPasswordUpdateType } from "@/types/types";
import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import { AuthService } from "./auth.service";
import type { CompleteInviteInput, RegisterInput } from "./auth.validation";
import { getJwtSecret } from "@/lib/env";

const getSignupOptionsHandler = async () => {
  try {
    const options = await AuthService.getSignupOptions();
    return options;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to load signup options",
    });
  }
};

const registerUserHandler = async (input: RegisterInput) => {
  try {
    const result = await AuthService.registerUser(input);
    return result;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create account",
    });
  }
};

const sendResetPasswordLinkHandler = async (email: string) => {
  try {
    const user = await AuthService.sendResetPasswordLinkService(email);
    if (email === user?.email) {
      const jwtSecret = getJwtSecret();
      const generatedJwtSecret = jwtSecret + user?.id;

      const payload = {
        email: user?.email,
        id: user?.id,
      };

      const token = jwt.sign(payload, generatedJwtSecret, {
        expiresIn: "24h",
      });
    } else {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "User is not registered!",
      });
    }
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    } else {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send email!",
      });
    }
  }
};

const updateUserPasswordHandler = async (input: UserPasswordUpdateType) => {
  if (!input.userId || !input.password) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "User ID and password are required",
    });
  }

  try {
    const result = await AuthService.updateUserPassworIntoDb(input);
    if (!result) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update user password",
      });
    }

    return {
      message: "Password updated successfully",
    };
  } catch (error) {
    throw error;
  }
};

export const getUserRegistrationPayloadHandler = async ({
  token,
}: {
  token: string;
}) => {
  try {
    const result = await AuthService.tokenValidate({ token });
    return result;
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to decode token",
    });
  }
};

const getIsAuthorisationChange = async () => {
  try {
    const result = await AuthService.isAuthorisationChange();
    return result;
  } catch (error) {}
};

const getIsTrialExpired = async (email: string) => {
  try {
    const result = await AuthService.isTrialExpired(email);
    return result;
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to decode token",
    });
  }
};

const getInviteDetailsHandler = async (token: string) => {
  try {
    return await AuthService.getInviteDetails(token);
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to load invitation details.",
    });
  }
};

const completeInviteHandler = async (input: CompleteInviteInput) => {
  try {
    return await AuthService.completeInvite(input);
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to complete invitation.",
    });
  }
};

export const AuthController = {
  getSignupOptionsHandler,
  registerUserHandler,
  sendResetPasswordLinkHandler,
  updateUserPasswordHandler,
  getUserRegistrationPayloadHandler,
  getIsAuthorisationChange,
  getIsTrialExpired,
  getInviteDetailsHandler,
  completeInviteHandler,
};
