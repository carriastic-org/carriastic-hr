import { ProjectStatus } from "@prisma/client";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hrProjectController } from "./project.controller";

const baseProjectInput = z.object({
  name: z.string().min(3, "Project name should be at least 3 characters long."),
  code: z
    .string()
    .max(64, "Project code should be 64 characters or fewer.")
    .optional()
    .nullable(),
  description: z
    .string()
    .max(2000, "Description should be 2000 characters or fewer.")
    .optional()
    .nullable(),
  clientName: z
    .string()
    .max(128, "Client name should be 128 characters or fewer.")
    .optional()
    .nullable(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  projectManagerId: z.string().optional().nullable(),
  memberUserIds: z.array(z.string().min(1)).optional().default([]),
});

const createProjectInput = baseProjectInput;

const updateProjectInput = baseProjectInput.extend({
  projectId: z.string().min(1, "Project ID is required."),
});

const deleteProjectInput = z.object({
  projectId: z.string().min(1, "Project ID is required."),
});

export const hrProjectRouter = createTRPCRouter({
  overview: protectedProcedure.query(({ ctx }) => hrProjectController.overview({ ctx })),
  createProject: protectedProcedure
    .input(createProjectInput)
    .mutation(({ ctx, input }) => hrProjectController.createProject({ ctx, input })),
  updateProject: protectedProcedure
    .input(updateProjectInput)
    .mutation(({ ctx, input }) => hrProjectController.updateProject({ ctx, input })),
  deleteProject: protectedProcedure
    .input(deleteProjectInput)
    .mutation(({ ctx, input }) => hrProjectController.deleteProject({ ctx, input })),
});
