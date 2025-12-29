import { randomBytes, createHash } from "crypto";
import { serialize } from "cookie";

import { prisma } from "@/server/db";
import { authUserSelect, type AuthUser } from "@/server/auth/selection";

export const SESSION_COOKIE_NAME = "ndi_session";
const DEFAULT_SESSION_DAYS = 1;
const EXTENDED_SESSION_DAYS = 30;

export type ActiveSession = {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  user: AuthUser;
};

const serializeSessionCookie = (value: string, expires: Date) =>
  serialize(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const generateSessionToken = () => randomBytes(32).toString("hex");

export const buildSessionCookie = (token: string, expiresAt: Date) =>
  serializeSessionCookie(token, expiresAt);

export const buildSessionRemovalCookie = () =>
  serializeSessionCookie("", new Date(0));

export async function createSession(userId: string, rememberMe: boolean) {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const ttlDays = rememberMe ? EXTENDED_SESSION_DAYS : DEFAULT_SESSION_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return {
    session,
    cookie: buildSessionCookie(token, expiresAt),
    token,
  };
}

export async function findSessionByToken(token: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.session.findFirst({
    where: {
      tokenHash,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      user: {
        select: authUserSelect,
      },
    },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    userId: record.userId,
    expiresAt: record.expiresAt,
    user: record.user,
    token,
  } satisfies ActiveSession;
}

export async function deleteSessionById(sessionId: string) {
  await prisma.session.delete({
    where: { id: sessionId },
  });
}

export async function revokeAllSessionsForUser(userId: string) {
  await prisma.session.deleteMany({
    where: { userId },
  });
}
