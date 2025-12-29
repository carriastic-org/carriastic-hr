import type { Prisma } from "@prisma/client";

export const authUserSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  organizationId: true,
  lastLoginAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      domain: true,
      timezone: true,
      logoUrl: true,
    },
  },
  profile: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      profilePhotoUrl: true,
      workEmail: true,
      workPhone: true,
    },
  },
  employment: {
    select: {
      id: true,
      employeeCode: true,
      designation: true,
      employmentType: true,
      startDate: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export type AuthUser = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;
