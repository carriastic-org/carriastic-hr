import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { UserRole } from "@prisma/client";

import { getCurrentUser } from "@/server/auth/guards";
import { canManageOrganization } from "@/types/hr-organization";
import { buildPublicR2Url, r2BucketName, r2Client } from "@/server/storage/r2";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const buildErrorResponse = (message: string, status = 400) =>
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
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return buildErrorResponse("Unauthorized", 401);
  }

  const viewerRole = sessionUser.role as UserRole;
  if (!canManageOrganization(viewerRole)) {
    return buildErrorResponse("Organization access required.", 403);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const organizationIdField = formData.get("organizationId");

  if (!(file instanceof File)) {
    return buildErrorResponse("No file selected.");
  }

  if (file.size === 0) {
    return buildErrorResponse("Selected file is empty.");
  }

  if (file.size > MAX_FILE_SIZE) {
    return buildErrorResponse("Logo must be smaller than 5MB.");
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return buildErrorResponse("Only JPG, PNG, or WEBP logos are supported.");
  }

  const requestedOrganizationId =
    typeof organizationIdField === "string" && organizationIdField.trim().length
      ? organizationIdField.trim()
      : null;

  let bucketFolder = sessionUser.organizationId ?? null;

  if (viewerRole === "SUPER_ADMIN") {
    bucketFolder = requestedOrganizationId ?? bucketFolder ?? "pending";
  } else {
    if (!bucketFolder) {
      return buildErrorResponse("Join an organization to upload its logo.", 403);
    }
    if (requestedOrganizationId && requestedOrganizationId !== bucketFolder) {
      return buildErrorResponse("You can only upload logos for your organization.", 403);
    }
  }

  const key = [
    "organization-logos",
    bucketFolder,
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${getExtension(file)}`,
  ]
    .filter(Boolean)
    .join("/");

  const body = Buffer.from(await file.arrayBuffer());

  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2BucketName,
      Key: key,
      Body: body,
      ContentType: file.type || "application/octet-stream",
    }),
  );

  const url = buildPublicR2Url(key);

  return NextResponse.json({ url, key });
}
