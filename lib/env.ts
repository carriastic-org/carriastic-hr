const firstDefinedEnv = (keys: string[]): string | null => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.length > 0) {
      return value;
    }
  }

  return null;
};

export const getJwtSecret = (): string => {
  const secret = firstDefinedEnv(["JWT_SECRET", "AUTH_SECRET", "NEXTAUTH_SECRET"]);

  if (!secret) {
    throw new Error(
      "JWT secret is not configured. Set JWT_SECRET (or AUTH_SECRET/NEXTAUTH_SECRET) in the server environment.",
    );
  }

  return secret;
};

export const getAttachmentTokenSecret = (): string => {
  const secret = process.env.LEAVE_ATTACHMENT_TOKEN_SECRET ?? null;
  return secret ?? getJwtSecret();
};

export const getEmailCredentials = (): { user: string; pass: string } => {
  const user = firstDefinedEnv(["EMAIL_USER", "SMTP_USER"]);
  const pass = firstDefinedEnv(["EMAIL_PASS", "SMTP_PASS"]);

  if (!user || !pass) {
    throw new Error("Email credentials are not configured. Set EMAIL_USER and EMAIL_PASS.");
  }

  return { user, pass };
};
