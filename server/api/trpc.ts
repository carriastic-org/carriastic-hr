import { initTRPC, TRPCError } from "@trpc/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/server/db";
import { authUserSelect, type AuthUser } from "@/server/auth/selection";
import { nextAuthOptions } from "@/app/utils/next-auth-options";

type CreateContextOptions = {
  headers: Headers;
};

/**
 * Context factory for tRPC procedures.
 */
export const createTRPCContext = async (opts: CreateContextOptions) => {
  const responseHeaders = new Headers();
  const session = await getServerSession(nextAuthOptions);

  let authUser: AuthUser | null = null;

  if (session?.user?.id) {
    authUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: authUserSelect,
    });
  }

  return {
    headers: opts.headers,
    prisma,
    responseHeaders,
    session: authUser ? { user: authUser } : null,
  } satisfies TRPCContext;
};

export type TRPCContext = {
  headers: Headers;
  prisma: typeof prisma;
  responseHeaders: Headers;
  session: { user: AuthUser } | null;
};

const t = initTRPC.context<TRPCContext>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
