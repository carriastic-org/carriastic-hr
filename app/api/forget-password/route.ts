import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

import { getEmailCredentials, getJwtSecret } from "@/lib/env";
import { prisma } from "@/prisma";

const TOKEN_TTL_MINUTES = 30;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";

    if (!email) {
      return NextResponse.json(
        { message: "A valid email address is required." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "No account was found for that email address." },
        { status: 404 },
      );
    }

    const baseSecret = getJwtSecret();

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        purpose: "password-reset",
      },
      baseSecret,
      { expiresIn: `${TOKEN_TTL_MINUTES}m` },
    );

    const { user: emailUser, pass: emailPass } = getEmailCredentials();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    const resetLink = `${getBaseUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;

    const recipientName = user.profile?.firstName?.trim() || user.profile?.lastName?.trim() || "";
    const salutation = recipientName ? `Dear ${recipientName},` : "Dear team member,";
    const textBody = [
      salutation,
      "",
      "You recently requested assistance resetting the password for your HR account.",
      `Use the secure link below to create a new password. The link will remain active for ${TOKEN_TTL_MINUTES} minutes.`,
      "",
      resetLink,
      "",
      "If you did not submit this request, please disregard this email or notify your workspace administrator.",
      "",
      "Best regards,",
      "HR Security Team",
    ].join("\n");

    await transporter.sendMail({
      from: emailUser,
      to: user.email,
      subject: "HR password reset instructions",
      text: textBody,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <p>${salutation}</p>
          <p>You recently requested assistance resetting the password for your HR account.</p>
          <p>Please use the secure link below to create a new password. The link will remain active for ${TOKEN_TTL_MINUTES} minutes.</p>
          <p style="margin: 24px 0;">
            <a
              href="${resetLink}"
              style="background: #4f46e5; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none;"
            >
              Reset password
            </a>
          </p>
          <p style="margin-bottom: 16px;">If you did not submit this request, please disregard this email or notify your workspace administrator.</p>
          <p>Best regards,<br />HR Security Team</p>
        </div>
      `,
    });

    return NextResponse.json({
      message: "If that account exists, a reset link is on the way.",
    });
  } catch (error) {
    console.error("Failed to send reset email:", error);
    return NextResponse.json(
      { message: "Failed to send password reset email." },
      { status: 500 },
    );
  }
}
