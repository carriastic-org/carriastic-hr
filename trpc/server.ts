import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { appRouter } from "@/server/api/root";
import { createCallerFactory, createTRPCContext } from "@/server/api/trpc";

const createCaller = createCallerFactory(appRouter);

export const api = cache(async () => {
  const resolvedHeaders = await headers();

  const ctx = await createTRPCContext({
    headers: resolvedHeaders,
  });

  return createCaller(ctx);
});
