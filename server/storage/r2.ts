import { S3Client } from "@aws-sdk/client-s3";

const requiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const createClient = () => {
  const endpoint = requiredEnv("S3_ENDPOINT");
  const region = process.env.S3_REGION ?? "auto";
  const accessKeyId = requiredEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("S3_SECRET_ACCESS_KEY");

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

const globalForR2 = globalThis as unknown as {
  r2Client?: S3Client;
};

export const r2Client = globalForR2.r2Client ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForR2.r2Client = r2Client;
}

export const r2BucketName = requiredEnv("S3_BUCKET");
const baseUrl = requiredEnv("S3_PUBLIC_BASE_URL").replace(/\/$/, "");

export const buildPublicR2Url = (key: string) =>
  `${baseUrl}/${key.replace(/^\/+/, "")}`;
