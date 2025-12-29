import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import type {
  EmployeeInvoiceListResponse,
  InvoiceDetailResponse,
  InvoiceUnlockResponse,
} from "@/types/invoice";
import {
  employeeInvoiceSummarySelect,
  invoiceDetailInclude,
  mapEmployeeInvoiceSummary,
  mapInvoiceDetail,
} from "./invoice.mapper";

type InvoiceUnlockToken = {
  invoiceId: string;
  userId: string;
};

const TOKEN_TTL_SECONDS = 60 * 10;

const getUnlockSecret = () => {
  const secret =
    process.env.INVOICE_UNLOCK_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.JWT_SECRET;

  if (secret && secret.length >= 16) {
    return secret;
  }

  return "ndi-hr-invoice-secret";
};

const signUnlockToken = (payload: InvoiceUnlockToken) =>
  jwt.sign(payload, getUnlockSecret(), { expiresIn: TOKEN_TTL_SECONDS });

const verifyUnlockToken = (token: string): InvoiceUnlockToken => {
  try {
    const decoded = jwt.verify(token, getUnlockSecret()) as InvoiceUnlockToken;
    if (!decoded.invoiceId || !decoded.userId) {
      throw new Error("Missing required fields");
    }
    return decoded;
  } catch (error) {
    void error;
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Your password confirmation expired. Please try again.",
    });
  }
};

const ensureUser = (ctx: TRPCContext) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return ctx.session.user;
};

export const invoiceService = {
  async list({ ctx }: { ctx: TRPCContext }): Promise<EmployeeInvoiceListResponse> {
    const user = ensureUser(ctx);
    const invoices = await ctx.prisma.invoice.findMany({
      where: {
        employeeId: user.id,
        status: { not: "DRAFT" },
      },
      select: employeeInvoiceSummarySelect,
      orderBy: { updatedAt: "desc" },
    });

    return {
      invoices: invoices.map(mapEmployeeInvoiceSummary),
    };
  },

  async unlock({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { invoiceId: string; password: string };
  }): Promise<InvoiceUnlockResponse> {
    const user = ensureUser(ctx);

    const invoice = await ctx.prisma.invoice.findFirst({
      where: { id: input.invoiceId, employeeId: user.id },
      select: { id: true, status: true },
    });

    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
    }

    if (invoice.status === "DRAFT") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This invoice is still being edited by HR.",
      });
    }

    const authUser = await ctx.prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!authUser?.passwordHash) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Your account is missing a password. Contact HR.",
      });
    }

    const isMatch = await bcrypt.compare(input.password, authUser.passwordHash);
    if (!isMatch) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid password." });
    }

    const token = signUnlockToken({ invoiceId: invoice.id, userId: user.id });
    return { token };
  },

  async detail({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { invoiceId: string; token: string };
  }): Promise<InvoiceDetailResponse> {
    const user = ensureUser(ctx);
    const decoded = verifyUnlockToken(input.token);

    if (decoded.userId !== user.id || decoded.invoiceId !== input.invoiceId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Access denied." });
    }

    const invoice = await ctx.prisma.invoice.findFirst({
      where: { id: input.invoiceId, employeeId: user.id },
      include: invoiceDetailInclude,
    });

    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
    }

    return { invoice: mapInvoiceDetail(invoice) };
  },

  async confirm({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { invoiceId: string; token: string };
  }): Promise<InvoiceDetailResponse> {
    const user = ensureUser(ctx);
    const decoded = verifyUnlockToken(input.token);

    if (decoded.userId !== user.id || decoded.invoiceId !== input.invoiceId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Access denied." });
    }

    const invoice = await ctx.prisma.invoice.findFirst({
      where: { id: input.invoiceId, employeeId: user.id },
      select: { id: true, status: true },
    });

    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
    }

    if (invoice.status !== "PENDING_REVIEW") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This invoice is no longer awaiting confirmation.",
      });
    }

    const now = new Date();

    const updated = await ctx.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "READY_TO_DELIVER",
        confirmedAt: now,
        readyAt: now,
      },
      include: invoiceDetailInclude,
    });

    return { invoice: mapInvoiceDetail(updated) };
  },

  async requestReview({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { invoiceId: string; token: string; comment: string };
  }): Promise<InvoiceDetailResponse> {
    const user = ensureUser(ctx);
    const decoded = verifyUnlockToken(input.token);

    if (decoded.userId !== user.id || decoded.invoiceId !== input.invoiceId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Access denied." });
    }

    const invoice = await ctx.prisma.invoice.findFirst({
      where: { id: input.invoiceId, employeeId: user.id },
      select: { id: true, status: true },
    });

    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
    }

    if (invoice.status !== "PENDING_REVIEW") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You can only request changes on invoices awaiting review.",
      });
    }

    const cleanedComment = input.comment.trim();
    if (cleanedComment.length < 5) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Provide a comment with at least 5 characters.",
      });
    }

    const updated = await ctx.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "CHANGES_REQUESTED",
        reviewComment: cleanedComment,
        reviewedAt: new Date(),
        reviewedById: user.id,
      },
      include: invoiceDetailInclude,
    });

    return { invoice: mapInvoiceDetail(updated) };
  },
};
