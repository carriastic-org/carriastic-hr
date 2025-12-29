import type { TRPCContext } from "@/server/api/trpc";
import { hrOrganizationService } from "./organization.service";

export const hrOrganizationController = {
  management: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input?: { organizationId?: string };
  }) => hrOrganizationService.management(ctx, input?.organizationId),
  list: ({ ctx }: { ctx: TRPCContext }) => hrOrganizationService.listAll(ctx),
  updateDetails: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: {
      name: string;
      domain?: string | null;
      timezone?: string | null;
      locale?: string | null;
      organizationId?: string | null;
    };
  }) => hrOrganizationService.updateDetails(ctx, input),
  addAdmin: ({ ctx, userId }: { ctx: TRPCContext; userId: string }) =>
    hrOrganizationService.addAdmin(ctx, userId),
  removeAdmin: ({ ctx, userId }: { ctx: TRPCContext; userId: string }) =>
    hrOrganizationService.removeAdmin(ctx, userId),
  createOrganization: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: {
      name: string;
      domain?: string | null;
      timezone?: string | null;
      locale?: string | null;
      ownerName: string;
      ownerEmail: string;
      ownerPhone?: string | null;
      ownerDesignation?: string | null;
      sendInvite?: boolean;
    };
  }) => hrOrganizationService.createOrganization(ctx, input),
  deleteOrganization: ({
    ctx,
    input,
  }: {
    ctx: TRPCContext;
    input: { organizationId: string; password: string };
  }) => hrOrganizationService.deleteOrganization(ctx, input),
};
