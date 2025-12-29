import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";

import { verifyAttachmentDownloadToken } from "@/server/modules/leave/attachment-token";
import { r2BucketName, r2Client } from "@/server/storage/r2";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  void request;
  const { token } = await context.params;

  try {
    const payload = verifyAttachmentDownloadToken(token);
    const object = await r2Client.send(
      new GetObjectCommand({
        Bucket: r2BucketName,
        Key: payload.key,
      }),
    );

    if (!object.Body) {
      return new NextResponse("Attachment not found", { status: 404 });
    }

    const bodyStream = Readable.toWeb(object.Body as Readable);

    const headers = new Headers();
    const contentType = payload.mimeType || object.ContentType || "application/octet-stream";
    headers.set("Content-Type", contentType);

    const safeName = payload.name ? payload.name.replace(/"/g, "") : "leave-attachment";
    const encodedName = encodeURIComponent(safeName);
    headers.set("Content-Disposition", `attachment; filename="${encodedName}"`);
    headers.set("Cache-Control", "private, max-age=0, no-store");

    return new NextResponse(bodyStream as unknown as BodyInit, { headers });
  } catch (error) {
    console.error("Failed to serve leave attachment:", error);
    return new NextResponse("Invalid or expired link", { status: 404 });
  }
}
