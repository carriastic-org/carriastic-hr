import type { TRPCContext } from "@/server/api/trpc";
import type {
  EmployeeInvoiceListResponse,
  InvoiceDetailResponse,
  InvoiceUnlockResponse,
} from "@/types/invoice";

import { invoiceService } from "./invoice.service";

export const invoiceController = {
  list: ({ ctx }: { ctx: TRPCContext }): Promise<EmployeeInvoiceListResponse> =>
    invoiceService.list({ ctx }),
  unlock: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { invoiceId: string; password: string };
  }): Promise<InvoiceUnlockResponse> => invoiceService.unlock({ ctx, input }),
  detail: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { invoiceId: string; token: string };
  }): Promise<InvoiceDetailResponse> => invoiceService.detail({ ctx, input }),
  confirm: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { invoiceId: string; token: string };
  }): Promise<InvoiceDetailResponse> => invoiceService.confirm({ ctx, input }),
  requestReview: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { invoiceId: string; token: string; comment: string };
  }): Promise<InvoiceDetailResponse> => invoiceService.requestReview({ ctx, input }),
};
