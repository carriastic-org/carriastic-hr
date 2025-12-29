import "server-only";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { prisma } from "@/prisma";
import { authUserSelect, type AuthUser } from "@/server/auth/selection";
import { nextAuthOptions } from "@/app/utils/next-auth-options";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getServerSession(nextAuthOptions);

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: authUserSelect,
  });

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  return user;
}
