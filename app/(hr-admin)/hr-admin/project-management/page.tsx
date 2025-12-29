import { redirect } from "next/navigation";

import { requireUser } from "@/server/auth/guards";
import { canManageProjects } from "@/types/hr-project";

import ProjectManagementClient from "../../../components/hr-admin/ProjectManagementClient";

export default async function ProjectManagementPage() {
  const user = await requireUser();

  if (!canManageProjects(user.role)) {
    redirect("/hr-admin");
  }

  return <ProjectManagementClient />;
}
