import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

import { buildPublicR2Url, r2BucketName, r2Client } from "@/server/storage/r2";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const getExtension = (file: File) => {
  const name = file.name || "";
  const fromName = name.includes(".") ? name.split(".").pop() : null;
  if (fromName) {
    return fromName.toLowerCase();
  }

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return errorResponse("No file attached");
    }

    if (file.size === 0) {
      return errorResponse("Selected file is empty");
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("File exceeds 5MB limit");
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return errorResponse("Only JPG, PNG or WEBP images are allowed");
    }

    const key = [
      "pending-signups",
      new Date().getFullYear(),
      `${Date.now()}-${randomUUID()}.${getExtension(file)}`,
    ].join("/");

    const body = Buffer.from(await file.arrayBuffer());

    await r2Client.send(
      new PutObjectCommand({
        Bucket: r2BucketName,
        Key: key,
        Body: body,
        ContentType: file.type || "application/octet-stream",
      }),
    );

    const fileUrl = buildPublicR2Url(key);

    return NextResponse.json({ url: fileUrl, key });
  } catch (error) {
    console.error("Signup photo upload failed", error);
    return errorResponse("Unable to upload image right now", 500);
  }
}
