import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hrTeamController } from "./team.controller";

const createTeamInput = z.object({
  name: z.string().min(2, "Team name should be at least 2 characters."),
  departmentId: z.string().min(1, "Select a department."),
  description: z
    .string()
    .max(500, "Description should be 500 characters or fewer.")
    .optional()
    .nullable(),
});

const updateTeamInput = createTeamInput.extend({
  teamId: z.string().min(1, "Select a team to update."),
});

const assignLeadInput = z.object({
  teamId: z.string().min(1, "Team ID is required."),
  leadUserIds: z.array(z.string().min(1)).default([]),
});

const assignMembersInput = z.object({
  teamId: z.string().min(1, "Team ID is required."),
  memberUserIds: z.array(z.string().min(1)).default([]),
});

const deleteTeamInput = z.object({
  teamId: z.string().min(1, "Select a team to delete."),
});

export const hrTeamRouter = createTRPCRouter({
  overview: protectedProcedure.query(({ ctx }) => hrTeamController.overview({ ctx })),
  createTeam: protectedProcedure
    .input(createTeamInput)
    .mutation(({ ctx, input }) => hrTeamController.createTeam({ ctx, input })),
  updateTeam: protectedProcedure
    .input(updateTeamInput)
    .mutation(({ ctx, input }) => hrTeamController.updateTeam({ ctx, input })),
  assignLead: protectedProcedure
    .input(assignLeadInput)
    .mutation(({ ctx, input }) =>
      hrTeamController.assignLead({
        ctx,
        input: { teamId: input.teamId, leadUserIds: input.leadUserIds },
      }),
    ),
  assignMembers: protectedProcedure
    .input(assignMembersInput)
    .mutation(({ ctx, input }) => hrTeamController.assignMembers({ ctx, input })),
  deleteTeam: protectedProcedure
    .input(deleteTeamInput)
    .mutation(({ ctx, input }) => hrTeamController.deleteTeam({ ctx, input })),
});
