import { EmploymentType, Gender, WorkModel } from "@prisma/client";
import { z } from "zod";

export const getProfileParams = z.void();

const optionalNullableString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (value === null || value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
    message: "Invalid date format",
  })
  .transform((value) => (value ? new Date(value) : undefined));

export const updateProfileSchema = z.object({
  profile: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    preferredName: optionalNullableString,
    gender: z.nativeEnum(Gender).optional().nullable(),
    dateOfBirth: optionalDate,
    nationality: optionalNullableString,
    workModel: z.nativeEnum(WorkModel).optional().nullable(),
    bio: optionalNullableString,
    workEmail: z.string().email(),
    personalEmail: z.string().email().optional().nullable(),
    workPhone: optionalNullableString,
    personalPhone: optionalNullableString,
    currentAddress: optionalNullableString,
    permanentAddress: optionalNullableString,
  }),
  employment: z.object({
    employeeCode: z.string().min(1, "Employee ID is required"),
    designation: z.string().min(1, "Designation is required"),
    departmentName: optionalNullableString,
    employmentType: z.nativeEnum(EmploymentType),
    startDate: optionalDate,
    primaryLocation: optionalNullableString,
  }),
  emergencyContact: z.object({
    name: z.string().min(1, "Contact name is required"),
    relationship: z.string().min(1, "Relationship is required"),
    phone: z.string().min(1, "Phone is required"),
    alternatePhone: optionalNullableString,
  }),
  bankAccount: z.object({
    bankName: z.string().min(1, "Bank name is required"),
    accountHolder: z.string().min(1, "Account holder is required"),
    accountNumber: z.string().min(1, "Account number is required"),
    branch: optionalNullableString,
    swiftCode: optionalNullableString,
    taxId: optionalNullableString,
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
});

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
