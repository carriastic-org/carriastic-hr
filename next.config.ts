import type { NextConfig } from "next";

const buildRemotePattern = () => {
  const baseUrl = process.env.S3_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return undefined;
  }

  try {
    const parsed = new URL(baseUrl);
    const protocol = parsed.protocol.replace(":", "") as "http" | "https" | string;
    if (protocol !== "http" && protocol !== "https") {
      return undefined;
    }

    const pathname = parsed.pathname.replace(/\/$/, "") || "";
    return [
      {
        protocol: protocol as "http" | "https",
        hostname: parsed.hostname,
        pathname: `${pathname}/**` || "/**",
      },
    ];
  } catch {
    return undefined;
  }
};

const nextConfig: NextConfig = {
  images: {
    remotePatterns: buildRemotePattern(),
  },
};

export default nextConfig;
