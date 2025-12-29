import type { UserInfoParam } from "@/types/types";
import { nextAuthOptions } from "@/app/utils/next-auth-options";
import { prisma } from "@/prisma";
import { EmploymentStatus, EmploymentType, Prisma } from "@prisma/client";
import { type UserPasswordUpdateType } from "@/types/types";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getServerSession } from "next-auth";
import type { RegisterInput } from "./auth.validation";
import { hashToken } from "@/server/utils/token";
import { getJwtSecret } from "@/lib/env";

const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeText = (value: string) => value.trim();
const sanitizeUrl = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const loadInviteByToken = async (token: string) => {
  const tokenHash = hashToken(token);

  return prisma.invitationToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          profile: {
            select: {
              firstName: true,
              lastName: true,
              preferredName: true,
              profilePhotoUrl: true,
            },
          },
          employment: {
            select: {
              designation: true,
              startDate: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });
};

const getOrganizationOrThrow = async (organizationId: string) => {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });

  if (!organization) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selected organization is no longer available.",
    });
  }

  return organization;
};

const getDepartmentOrThrow = async (organizationId: string, departmentId: string) => {
  const department = await prisma.department.findFirst({
    where: {
      id: departmentId,
      organizationId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!department) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selected department is no longer available.",
    });
  }

  return department;
};

const registerUser = async (input: RegisterInput) => {
  const email = normalizeEmail(input.email);
  const firstName = normalizeText(input.firstName);
  const lastName = normalizeText(input.lastName);
  const designation = normalizeText(input.designation);
  const employeeCode = normalizeText(input.employeeId);
  const organizationId = input.organizationId?.trim?.() ?? "";
  const departmentId = input.departmentId?.trim?.() ?? "";
  const profilePhotoUrl = sanitizeUrl(input.profilePhotoUrl);

  if (!firstName || !lastName || !designation || !employeeCode) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "All fields are required.",
    });
  }

  if (!organizationId || !departmentId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Organization and department selections are required.",
    });
  }

  try {
    const organization = await getOrganizationOrThrow(organizationId);
    const department = await getDepartmentOrThrow(organization.id, departmentId);

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An account already exists for this email address.",
      });
    }

    const duplicateEmployee = await prisma.employmentDetail.findFirst({
      where: {
        organizationId: organization.id,
        employeeCode,
      },
      select: { id: true },
    });

    if (duplicateEmployee) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This employee ID is already registered in your workspace.",
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email,
          passwordHash,
          role: "EMPLOYEE",
          status: EmploymentStatus.INACTIVE,
          invitedAt: new Date(),
        },
        select: {
          id: true,
        },
      });

      await tx.employeeProfile.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          preferredName: firstName,
          workEmail: email,
          profilePhotoUrl,
        },
      });

      await tx.employmentDetail.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          employeeCode,
          designation,
          employmentType: EmploymentType.FULL_TIME,
          status: EmploymentStatus.INACTIVE,
          startDate: new Date(),
          departmentId: department.id,
        },
      });

      return user;
    });

    return {
      userId: createdUser.id,
      email,
      organizationId: organization.id,
      organizationName: organization.name,
      departmentName: department.name,
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This email or employee ID is already registered.",
      });
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to create account right now.",
    });
  }
};

const getSignupOptions = async () => {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        departments: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      organizations,
    };
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to load signup options.",
    });
  }
};

const sendResetPasswordLinkService = async (email: string) => {
  if (!email) {
    return null;
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        email,
      },
      select: {
        email: true,
        id: true,
      },
    });

    return user;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to send email!",
    });
  }
};

const updateUserPassworIntoDb = async (input: UserPasswordUpdateType) => {
  const { userId, password } = input;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const updatedAccount = await prisma.user.updateMany({
      where: {
        id: userId,
      },
      data: {
        passwordHash: hashedPassword,
      },
    });

    if (updatedAccount.count === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `User with id ${userId} not found`,
      });
    }

    return { message: "Password updated successfully" };
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update password into db",
    });
  }
};

const tokenValidate = async ({ token }: { token: string }) => {
  try {
    const jwtSecret = getJwtSecret();
    const decoded = jwt.verify(token, jwtSecret) as UserInfoParam;

    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Token has expired",
      });
    }
    return decoded;
  } catch (error) {
    void error;
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid token",
    });
  }
};

const getInviteDetails = async (token: string) => {
  const record = await loadInviteByToken(token);

  if (!record || !record.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or expired invitation link.",
    });
  }

  return {
    token,
    userId: record.user.id,
    email: record.user.email,
    role: record.user.role,
    organizationId: record.user.organizationId,
    organizationName: record.user.organization?.name ?? "Your organization",
    departmentId: record.user.employment?.department?.id ?? null,
    departmentName: record.user.employment?.department?.name ?? null,
    designation: record.user.employment?.designation ?? null,
    startDate: record.user.employment?.startDate?.toISOString() ?? null,
    firstName: record.user.profile?.firstName ?? "",
    lastName: record.user.profile?.lastName ?? "",
    preferredName: record.user.profile?.preferredName ?? "",
    profilePhotoUrl: record.user.profile?.profilePhotoUrl ?? null,
    expiresAt: record.expiresAt.toISOString(),
  };
};

const completeInvite = async ({
  token,
  firstName,
  lastName,
  preferredName,
  password,
  profilePhotoUrl,
}: {
  token: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  password: string;
  profilePhotoUrl?: string | null;
}) => {
  const record = await loadInviteByToken(token);

  if (!record || !record.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or expired invitation link.",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const normalizedFirstName = firstName.trim();
  const normalizedLastName = lastName.trim();
  const normalizedPreferredName = preferredName?.trim() || null;
  const normalizedPhoto = profilePhotoUrl?.trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: hashedPassword,
        status: EmploymentStatus.ACTIVE,
        invitedAt: null,
      },
    });

    await tx.employeeProfile.upsert({
      where: { userId: record.userId },
      update: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        preferredName: normalizedPreferredName ?? normalizedFirstName,
        profilePhotoUrl: normalizedPhoto ?? record.user.profile?.profilePhotoUrl ?? null,
      },
      create: {
        userId: record.userId,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        preferredName: normalizedPreferredName ?? normalizedFirstName,
        workEmail: record.user.email,
        profilePhotoUrl: normalizedPhoto,
      },
    });

    await tx.employmentDetail.updateMany({
      where: { userId: record.userId },
      data: {
        status: EmploymentStatus.ACTIVE,
      },
    });

    await tx.invitationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    await tx.invitationToken.deleteMany({
      where: {
        userId: record.userId,
        usedAt: null,
      },
    });
  });

  return {
    message: "Invitation accepted. You can now sign in.",
  };
};

const isAuthorisationChange = async () => {
  const session = await getServerSession(nextAuthOptions);

  if (!session?.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You are not authorized to perform this action",
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  return session.user.role !== user.role;
};

const isTrialExpired = async (email: string) => {
  const trialDurationDays = Number(process.env.NEXT_PUBLIC_TRIAL_DURATION_DAYS ?? 10);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      updatedAt: true,
      organization: {
        select: {
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  const contractDate = user.organization?.createdAt ?? user.updatedAt ?? new Date();
  const trialEndDate = new Date(contractDate.getTime() + trialDurationDays * MILLISECONDS_IN_DAY);

  const isTrialExpiredFlag = trialEndDate.getTime() < Date.now();
  const isVisibilityPrivate = process.env.NEXT_PUBLIC_ACCOUNT_VISIBILITY === "PRIVATE";

  return {
    isTrialExpired: isTrialExpiredFlag || isVisibilityPrivate,
    role: user.role,
    id: user.id,
    updated_at: user.updatedAt,
    twoFactor: false,
  };
};

export const AuthService = {
  registerUser,
  getSignupOptions,
  sendResetPasswordLinkService,
  updateUserPassworIntoDb,
  tokenValidate,
  getInviteDetails,
  completeInvite,
  isAuthorisationChange,
  isTrialExpired,
};
