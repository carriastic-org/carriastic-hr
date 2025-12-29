import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { WEEKDAY_OPTIONS } from "@/types/hr-work";
import { hrWorkController } from "./work.controller";

const dateSchema = z
  .string()
  .min(1, "Select a date.")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Provide a valid date.");

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:MM format.");

const weekdayEnum = z.enum(WEEKDAY_OPTIONS);

const createHolidayInput = z.object({
  title: z.string().min(2, "Holiday title must be at least 2 characters."),
  date: dateSchema,
  description: z.string().max(240).optional().nullable(),
});

const updateWorkingHoursInput = z.object({
  onsiteStartTime: timeSchema,
  onsiteEndTime: timeSchema,
  remoteStartTime: timeSchema,
  remoteEndTime: timeSchema,
});

const updateWeekScheduleInput = z
  .object({
    workingDays: z.array(weekdayEnum),
    weekendDays: z.array(weekdayEnum),
  })
  .refine(
    (value) => {
      const intersection = value.workingDays.filter((day) =>
        value.weekendDays.includes(day),
      );
      return intersection.length === 0;
    },
    {
      message: "Days cannot be marked as both working and weekend.",
      path: ["workingDays"],
    },
  );

export const hrWorkRouter = createTRPCRouter({
  overview: protectedProcedure.query(({ ctx }) => hrWorkController.overview({ ctx })),
  createHoliday: protectedProcedure
    .input(createHolidayInput)
    .mutation(({ ctx, input }) => hrWorkController.createHoliday({ ctx, input })),
  updateWorkingHours: protectedProcedure
    .input(updateWorkingHoursInput)
    .mutation(({ ctx, input }) => hrWorkController.updateWorkingHours({ ctx, input })),
  updateWeekSchedule: protectedProcedure
    .input(updateWeekScheduleInput)
    .mutation(({ ctx, input }) => hrWorkController.updateWeekSchedule({ ctx, input })),
});
