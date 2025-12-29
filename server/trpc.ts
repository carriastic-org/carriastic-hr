import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const router = createTRPCRouter;
export const procedure = publicProcedure;
