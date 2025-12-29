import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hrInvoiceController } from "./invoices.controller";

const lineItemSchema = z.object({
  description: z.string().min(2, "Describe the line item."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  unitPrice: z.coerce
    .number()
    .refine((value) => value !== 0, "Unit price cannot be zero."),
});

const createInvoiceInput = z.object({
  employeeId: z.string().min(1, "Select an employee."),
  title: z.string().min(3, "Provide a title."),
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000).max(2100),
  dueDate: z.string().optional().nullable(),
  currency: z.string().min(3).max(12),
  taxRate: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(lineItemSchema).min(1, "Add at least one line item."),
});

const updateInvoiceInput = createInvoiceInput.extend({
  invoiceId: z.string().min(1, "Invoice ID is required."),
});

const invoiceIdParam = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required."),
});

export const hrInvoicesRouter = createTRPCRouter({
  dashboard: protectedProcedure.query(({ ctx }) => hrInvoiceController.dashboard({ ctx })),
  create: protectedProcedure
    .input(createInvoiceInput)
    .mutation(({ ctx, input }) => hrInvoiceController.create({ ctx, input })),
  update: protectedProcedure
    .input(updateInvoiceInput)
    .mutation(({ ctx, input }) => hrInvoiceController.update({ ctx, input })),
  send: protectedProcedure
    .input(invoiceIdParam)
    .mutation(({ ctx, input }) => hrInvoiceController.send({ ctx, input })),
  detail: protectedProcedure
    .input(invoiceIdParam)
    .query(({ ctx, input }) => hrInvoiceController.detail({ ctx, input })),
});
