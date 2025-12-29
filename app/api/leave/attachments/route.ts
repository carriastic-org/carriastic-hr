import { randomUUID } from "crypto";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/guards";
import {
  buildAttachmentDownloadUrl,
  createAttachmentDownloadToken,
} from "@/server/modules/leave/attachment-token";
import { r2BucketName, r2Client } from "@/server/storage/r2";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ message }, { status });

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "attachment";

const getExtension = (fileName: string, mimeType?: string) => {
  const fromName = fileName.includes(".") ? fileName.split(".").pop() : null;
  if (fromName) {
    return fromName.toLowerCase();
  }
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
};

const buildObjectKey = (
  userId: string,
  organizationId: string | null,
  fileName: string,
  mimeType?: string,
) => {
  const baseName = sanitizeFileName(fileName.replace(/\.[^/.]+$/, ""));
  const extension = getExtension(fileName, mimeType);
  return [
    "leave-attachments",
    organizationId ?? "global",
    userId,
    `${Date.now()}-${baseName}.${extension}`,
  ]
    .filter(Boolean)
    .join("/");
};

export async function POST(request: Request) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return errorResponse("Unauthorized", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return errorResponse("No file attached");
  }

  if (file.size === 0) {
    return errorResponse("Selected file is empty");
  }

  if (file.size > MAX_FILE_SIZE) {
    return errorResponse("File exceeds 5 MB limit");
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return errorResponse("Only PDF or common image formats are allowed.");
  }

  const objectKey = buildObjectKey(
    sessionUser.id,
    sessionUser.organizationId ?? null,
    file.name,
    file.type,
  );
  const body = Buffer.from(await file.arrayBuffer());

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: r2BucketName,
        Key: objectKey,
        Body: body,
        ContentType: file.type || "application/octet-stream",
      }),
    );
  } catch (error) {
    console.error("Failed to upload leave attachment:", error);
    return errorResponse("Unable to upload the file right now.", 500);
  }

  const token = createAttachmentDownloadToken({
    key: objectKey,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
  });

  const attachment = {
    id: randomUUID(),
    name: file.name,
    mimeType: file.type || null,
    sizeBytes: file.size,
    storageKey: objectKey,
    downloadUrl: buildAttachmentDownloadUrl(token),
    uploadedAt: new Date().toISOString(),
  };

  return NextResponse.json({ attachment });
}

export async function DELETE(request: Request) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return errorResponse("Unauthorized", 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid payload");
  }

  const key =
    payload && typeof payload === "object" && "key" in payload
      ? String((payload as Record<string, unknown>).key ?? "")
      : "";

  if (!key) {
    return errorResponse("Attachment key is required");
  }

  if (!key.startsWith("leave-attachments/")) {
    return errorResponse("Invalid attachment reference", 400);
  }

  const ownsAttachment = key.includes(sessionUser.id);
  const isHrAdmin = sessionUser.role === "HR_ADMIN";

  if (!ownsAttachment && !isHrAdmin) {
    return errorResponse("You are not allowed to delete this attachment.", 403);
  }

  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: r2BucketName,
        Key: key,
      }),
    );
  } catch (error) {
    console.error("Failed to delete leave attachment:", error);
    return errorResponse("Unable to delete the attachment.", 500);
  }

  return NextResponse.json({ success: true });
}
