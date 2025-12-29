import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { EmploymentStatus } from "@prisma/client";

import { prisma } from "@/prisma";
import { authUserSelect } from "@/server/auth/selection";

export const nextAuthOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.trim().toLowerCase();

        const userRecord = await prisma.user.findUnique({
          where: { email },
          select: {
            passwordHash: true,
            ...authUserSelect,
          },
        });

        if (!userRecord?.passwordHash) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          userRecord.passwordHash,
        );

        if (!isValidPassword) {
          return null;
        }

        if (userRecord.status === EmploymentStatus.INACTIVE) {
          return null;
        }

        await prisma.user.update({
          where: { id: userRecord.id },
          data: { lastLoginAt: new Date() },
        });

        const displayName =
          userRecord.profile?.preferredName ??
          ([userRecord.profile?.firstName, userRecord.profile?.lastName]
            .filter(Boolean)
            .join(" ") || userRecord.email);

        return {
          id: userRecord.id,
          email: userRecord.email,
          role: userRecord.role,
          name: displayName,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) {
          session.user.id = token.sub;
        }
        if (token.role && typeof token.role === "string") {
          session.user.role = token.role;
        }
      }

      return session;
    },
    async jwt({ token, user }) {
      if (user && "role" in user && typeof user.role === "string") {
        token.role = user.role;
      }

      return token;
    },
  },
};
