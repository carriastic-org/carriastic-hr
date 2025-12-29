import { TRPCError } from "@trpc/server";
import { EmploymentType, Gender, WorkModel } from "@prisma/client";
import bcrypt from "bcryptjs";

import type { TRPCContext } from "@/server/api/trpc";
import type { UpdateProfileInput, UpdatePasswordInput } from "./user.validation";

export type UserProfileResponse = {
  id: string;
  email: string;
  phone: string | null;
  organizationName: string;
  lastLoginAt: Date | null;
    profile: {
      firstName: string;
      lastName: string;
      preferredName: string | null;
      gender: string | null;
      dateOfBirth: Date | null;
      nationality: string | null;
      currentAddress: string | null;
      permanentAddress: string | null;
      workModel: string | null;
      personalEmail: string | null;
      workEmail: string | null;
      personalPhone: string | null;
      workPhone: string | null;
      profilePhotoUrl: string | null;
      bio: string | null;
  } | null;
  employment: {
    employeeCode: string | null;
    designation: string;
    employmentType: string;
    startDate: Date;
    status: string;
    departmentName: string | null;
    teamName: string | null;
    managerName: string | null;
    primaryLocation: string | null;
  } | null;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
    alternatePhone: string | null;
  } | null;
  bankAccount: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    branch: string | null;
    swiftCode: string | null;
    taxId: string | null;
  } | null;
};

export const userService = {
  async getProfile(ctx: TRPCContext): Promise<UserProfileResponse> {
    if (!ctx.session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        lastLoginAt: true,
        organization: {
          select: {
            name: true,
          },
        },
        profile: {
          select: {
            firstName: true,
            lastName: true,
            preferredName: true,
            gender: true,
            dateOfBirth: true,
            nationality: true,
            currentAddress: true,
            permanentAddress: true,
            workModel: true,
            personalEmail: true,
            workEmail: true,
            personalPhone: true,
            workPhone: true,
            profilePhotoUrl: true,
            bio: true,
          },
        },
        employment: {
          select: {
            employeeCode: true,
            designation: true,
            employmentType: true,
            startDate: true,
            status: true,
            primaryLocation: true,
            department: {
              select: {
                name: true,
              },
            },
            team: {
              select: {
                name: true,
              },
            },
            manager: {
              select: {
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    preferredName: true,
                  },
                },
              },
            },
          },
        },
        emergencyContacts: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: {
            name: true,
            phone: true,
            relationship: true,
            alternatePhone: true,
          },
        },
        bankAccounts: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: {
            bankName: true,
            accountHolder: true,
            accountNumber: true,
            branch: true,
            swiftCode: true,
            taxId: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const [emergencyContact] = user.emergencyContacts;
    const [bankAccount] = user.bankAccounts;

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      organizationName: user.organization?.name ?? "",
      lastLoginAt: user.lastLoginAt,
      profile: user.profile,
      employment: user.employment
        ? {
            employeeCode: user.employment.employeeCode,
            designation: user.employment.designation,
            employmentType: user.employment.employmentType,
            startDate: user.employment.startDate,
            status: user.employment.status,
            departmentName: user.employment.department?.name ?? null,
            teamName: user.employment.team?.name ?? null,
            managerName:
              user.employment.manager?.profile?.preferredName ??
              ([
                user.employment.manager?.profile?.firstName,
                user.employment.manager?.profile?.lastName,
              ]
                .filter(Boolean)
                .join(" ") || null),
            primaryLocation: user.employment.primaryLocation ?? null,
          }
        : null,
      emergencyContact: emergencyContact
        ? {
            ...emergencyContact,
          }
        : null,
      bankAccount: bankAccount
        ? {
            ...bankAccount,
          }
        : null,
    };
  },

  async updateProfile(ctx: TRPCContext, input: UpdateProfileInput) {
    if (!ctx.session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const parsed = input;
    const userId = ctx.session.user.id;
    const organizationId = ctx.session.user.organizationId;

    const prismaClient = ctx.prisma;

    await prismaClient.employeeProfile.upsert({
        where: { userId },
        update: {
          firstName: parsed.profile.firstName,
          lastName: parsed.profile.lastName,
          preferredName: parsed.profile.preferredName ?? null,
          gender: (parsed.profile.gender as Gender | null) ?? null,
          dateOfBirth: parsed.profile.dateOfBirth ?? null,
          nationality: parsed.profile.nationality ?? null,
          currentAddress: parsed.profile.currentAddress ?? null,
          permanentAddress: parsed.profile.permanentAddress ?? null,
          workModel: (parsed.profile.workModel as WorkModel | null) ?? null,
          personalEmail: parsed.profile.personalEmail ?? null,
          workEmail: parsed.profile.workEmail,
          personalPhone: parsed.profile.personalPhone ?? null,
          workPhone: parsed.profile.workPhone ?? null,
          bio: parsed.profile.bio ?? null,
        },
        create: {
          userId,
          firstName: parsed.profile.firstName,
          lastName: parsed.profile.lastName,
          preferredName: parsed.profile.preferredName ?? null,
          gender: (parsed.profile.gender as Gender | null) ?? null,
          dateOfBirth: parsed.profile.dateOfBirth ?? null,
          nationality: parsed.profile.nationality ?? null,
          currentAddress: parsed.profile.currentAddress ?? null,
          permanentAddress: parsed.profile.permanentAddress ?? null,
          workModel: (parsed.profile.workModel as WorkModel | null) ?? null,
          personalEmail: parsed.profile.personalEmail ?? null,
          workEmail: parsed.profile.workEmail,
          personalPhone: parsed.profile.personalPhone ?? null,
          workPhone: parsed.profile.workPhone ?? null,
          bio: parsed.profile.bio ?? null,
        },
      });

    let departmentId: string | null | undefined;
    if (parsed.employment.departmentName) {
      const department = await prismaClient.department.upsert({
          where: {
            organizationId_name: {
              organizationId,
              name: parsed.employment.departmentName,
            },
          },
          update: {},
          create: {
            organizationId,
            name: parsed.employment.departmentName,
          },
        });
      departmentId = department.id;
    }

    await prismaClient.employmentDetail.upsert({
        where: { userId },
        update: {
          employeeCode: parsed.employment.employeeCode,
          designation: parsed.employment.designation,
          employmentType: parsed.employment.employmentType as EmploymentType,
          startDate: parsed.employment.startDate ?? undefined,
          departmentId: departmentId ?? undefined,
          primaryLocation: parsed.employment.primaryLocation ?? null,
        },
        create: {
          userId,
          organizationId,
          employeeCode: parsed.employment.employeeCode,
          designation: parsed.employment.designation,
          employmentType: parsed.employment.employmentType as EmploymentType,
          status: "ACTIVE",
          startDate: parsed.employment.startDate ?? new Date(),
          departmentId: departmentId ?? undefined,
          primaryLocation: parsed.employment.primaryLocation ?? null,
        },
      });

    await prismaClient.user.update({
        where: { id: userId },
        data: {
          phone: parsed.profile.workPhone ?? parsed.profile.personalPhone ?? null,
        },
      });

    const existingEmergency = await prismaClient.emergencyContact.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });

    if (existingEmergency) {
      await prismaClient.emergencyContact.update({
          where: { id: existingEmergency.id },
          data: {
            name: parsed.emergencyContact.name,
            relationship: parsed.emergencyContact.relationship,
            phone: parsed.emergencyContact.phone,
            alternatePhone: parsed.emergencyContact.alternatePhone ?? null,
          },
        });
    } else {
      await prismaClient.emergencyContact.create({
          data: {
            userId,
            name: parsed.emergencyContact.name,
            relationship: parsed.emergencyContact.relationship,
            phone: parsed.emergencyContact.phone,
            alternatePhone: parsed.emergencyContact.alternatePhone ?? null,
          },
        });
    }

    const existingBank = await prismaClient.employeeBankAccount.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });

    if (existingBank) {
      await prismaClient.employeeBankAccount.update({
          where: { id: existingBank.id },
          data: {
            bankName: parsed.bankAccount.bankName,
            accountHolder: parsed.bankAccount.accountHolder,
            accountNumber: parsed.bankAccount.accountNumber,
            branch: parsed.bankAccount.branch ?? null,
            swiftCode: parsed.bankAccount.swiftCode ?? null,
            taxId: parsed.bankAccount.taxId ?? null,
          },
        });
    } else {
      await prismaClient.employeeBankAccount.create({
          data: {
            userId,
            bankName: parsed.bankAccount.bankName,
            accountHolder: parsed.bankAccount.accountHolder,
            accountNumber: parsed.bankAccount.accountNumber,
            branch: parsed.bankAccount.branch ?? null,
            swiftCode: parsed.bankAccount.swiftCode ?? null,
            taxId: parsed.bankAccount.taxId ?? null,
          },
        });
    }

    return this.getProfile(ctx);
  },

  async updatePassword(ctx: TRPCContext, input: UpdatePasswordInput) {
    if (!ctx.session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User account not found.",
      });
    }

    const isCurrentValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Current password is incorrect.",
      });
    }

    if (input.currentPassword === input.newPassword) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "New password must be different from the current password.",
      });
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 10);
    await ctx.prisma.user.update({
      where: { id: ctx.session.user.id },
      data: { passwordHash: hashedPassword },
    });

    return { message: "Password updated successfully." };
  },
};
