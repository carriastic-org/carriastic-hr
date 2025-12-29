import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@/server/api/root";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "";
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};

export const getTRPCUrl = () => `${getBaseUrl()}/api/trpc`;
