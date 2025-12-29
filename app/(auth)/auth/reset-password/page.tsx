import { Suspense } from "react";
import jwt, { JsonWebTokenError } from "jsonwebtoken";
import { notFound } from "next/navigation";
import { ResetPasswordClient } from "@/app/components/auth/ResetPasswordClient";
import { getJwtSecret } from "@/lib/env";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

type ResetPasswordPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

type ResetTokenPayload = jwt.JwtPayload & {
  userId?: string;
  email?: string;
  purpose?: string;
};

const extractToken = (searchParams?: SearchParams) => {
  const tokenParam = searchParams?.token;
  if (!tokenParam) {
    return "";
  }

  return Array.isArray(tokenParam) ? tokenParam[0] ?? "" : tokenParam;
};

const parsePayload = (decoded: string | jwt.JwtPayload): ResetTokenPayload => {
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload.");
  }

  return decoded as ResetTokenPayload;
};

const verifyResetToken = (token: string): ResetTokenPayload => {
  const baseSecret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, baseSecret);
    return parsePayload(decoded);
  } catch (error) {
    if (
      error instanceof JsonWebTokenError &&
      error.message === "invalid signature"
    ) {
      const decoded = jwt.decode(token);
      if (decoded && typeof decoded !== "string") {
        const decodedPayload = decoded as ResetTokenPayload & { id?: string };
        const fallbackId = decodedPayload.userId || decodedPayload.id;
        if (fallbackId) {
          const fallbackSecret = baseSecret + fallbackId;
          const fallbackDecoded = jwt.verify(token, fallbackSecret);
          return parsePayload(fallbackDecoded);
        }
      }
    }

    throw error;
  }
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const token = extractToken(resolvedSearchParams);

  if (!token) {
    notFound();
  }

  let payload: ResetTokenPayload;

  try {
    payload = verifyResetToken(token);
  } catch (error) {
    console.error("Invalid reset token:", error);
    notFound();
  }

  if (!payload || payload.purpose !== "password-reset" || !payload.userId) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-600">
          Loading secure reset experience...
        </div>
      }
    >
      <ResetPasswordClient token={token} userId={payload.userId} />
    </Suspense>
  );
}
