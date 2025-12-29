import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hrOrganizationController } from "./organization.controller";

const managementInput = z.object({
  organizationId: z.string().min(1).optional(),
});

const updateOrganizationInput = z.object({
  name: z.string().min(3, "Organization name is required."),
  domain: z
    .string()
    .min(3, "Domain must be at least 3 characters.")
    .max(120)
    .optional()
    .nullable(),
  timezone: z.string().min(2).max(120).optional().nullable(),
  locale: z.string().min(2).max(32).optional().nullable(),
  organizationId: z.string().min(1).optional().nullable(),
  logoUrl: z
    .string()
    .min(5, "Organization logo is required.")
    .max(1024, "Logo URL must be less than 1024 characters."),
});

const organizationUserInput = z.object({
  userId: z.string().min(1, "Select a team member."),
});

const createOrganizationInput = z.object({
  name: z.string().min(3, "Organization name is required."),
  domain: z
    .string()
    .min(3, "Domain must be at least 3 characters.")
    .max(120)
    .optional()
    .nullable(),
  timezone: z.string().min(2).max(120).optional().nullable(),
  locale: z.string().min(2).max(32).optional().nullable(),
  ownerName: z.string().min(3, "Owner name is required."),
  ownerEmail: z.string().email("Provide a valid email address."),
  ownerPhone: z
    .string()
    .min(7, "Provide a valid phone number.")
    .max(32)
    .regex(/^\+?[0-9()\s-]{7,32}$/, "Use digits, spaces, parentheses, or dashes.")
    .optional()
    .nullable(),
  ownerDesignation: z.string().max(120).optional().nullable(),
  sendInvite: z.boolean().optional(),
  logoUrl: z
    .string()
    .min(5, "Logo URL must be at least 5 characters.")
    .max(1024, "Logo URL must be less than 1024 characters.")
    .optional()
    .nullable(),
});

const deleteOrganizationInput = z.object({
  organizationId: z.string().min(1, "Organization is required."),
  password: z.string().min(6, "Password is required."),
});

export const hrOrganizationRouter = createTRPCRouter({
  management: protectedProcedure
    .input(managementInput.optional())
    .query(({ ctx, input }) =>
      hrOrganizationController.management({ ctx, input }),
    ),
  list: protectedProcedure.query(({ ctx }) =>
    hrOrganizationController.list({ ctx }),
  ),
  updateDetails: protectedProcedure
    .input(updateOrganizationInput)
    .mutation(({ ctx, input }) =>
      hrOrganizationController.updateDetails({ ctx, input }),
    ),
  addAdmin: protectedProcedure
    .input(organizationUserInput)
    .mutation(({ ctx, input }) =>
      hrOrganizationController.addAdmin({ ctx, userId: input.userId }),
    ),
  removeAdmin: protectedProcedure
    .input(organizationUserInput)
    .mutation(({ ctx, input }) =>
      hrOrganizationController.removeAdmin({ ctx, userId: input.userId }),
    ),
  createOrganization: protectedProcedure
    .input(createOrganizationInput)
    .mutation(({ ctx, input }) =>
      hrOrganizationController.createOrganization({ ctx, input }),
    ),
  deleteOrganization: protectedProcedure
    .input(deleteOrganizationInput)
    .mutation(({ ctx, input }) =>
      hrOrganizationController.deleteOrganization({ ctx, input }),
    ),
});
