import { PrismaClient } from "@prisma/client";

import { orgDepartments, orgTeams, organizations } from "./seeds/data";
import { seedAttendance } from "./seeds/attendance";
import { seedEmployees } from "./seeds/employee";
import { seedLeaveRequests } from "./seeds/leaveRequest";
import { seedNotifications } from "./seeds/notification";
import { seedProjects } from "./seeds/project";
import { seedReports } from "./seeds/report";
import { seedUsers } from "./seeds/user";
import { seedChat } from "./seeds/chat";
import { seedInvoices } from "./seeds/invoice";

const prisma = new PrismaClient();

const seedOrganizations = async () => {
  for (const organization of organizations) {
    await prisma.organization.create({ data: organization });
  }
};

const seedTeams = async () => {
  for (const organization of organizations) {
    const teams = orgTeams[organization.id] || [];

    for (const team of teams) {
      await prisma.team.create({
        data: {
          id: team.id,
          organizationId: organization.id,
          name: team.name,
          description: team.description,
          departmentId: team.departmentId,
        },
      });
    }
  }
};

const seedDepartments = async () => {
  for (const organization of organizations) {
    const departments = orgDepartments[organization.id] || [];

    for (const department of departments) {
      await prisma.department.create({
        data: {
          id: department.id,
          organizationId: organization.id,
          name: department.name,
          code: department.code,
          description: department.description,
        },
      });
    }
  }
};

const assignDepartmentHeads = async () => {
  for (const organization of organizations) {
    const departments = orgDepartments[organization.id] || [];
    for (const department of departments) {
      if (!department.headId) continue;
      await prisma.department.update({
        where: { id: department.id },
        data: { headId: department.headId },
      });
    }
  }
};

async function main() {
  const existing = await prisma.organization.findFirst({
    where: { id: { in: organizations.map((org) => org.id) } },
  });

  let baseSeeded = false;

  if (!existing) {
    await seedOrganizations();
    await seedDepartments();
    await seedTeams();
    await seedUsers(prisma);
    await assignDepartmentHeads();
    await seedEmployees(prisma);
    await seedProjects(prisma);
    await seedAttendance(prisma);
    await seedLeaveRequests(prisma);
    await seedNotifications(prisma);
    await seedChat(prisma);
    baseSeeded = true;
    console.log("Seeded organizations, people, attendance, projects, leave, and notifications.");
  } else {
    console.log("Base organizations already exist. Skipping structural seeds.");
  }

  await seedReports(prisma);
  await seedInvoices(prisma);

  if (!baseSeeded) {
    await seedChat(prisma);
  }

  if (!baseSeeded) {
    console.log("Reports seeding executed against existing data set.");
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
