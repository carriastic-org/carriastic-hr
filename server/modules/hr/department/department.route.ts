import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hrDepartmentController } from "./department.controller";

const createDepartmentInput = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters.").max(120),
  code: z
    .string()
    .min(2, "Code should be at least 2 characters.")
    .max(24, "Code should be at most 24 characters.")
    .optional()
    .nullable(),
  description: z
    .string()
    .max(500, "Description should be 500 characters or fewer.")
    .optional()
    .nullable(),
});

const updateDepartmentInput = createDepartmentInput.extend({
  departmentId: z.string().min(1, "Select a department to update."),
});

const assignHeadInput = z.object({
  departmentId: z.string().min(1, "Department ID is required."),
  headUserId: z.string().min(1, "Select a team member.").optional().nullable(),
});

const assignMembersInput = z.object({
  departmentId: z.string().min(1, "Department ID is required."),
  memberUserIds: z.array(z.string().min(1)).default([]),
});

export const hrDepartmentRouter = createTRPCRouter({
  overview: protectedProcedure.query(({ ctx }) =>
    hrDepartmentController.overview({ ctx }),
  ),
  create: protectedProcedure
    .input(createDepartmentInput)
    .mutation(({ ctx, input }) => hrDepartmentController.create({ ctx, input })),
  update: protectedProcedure
    .input(updateDepartmentInput)
    .mutation(({ ctx, input }) => hrDepartmentController.update({ ctx, input })),
  assignHead: protectedProcedure
    .input(assignHeadInput)
    .mutation(({ ctx, input }) =>
      hrDepartmentController.assignHead({ ctx, input }),
    ),
  assignMembers: protectedProcedure
    .input(assignMembersInput)
    .mutation(({ ctx, input }) =>
      hrDepartmentController.assignMembers({ ctx, input }),
    ),
});
