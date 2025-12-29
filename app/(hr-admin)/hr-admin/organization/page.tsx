import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { canManageOrganization } from "@/types/hr-organization";
import OrganizationManagementClient from "@/app/components/hr-admin/OrganizationManagementClient";

export default async function OrganizationManagementPage() {
  const user = await requireUser();

  if (!canManageOrganization(user.role)) {
    redirect("/hr-admin");
  }

  return <OrganizationManagementClient />;
}
