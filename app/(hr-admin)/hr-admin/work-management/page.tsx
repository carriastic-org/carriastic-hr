import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { canManageWork } from "@/types/hr-work";
import WorkManagementClient from "@/app/components/hr-admin/WorkManagementClient";

export default async function WorkManagementPage() {
  const user = await requireUser();

  if (!canManageWork(user.role)) {
    redirect("/hr-admin");
  }

  return <WorkManagementClient />;
}
