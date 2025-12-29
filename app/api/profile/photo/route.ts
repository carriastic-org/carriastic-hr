import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import type { UserRole } from "@prisma/client";

import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth/guards";
import { buildPublicR2Url, r2BucketName, r2Client } from "@/server/storage/r2";
import { getEditPermission } from "@/server/modules/hr/utils";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

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

const disallowedResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return disallowedResponse("Unauthorized", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const employeeIdField = formData.get("employeeId");

  if (!(file instanceof File)) {
    return disallowedResponse("No file attached");
  }

  if (file.size === 0) {
    return disallowedResponse("Selected file is empty");
  }

  if (file.size > MAX_FILE_SIZE) {
    return disallowedResponse("File exceeds 5MB limit");
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return disallowedResponse("Only JPG, PNG or WEBP images are allowed");
  }

  const requestedEmployeeId =
    typeof employeeIdField === "string" && employeeIdField.trim().length
      ? employeeIdField.trim()
      : sessionUser.id;

  const isEditingOtherUser = requestedEmployeeId !== sessionUser.id;

  if (isEditingOtherUser && !sessionUser.organizationId) {
    return disallowedResponse("Missing organization context", 403);
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      id: requestedEmployeeId,
      ...(isEditingOtherUser && sessionUser.organizationId
        ? { organizationId: sessionUser.organizationId }
        : {}),
    },
    select: {
      id: true,
      role: true,
      email: true,
      organizationId: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          preferredName: true,
          workEmail: true,
          workPhone: true,
        },
      },
    },
  });

  if (!targetUser) {
    return disallowedResponse("Employee not found", 404);
  }

  if (
    isEditingOtherUser &&
    sessionUser.organizationId &&
    targetUser.organizationId !== sessionUser.organizationId
  ) {
    return disallowedResponse("Employee belongs to a different organization", 403);
  }

  if (isEditingOtherUser) {
    const permission = getEditPermission(
      sessionUser.role as UserRole,
      targetUser.role as UserRole,
    );
    if (!permission.allowed) {
      return disallowedResponse(
        permission.reason ?? "You are not allowed to update this profile",
        403,
      );
    }
  }

  const key = [
    "profiles",
    targetUser.organizationId ?? sessionUser.organizationId ?? "global",
    `${targetUser.id}-${Date.now()}.${getExtension(file)}`,
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

  const fileUrl = buildPublicR2Url(key);

  const fallbackFirstName =
    targetUser.profile?.firstName ??
    targetUser.profile?.preferredName ??
    targetUser.email.split("@")[0] ??
    "Team member";

  await prisma.employeeProfile.upsert({
    where: { userId: targetUser.id },
    update: { profilePhotoUrl: fileUrl },
    create: {
      userId: targetUser.id,
      firstName: fallbackFirstName,
      lastName: targetUser.profile?.lastName ?? "",
      profilePhotoUrl: fileUrl,
      workEmail: targetUser.profile?.workEmail ?? targetUser.email,
      workPhone: targetUser.profile?.workPhone ?? null,
    },
  });

  return NextResponse.json({ url: fileUrl, key });
}
