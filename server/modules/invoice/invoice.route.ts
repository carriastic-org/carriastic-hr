import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { invoiceController } from "./invoice.controller";

const invoiceIdParam = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required."),
});

export const invoiceRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) => invoiceController.list({ ctx })),
  unlock: protectedProcedure
    .input(
      invoiceIdParam.extend({
        password: z.string().min(6, "Enter your account password."),
      }),
    )
    .mutation(({ ctx, input }) => invoiceController.unlock({ ctx, input })),
  detail: protectedProcedure
    .input(
      invoiceIdParam.extend({
        token: z.string().min(10, "Provide a valid access token."),
      }),
    )
    .query(({ ctx, input }) => invoiceController.detail({ ctx, input })),
  confirm: protectedProcedure
    .input(
      invoiceIdParam.extend({
        token: z.string().min(10, "Provide a valid access token."),
      }),
    )
    .mutation(({ ctx, input }) => invoiceController.confirm({ ctx, input })),
  requestReview: protectedProcedure
    .input(
      invoiceIdParam.extend({
        token: z.string().min(10, "Provide a valid access token."),
        comment: z.string().min(5, "Share the requested changes."),
      }),
    )
    .mutation(({ ctx, input }) => invoiceController.requestReview({ ctx, input })),
});
