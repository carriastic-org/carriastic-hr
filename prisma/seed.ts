import { PrismaClient } from "@prisma/client";

import { organizations } from "./seeds/data";
import { seedEmployees } from "./seeds/employee";
import { seedUsers } from "./seeds/user";

const prisma = new PrismaClient();

const seedOrganizations = async () => {
  for (const organization of organizations) {
    await prisma.organization.create({ data: organization });
  }
};

async function main() {
  const existing = await prisma.organization.findFirst({
    where: { id: { in: organizations.map((org) => org.id) } },
  });

  if (!existing) {
    await seedOrganizations();
    await seedUsers(prisma);
    await seedEmployees(prisma);
    console.log("Seeded organization and super admin.");
  } else {
    console.log("Organization already exists. Skipping seed.");
  }
}

main()
  .catch((error) => {
    console.error("Seeding error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
