import { redirect } from "next/navigation";

import { requireUser } from "@/server/auth/guards";
import { canManageDepartments } from "@/types/hr-department";

import DepartmentManagementClient from "../../../components/hr-admin/DepartmentManagementClient";

export default async function DepartmentManagementPage() {
  const user = await requireUser();

  if (!canManageDepartments(user.role)) {
    redirect("/hr-admin");
  }

  return <DepartmentManagementClient />;
}
