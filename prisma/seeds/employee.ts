import { PrismaClient, WorkModel as WorkModelEnum } from "@prisma/client";

import {
  organizationNameById,
  teamDepartmentMap,
  teamLeadAssignments,
  teamManagerAssignments,
  usersToCreate,
} from "./data";

const defaultStartDate = new Date("2023-01-15");
const defaultLocation = "Dhaka HQ";

const emergencyEmail = (firstName: string, domain: string) =>
  `${firstName.toLowerCase()}-emergency@${domain}`;

export const seedEmployees = async (prisma: PrismaClient) => {
  for (const user of usersToCreate) {
    const {
      id,
      organizationId,
      firstName,
      lastName,
      preferredName,
      designation,
      employeeCode,
      teamId = null,
      workModel = WorkModelEnum.HYBRID,
      workPhone = null,
      personalPhone = null,
      reportingManagerId = null,
      gender = null,
      email,
      departmentId: explicitDepartmentId = null,
    } = user;

    const resolvedDepartmentId =
      explicitDepartmentId ?? (teamId ? teamDepartmentMap[teamId] ?? null : null);

    await prisma.employeeProfile.create({
      data: {
        id: `${id}-profile`,
        userId: id,
        firstName,
        lastName,
        preferredName,
        workModel,
        gender,
        workEmail: email,
        workPhone,
        personalPhone,
        currentAddress: "Dhaka, Bangladesh",
        permanentAddress: "Dhaka, Bangladesh",
        bio: `${designation} at ${organizationNameById[organizationId]}.`,
      },
    });

      await prisma.employmentDetail.create({
        data: {
          id: `${id}-employment`,
          userId: id,
          organizationId,
          employeeCode,
          designation,
          employmentType: "FULL_TIME",
          status: "ACTIVE",
          startDate: defaultStartDate,
          teamId,
          departmentId: resolvedDepartmentId,
          reportingManagerId,
          primaryLocation: defaultLocation,
        },
      });

    const accountSuffix = id.toString().padStart(4, "0");

    await prisma.employeeBankAccount.create({
      data: {
        id: `${id}-bank`,
        userId: id,
        accountHolder: `${firstName} ${lastName}`,
        bankName: "Eastern Bank Ltd.",
        accountNumber: `ACC-${accountSuffix}`,
        branch: "Gulshan",
        swiftCode: "EBLDBDDH",
        isPrimary: true,
      },
    });

    const emergencyDomain = email.split("@")[1] || "noreply.example";

    await prisma.emergencyContact.create({
      data: {
        id: `${id}-emergency`,
        userId: id,
        name: `${firstName} Emergency`,
        relationship: "Family",
        phone: personalPhone || "+8801700000000",
        email: emergencyEmail(firstName, emergencyDomain),
      },
    });
  }

  for (const assignment of teamLeadAssignments) {
    const uniqueLeadIds = Array.from(new Set(assignment.leadUserIds));
    for (const leadId of uniqueLeadIds) {
      await prisma.teamLead.create({
        data: {
          teamId: assignment.teamId,
          leadId,
        },
      });

      await prisma.employmentDetail.updateMany({
        where: { userId: leadId },
        data: { teamId: assignment.teamId, isTeamLead: true },
      });
    }
  }

  for (const assignment of teamManagerAssignments) {
    for (const teamId of assignment.teamIds) {
      await prisma.teamManager.create({
        data: {
          managerId: assignment.managerId,
          teamId,
        },
      });
    }
  }
};
