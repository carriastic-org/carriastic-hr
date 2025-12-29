import { PrismaClient } from "@prisma/client";

const projects = [
  {
    id: "proj-hr-platform",
    organizationId: "org-ndi",
    name: "HR Platform",
    code: "NDI-HR-001",
    description: "Rollout of a unified HR and attendance platform.",
    clientName: "Demo Company",
    status: "ACTIVE" as const,
    startDate: new Date("2024-01-15"),
    projectManager: "eng-head-sakib",
  },
];

const projectAssignments = [
  {
    userId: "frontend-lead-hazrat",
    projectId: "proj-hr-platform",
    note: "Leads delivery for the HR Platform Implementation project.",
  },
  {
    userId: "backend-lead-sufi",
    projectId: "proj-hr-platform",
    note: "Builds backend services for the HR Platform Implementation project.",
  },
];

export const seedProjects = async (prisma: PrismaClient) => {
  for (const project of projects) {
    await prisma.project.create({ data: project });
  }

  for (const assignment of projectAssignments) {
    await prisma.employmentDetail.update({
      where: { userId: assignment.userId },
      data: {
        currentProjectId: assignment.projectId,
        currentProjectNote: assignment.note,
      },
    });
  }
};
