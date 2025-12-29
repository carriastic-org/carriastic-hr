import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

const handler = async (req: Request) => {
  const ctxPromise = createTRPCContext({
    headers: req.headers,
  });

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ctxPromise,
  });

  const ctx = await ctxPromise;
  ctx.responseHeaders.forEach((value, key) => {
    response.headers.append(key, value);
  });

  return response;
};

export { handler as GET, handler as POST };
