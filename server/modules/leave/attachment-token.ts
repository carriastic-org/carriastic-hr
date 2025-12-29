import jwt from "jsonwebtoken";

import { getAttachmentTokenSecret } from "@/lib/env";

const TOKEN_PURPOSE = "leave-attachment";
const TOKEN_TTL = process.env.LEAVE_ATTACHMENT_TOKEN_TTL ?? "30d";

export type AttachmentTokenPayload = {
  key: string;
  name?: string;
  mimeType?: string | null;
  purpose: typeof TOKEN_PURPOSE;
};

export const createAttachmentDownloadToken = (
  payload: Omit<AttachmentTokenPayload, "purpose">,
) => {
  return jwt.sign(
    {
      ...payload,
      purpose: TOKEN_PURPOSE,
    },
    getAttachmentTokenSecret(),
    { expiresIn: TOKEN_TTL as jwt.SignOptions["expiresIn"] },
  );
};

export const verifyAttachmentDownloadToken = (token: string): AttachmentTokenPayload => {
  const decoded = jwt.verify(token, getAttachmentTokenSecret());
  if (
    !decoded ||
    typeof decoded !== "object" ||
    (decoded as AttachmentTokenPayload).purpose !== TOKEN_PURPOSE ||
    typeof (decoded as AttachmentTokenPayload).key !== "string"
  ) {
    throw new Error("Invalid attachment token");
  }

  return decoded as AttachmentTokenPayload;
};

export const buildAttachmentDownloadUrl = (token: string) =>
  `/api/leave/attachments/${token}`;
