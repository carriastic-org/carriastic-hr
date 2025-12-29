import { UserRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/api/trpc";
import { canManageTeams } from "@/types/hr-team";
import { canManageWork } from "@/types/hr-work";
import { canManageOrganization } from "@/types/hr-organization";
import { canManageDepartments } from "@/types/hr-department";
import { canManageProjects } from "@/types/hr-project";

const HR_ALLOWED_ROLES: UserRole[] = [
  "HR_ADMIN",
  "MANAGER",
  "ORG_OWNER",
  "ORG_ADMIN",
  "SUPER_ADMIN",
];

export const requireHrAdmin = (ctx: TRPCContext) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = ctx.session.user;
  if (!HR_ALLOWED_ROLES.includes(user.role as UserRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "HR access required." });
  }

  if (!user.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Join an organization to manage employees.",
    });
  }

  return user;
};

export const requireTeamManager = (ctx: TRPCContext) => {
  const user = requireHrAdmin(ctx);
  if (!canManageTeams(user.role as UserRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Manager, org admin, org owner, or super admin access required.",
    });
  }
  return user;
};

export const requireDepartmentManager = (ctx: TRPCContext) => {
  const user = requireHrAdmin(ctx);
  if (!canManageDepartments(user.role as UserRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only org admins, org owners, or super admins can manage departments.",
    });
  }
  return user;
};

export const requireProjectManager = (ctx: TRPCContext) => {
  const user = requireHrAdmin(ctx);
  if (!canManageProjects(user.role as UserRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only managers, org admins, org owners, or super admins can manage projects.",
    });
  }
  return user;
};

export const requireWorkManager = (ctx: TRPCContext) => {
  const user = requireHrAdmin(ctx);
  if (!canManageWork(user.role as UserRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only org owners, org admins, or super admins can manage work policies.",
    });
  }
  return user;
};

export const requireOrganizationManager = (ctx: TRPCContext) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const user = ctx.session.user;
  if (!canManageOrganization(user.role as UserRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only org owners or super admins can manage organization settings.",
    });
  }
  if (!user.organizationId && user.role !== "SUPER_ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Join an organization to manage organization settings.",
    });
  }
  return user;
};

export const requireSuperAdmin = (ctx: TRPCContext) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (ctx.session.user.role !== "SUPER_ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Super admin access required.",
    });
  }
  return ctx.session.user;
};

const ROLE_ORDER: UserRole[] = [
  "EMPLOYEE",
  "HR_ADMIN",
  "MANAGER",
  "ORG_ADMIN",
  "ORG_OWNER",
  "SUPER_ADMIN",
];

const ROLE_RANK = ROLE_ORDER.reduce<Record<UserRole, number>>((acc, role, index) => {
  acc[role] = index;
  return acc;
}, {} as Record<UserRole, number>);

type PermissionResult = {
  allowed: boolean;
  reason: string | null;
};

export type RolePermissionResult = PermissionResult;

const buildPermissionResult = (allowed: boolean, reason?: string | null): PermissionResult => ({
  allowed,
  reason: reason ?? null,
});

export const isRoleSenior = (targetRole: UserRole, viewerRole: UserRole) =>
  (ROLE_RANK[targetRole] ?? 0) > (ROLE_RANK[viewerRole] ?? 0);

export const getEditPermission = (
  viewerRole: UserRole,
  targetRole: UserRole,
): PermissionResult => {
  if (viewerRole === "EMPLOYEE") {
    return buildPermissionResult(false, "Employees can’t edit other team members.");
  }

  if (targetRole === "SUPER_ADMIN") {
    return buildPermissionResult(false, "Super Admin profiles can’t be edited.");
  }

  if (targetRole === "ORG_OWNER" && viewerRole !== "SUPER_ADMIN") {
    return buildPermissionResult(false, "Only Super Admins can edit Org Owners.");
  }

  if (
    (viewerRole === "HR_ADMIN" || viewerRole === "MANAGER") &&
    (targetRole === "MANAGER" || targetRole === "ORG_ADMIN")
  ) {
    return buildPermissionResult(
      false,
      "Managers and HR admins can’t edit Manager or Org Admin accounts.",
    );
  }

  return buildPermissionResult(true);
};

export const getTerminationPermission = (
  viewerRole: UserRole,
  targetRole: UserRole,
  options?: { isSelf?: boolean },
): PermissionResult => {
  if (options?.isSelf) {
    return buildPermissionResult(false, "You can’t terminate your own account.");
  }

  if (viewerRole === "EMPLOYEE") {
    return buildPermissionResult(false, "Only admins can terminate employees.");
  }

  if (targetRole === "SUPER_ADMIN") {
    return buildPermissionResult(false, "Super Admin accounts can’t be terminated.");
  }

  if (isRoleSenior(targetRole, viewerRole)) {
    return buildPermissionResult(false, "You can’t terminate a senior position holder.");
  }

  return buildPermissionResult(true);
};
