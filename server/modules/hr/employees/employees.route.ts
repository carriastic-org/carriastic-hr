import { EmploymentType, UserRole, WorkModel } from "@prisma/client";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hrEmployeesController } from "./employees.controller";

const employeeIdParam = z.object({
  employeeId: z.string().min(1, "Employee ID is required."),
});

const updateEmployeeInput = z.object({
  employeeId: z.string().min(1, "Employee ID is required."),
  fullName: z.string().min(1, "Full name is required."),
  preferredName: z.string().optional().nullable(),
  email: z.string().email("Provide a valid email."),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  role: z.string().min(1, "Role is required."),
  department: z.string().optional().nullable(),
  employmentType: z.enum(["Full-time", "Part-time", "Contract", "Intern"]),
  workArrangement: z.enum(["On-site", "Hybrid", "Remote"]).optional().nullable(),
  workLocation: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  status: z.enum(["Active", "On Leave", "Probation", "Pending"]),
  emergencyName: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  emergencyRelation: z.string().optional().nullable(),
  grossSalary: z.coerce.number().min(0).optional().nullable(),
  incomeTax: z.coerce.number().min(0).optional().nullable(),
});

const leaveQuotaValue = z.coerce
  .number()
  .min(0, "Leave quota cannot be negative.")
  .max(365, "Leave quota cannot exceed 365 days.");

const updateLeaveQuotaInput = z.object({
  employeeId: z.string().min(1, "Employee ID is required."),
  annual: leaveQuotaValue,
  sick: leaveQuotaValue,
  casual: leaveQuotaValue,
  parental: leaveQuotaValue,
});

const updateCompensationInput = z.object({
  employeeId: z.string().min(1, "Employee ID is required."),
  grossSalary: z.coerce
    .number({
      invalid_type_error: "Gross salary must be a number.",
    })
    .min(0, "Gross salary cannot be negative."),
  incomeTax: z.coerce
    .number({
      invalid_type_error: "Income tax must be a number.",
    })
    .min(0, "Income tax cannot be negative."),
});

const inviteEmployeeInput = z.object({
  fullName: z.string().min(3, "Full name is required."),
  employeeCode: z.string().min(1, "Employee ID is required."),
  workEmail: z.string().email("Provide a valid work email."),
  inviteRole: z.nativeEnum(UserRole, {
    required_error: "Select a role to invite.",
  }),
  designation: z.string().min(2, "Role/title is required."),
  departmentId: z.string().min(1).optional().nullable(),
  teamId: z.string().min(1).optional().nullable(),
  managerId: z.string().min(1).optional().nullable(),
  phoneNumber: z
    .string()
    .min(7, "Phone number is required.")
    .regex(/^\+?[0-9()\s-]{7,20}$/, "Enter a valid phone number."),
  startDate: z.string().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType, {
    required_error: "Choose an employment type.",
  }),
  workModel: z.nativeEnum(WorkModel, {
    required_error: "Select a work arrangement.",
  }),
  notes: z.string().max(2000).optional().nullable(),
  sendInvite: z.boolean().optional(),
});

export const hrEmployeesRouter = createTRPCRouter({
  dashboard: protectedProcedure.query(({ ctx }) =>
    hrEmployeesController.dashboard({ ctx }),
  ),
  profile: protectedProcedure
    .input(employeeIdParam)
    .query(({ ctx, input }) =>
      hrEmployeesController.profile({ ctx, employeeId: input.employeeId }),
    ),
  form: protectedProcedure
    .input(employeeIdParam)
    .query(({ ctx, input }) =>
      hrEmployeesController.form({ ctx, employeeId: input.employeeId }),
    ),
  update: protectedProcedure
    .input(updateEmployeeInput)
    .mutation(({ ctx, input }) => hrEmployeesController.update({ ctx, input })),
  updateLeaveQuota: protectedProcedure
    .input(updateLeaveQuotaInput)
    .mutation(({ ctx, input }) =>
      hrEmployeesController.updateLeaveQuota({ ctx, input }),
    ),
  updateCompensation: protectedProcedure
    .input(updateCompensationInput)
    .mutation(({ ctx, input }) =>
      hrEmployeesController.updateCompensation({ ctx, input }),
    ),
  invite: protectedProcedure
    .input(inviteEmployeeInput)
    .mutation(({ ctx, input }) => hrEmployeesController.invite({ ctx, input })),
  deleteEmployee: protectedProcedure
    .input(employeeIdParam)
    .mutation(({ ctx, input }) =>
      hrEmployeesController.delete({ ctx, employeeId: input.employeeId }),
    ),
});
