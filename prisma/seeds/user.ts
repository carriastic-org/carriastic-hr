import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import type { SeedUserConfig } from "./data";
import { usersToCreate } from "./data";

const hashPassword = async (password: string) => {
  if (!password) {
    throw new Error("Password is required for hashing");
  }

  return bcrypt.hash(password, 10);
};

const buildUserData = async (userConfig: SeedUserConfig) => {
  const passwordHash = await hashPassword(userConfig.password);

  return {
    id: userConfig.id,
    organizationId: userConfig.organizationId,
    email: userConfig.email,
    passwordHash,
    role: userConfig.role,
    status: "ACTIVE" as const,
    phone: userConfig.workPhone ?? userConfig.personalPhone ?? null,
  };
};

export const seedUsers = async (prisma: PrismaClient) => {
  const createdUsers = [];

  for (const config of usersToCreate) {
    const data = await buildUserData(config);
    const created = await prisma.user.create({ data });
    createdUsers.push(created);
  }

  return createdUsers;
};
