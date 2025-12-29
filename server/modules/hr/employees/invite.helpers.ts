import type { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

import { createRandomToken } from "@/server/utils/token";
import { getEmailCredentials } from "@/lib/env";

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ORG_OWNER: "Org Owner",
  ORG_ADMIN: "Org Admin",
  HR_ADMIN: "HR Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

export const formatRoleLabel = (role: UserRole) => roleLabels[role] ?? role;

export const INVITE_TOKEN_TTL_HOURS =
  Number(
    process.env.NEXT_PUBLIC_INVITE_TOKEN_TTL_HOURS ??
      process.env.INVITE_TOKEN_TTL_HOURS ??
      72,
  ) || 72;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const sanitizeOptional = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const normalizePhoneNumber = (value?: string | null) => {
  const trimmed = sanitizeOptional(value);
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\s+/g, " ");
};

export const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) {
    return { firstName: fullName.trim() || "Employee", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
  };
};

const normalizeBaseUrl = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/$/, "");
};

const getSiteUrl = () => {
  const envUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeBaseUrl(process.env.NEXTAUTH_URL);

  if (envUrl) {
    return envUrl;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};

export const buildInviteLink = (token: string, email: string) =>
  `${getSiteUrl()}/auth/signup?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

export const createPlaceholderPasswordHash = async () => {
  const randomSecret = createRandomToken(24);
  return bcrypt.hash(randomSecret, 10);
};

export const sendInvitationEmail = async ({
  to,
  inviteLink,
  organizationName,
  invitedRole,
  recipientName,
  expiresAt,
  senderName,
}: {
  to: string;
  inviteLink: string;
  organizationName: string;
  invitedRole: UserRole;
  recipientName: string;
  expiresAt: Date;
  senderName?: string | null;
}) => {
  let emailUser: string;
  let emailPass: string;

  try {
    ({ user: emailUser, pass: emailPass } = getEmailCredentials());
  } catch (error) {
    console.warn("Email credentials are not configured. Skipping invite email.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  const greeting = recipientName ? `Hi ${recipientName},` : "Hi there,";
  const expiresLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(expiresAt);
  const senderDisplay = senderName?.trim()?.length ? senderName : "HR team";
  const roleLabel = formatRoleLabel(invitedRole);

  const textBody = [
    greeting,
    "",
    `${senderDisplay} invited you to join ${organizationName} on HR as ${roleLabel}.`,
    "Use the secure link below to finish setting up your account and choose a password.",
    "",
    inviteLink,
    "",
    `For security, your invitation link will expire on ${expiresLabel}.`,
    "",
    "See you inside,",
    senderDisplay,
  ].join("\n");

  await transporter.sendMail({
    from: `"${organizationName} HR" <${emailUser}>`,
    to,
    subject: `You're invited to ${organizationName} on HR`,
    text: textBody,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>${greeting}</p>
        <p>${senderDisplay} invited you to join <strong>${organizationName}</strong> on HR as <strong>${roleLabel}</strong>.</p>
        <p>Use the secure link below to finish setting up your account and choose a password. The link will expire on <strong>${expiresLabel}</strong>.</p>
        <p style="margin: 24px 0;">
          <a
            href="${inviteLink}"
            style="background: #4f46e5; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none;"
          >
            Get started
          </a>
        </p>
        <p style="margin-bottom: 16px;">If the button doesn't work, copy and paste this link into your browser:<br/><a href="${inviteLink}">${inviteLink}</a></p>
        <p>See you inside,<br />${senderDisplay}</p>
      </div>
    `,
  });

  return true;
};
