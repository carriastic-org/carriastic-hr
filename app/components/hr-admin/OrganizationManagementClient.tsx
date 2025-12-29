"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiShield,
  FiUserMinus,
  FiUserPlus,
} from "react-icons/fi";

import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import SelectBox from "@/app/components/atoms/selectBox/SelectBox";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { trpc } from "@/trpc/client";
import { uploadOrganizationLogo } from "@/lib/upload-organization-logo";
import { DEFAULT_ORGANIZATION_LOGO } from "@/lib/organization-branding";

type AlertState = { type: "success" | "error"; message: string } | null;

const AlertBanner = ({ alert }: { alert: AlertState }) => {
  if (!alert) return null;
  const Icon = alert.type === "success" ? FiCheckCircle : FiAlertCircle;
  const baseClasses =
    alert.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${baseClasses}`}
    >
      <Icon className="text-base" />
      <p className="font-semibold">{alert.message}</p>
    </div>
  );
};

const detailFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatOptionalDate = (value?: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return detailFormatter.format(date);
};

const normalizeField = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export default function OrganizationManagementClient() {
  const utils = trpc.useUtils();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    string | null
  >(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [detailsForm, setDetailsForm] = useState({
    name: "",
    domain: "",
    timezone: "",
    locale: "",
    logoUrl: DEFAULT_ORGANIZATION_LOGO,
  });
  const [logoPreview, setLogoPreview] = useState(DEFAULT_ORGANIZATION_LOGO);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const managementQuery = trpc.hrOrganization.management.useQuery(
    selectedOrganizationId
      ? { organizationId: selectedOrganizationId }
      : undefined,
    {
      refetchOnWindowFocus: false,
    }
  );
  const updateDetailsMutation = trpc.hrOrganization.updateDetails.useMutation();
  const addAdminMutation = trpc.hrOrganization.addAdmin.useMutation();
  const removeAdminMutation = trpc.hrOrganization.removeAdmin.useMutation();
  const deleteOrganizationMutation =
    trpc.hrOrganization.deleteOrganization.useMutation();

  const viewerRole = managementQuery.data?.viewerRole;
  const isSuperAdmin = viewerRole === "SUPER_ADMIN";

  const organization = managementQuery.data?.organization ?? null;
  const admins = managementQuery.data?.admins ?? [];
  const eligibleMembers = managementQuery.data?.eligibleMembers ?? [];

  useEffect(() => {
    if (organization) {
      setDetailsForm({
        name: organization.name,
        domain: organization.domain ?? "",
        timezone: organization.timezone ?? "",
        locale: organization.locale ?? "",
        logoUrl: organization.logoUrl ?? DEFAULT_ORGANIZATION_LOGO,
      });
      setLogoPreview(organization.logoUrl ?? DEFAULT_ORGANIZATION_LOGO);
      setLogoError(null);
    } else {
      setDetailsForm({
        name: "",
        domain: "",
        timezone: "",
        locale: "",
        logoUrl: DEFAULT_ORGANIZATION_LOGO,
      });
      setLogoPreview(DEFAULT_ORGANIZATION_LOGO);
      setLogoError(null);
    }
  }, [organization?.id]);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), 4000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  useEffect(() => {
    setSelectedMemberId("");
  }, [organization?.id]);

  const eligibleOptions = useMemo(
    () =>
      eligibleMembers.map((member) => ({
        value: member.id,
        label: `${member.name} (${member.role.replace("_", " ")})`,
      })),
    [eligibleMembers]
  );

  const handleDetailsSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetOrgId = isSuperAdmin
      ? selectedOrganizationId ?? organization?.id ?? null
      : organization?.id ?? null;
    if (!targetOrgId) {
      setAlert({
        type: "error",
        message: "Select an organization before updating details.",
      });
      return;
    }
    const payload = {
      name: detailsForm.name.trim(),
      domain: normalizeField(detailsForm.domain),
      timezone: normalizeField(detailsForm.timezone),
      locale: normalizeField(detailsForm.locale),
      logoUrl: detailsForm.logoUrl.trim(),
    };
    if (!payload.name.length) {
      setAlert({
        type: "error",
        message: "Organization name cannot be empty.",
      });
      return;
    }
    if (!payload.logoUrl.length) {
      setAlert({
        type: "error",
        message: "Upload an organization logo before saving.",
      });
      return;
    }
    updateDetailsMutation.mutate(
      {
        ...payload,
        ...(isSuperAdmin ? { organizationId: targetOrgId } : {}),
      },
      {
        onSuccess: () => {
          setAlert({
            type: "success",
            message: "Organization details updated.",
          });
          void utils.hrOrganization.management.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
      }
    );
  };

  const handleLogoChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setLogoError(null);
    setIsUploadingLogo(true);
    try {
      const uploadedUrl = await uploadOrganizationLogo(file, {
        organizationId: organization?.id,
      });
      setDetailsForm((prev) => ({ ...prev, logoUrl: uploadedUrl }));
      setLogoPreview(uploadedUrl);
    } catch (error) {
      setLogoError(
        error instanceof Error ? error.message : "Failed to upload logo."
      );
    } finally {
      setIsUploadingLogo(false);
      event.target.value = "";
    }
  };

  const handleUseDefaultLogo = () => {
    setDetailsForm((prev) => ({ ...prev, logoUrl: DEFAULT_ORGANIZATION_LOGO }));
    setLogoPreview(DEFAULT_ORGANIZATION_LOGO);
    setLogoError(null);
  };

  const handleAddAdmin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization) {
      setAlert({
        type: "error",
        message: "Select an organization before assigning admins.",
      });
      return;
    }
    if (!selectedMemberId) {
      setAlert({
        type: "error",
        message: "Select a team member to promote to Org Admin.",
      });
      return;
    }
    addAdminMutation.mutate(
      { userId: selectedMemberId },
      {
        onSuccess: () => {
          setAlert({
            type: "success",
            message: "Org Admin added successfully.",
          });
          setSelectedMemberId("");
          void utils.hrOrganization.management.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
      }
    );
  };

  const handleRemoveAdmin = (userId: string) => {
    setPendingRemovalId(userId);
    removeAdminMutation.mutate(
      { userId },
      {
        onSuccess: () => {
          setAlert({ type: "success", message: "Org Admin access removed." });
          void utils.hrOrganization.management.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
        onSettled: () => setPendingRemovalId(null),
      }
    );
  };

  if (managementQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <LoadingSpinner
          label="Loading organization settings..."
          helper="Fetching workspace profile, admins, and eligible members."
        />
      </div>
    );
  }

  if (managementQuery.isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center text-slate-600 dark:text-slate-300">
        <p>We couldn&apos;t load organization management right now.</p>
        <Button onClick={() => managementQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-950/60 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Organization Management
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
            Keep your workspace profile accurate
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Update organization details, review Org Admin access, or archive
            entire workspaces when they&apos;re no longer needed.
          </p>
        </div>
        {managementQuery.data?.canCreateOrganizations ? (
          <Button
            href="/hr-admin/organization/create"
            className="self-start rounded-2xl px-6 py-3 text-base"
          >
            Create new organization
          </Button>
        ) : null}
      </div>

      <AlertBanner alert={alert} />

      {organization ? (
        <>
          <section className="grid gap-6 lg:grid-cols-3">
            <form
              onSubmit={handleDetailsSubmit}
              className="lg:col-span-2 space-y-4 rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-lg shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-950/60"
            >
              <div className="flex items-center gap-3">
                <FiShield className="text-2xl text-indigo-500" />
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Workspace profile
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    These details power invites, email domains, and timezone
                    defaults.
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-dashed border-slate-200/70 p-4 dark:border-slate-700/60">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                  Organization logo
                </p>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <Image
                      src={logoPreview}
                      alt="Organization logo preview"
                      width={80}
                      height={80}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="space-y-2 text-sm">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-2 font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoChange}
                        disabled={isUploadingLogo}
                      />
                      {isUploadingLogo ? "Uploading..." : "Change logo"}
                    </label>
                    <button
                      type="button"
                      onClick={handleUseDefaultLogo}
                      disabled={isUploadingLogo}
                      className="block rounded-xl border border-slate-200 bg-transparent px-4 py-2 font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800/60"
                    >
                      Use default logo
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      PNG, JPG, or WEBP files up to 5MB.
                    </p>
                    {logoError ? (
                      <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                        {logoError}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <TextInput
                label="Organization name"
                isRequired
                value={detailsForm.name}
                onChange={(event) =>
                  setDetailsForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
              <TextInput
                label="Email domain"
                placeholder="example.com"
                value={detailsForm.domain}
                onChange={(event) =>
                  setDetailsForm((prev) => ({
                    ...prev,
                    domain: event.target.value,
                  }))
                }
              />
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Default timezone"
                  placeholder="Asia/Dhaka"
                  value={detailsForm.timezone}
                  onChange={(event) =>
                    setDetailsForm((prev) => ({
                      ...prev,
                      timezone: event.target.value,
                    }))
                  }
                />
                <TextInput
                  label="Locale"
                  placeholder="en-US"
                  value={detailsForm.locale}
                  onChange={(event) =>
                    setDetailsForm((prev) => ({
                      ...prev,
                      locale: event.target.value,
                    }))
                  }
                />
              </div>
              <Button
                type="submit"
                disabled={updateDetailsMutation.isPending || isUploadingLogo}
                className="rounded-2xl px-5 py-2 text-sm"
              >
                {updateDetailsMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>

            <div className="space-y-4 rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-lg shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-950/60">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Organization snapshot
              </h3>
              <div className="rounded-2xl border border-indigo-50 bg-indigo-50/70 p-4 text-indigo-900 dark:border-slate-700/70 dark:bg-indigo-500/10 dark:text-indigo-100">
                <p className="text-xs uppercase tracking-wide text-indigo-500 dark:text-indigo-300">
                  Total teammates
                </p>
                <p className="text-3xl font-bold">
                  {organization.totalEmployees}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Created
                </p>
                <p>{formatOptionalDate(organization.createdAtIso)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Last updated
                </p>
                <p>{formatOptionalDate(organization.updatedAtIso)}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-lg shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-950/60">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Org Admins
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Promote trusted teammates to help manage departments, work
                    policies, and invites.
                  </p>
                </div>
                <div className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                  {admins.length} admins
                </div>
              </div>
              <div className="space-y-3">
                {admins.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No Org Admins yet. Promote a teammate using the form on the
                    right.
                  </p>
                ) : (
                  admins.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-sm shadow-sm dark:border-slate-700/70 dark:bg-slate-800/70"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {admin.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {admin.designation ?? "Org Admin"}
                        </p>
                      </div>
                      <Button
                        theme="cancel-secondary"
                        className="rounded-xl px-3 py-1 text-xs"
                        disabled={
                          pendingRemovalId === admin.id ||
                          removeAdminMutation.isPending
                        }
                        onClick={() => handleRemoveAdmin(admin.id)}
                      >
                        <span className="flex items-center gap-1">
                          <FiUserMinus />
                          {pendingRemovalId === admin.id
                            ? "Removing..."
                            : "Remove"}
                        </span>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form
              onSubmit={handleAddAdmin}
              className="space-y-4 rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-lg shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-950/60"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
                  <FiUserPlus />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Promote a teammate
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Choose any HR Admin, Manager, or Employee to grant Org Admin
                    access.
                  </p>
                </div>
              </div>
              <SelectBox
                label="Select team member"
                options={eligibleOptions}
                includePlaceholder
                placeholderLabel={
                  eligibleOptions.length
                    ? "Choose a teammate"
                    : "No eligible teammates found"
                }
                value={selectedMemberId}
                onChange={(event) => setSelectedMemberId(event.target.value)}
                isDisabled={
                  !eligibleOptions.length || addAdminMutation.isPending
                }
              />
              <Button
                type="submit"
                disabled={!eligibleOptions.length || addAdminMutation.isPending}
                className="rounded-2xl px-4 py-2 text-sm"
              >
                {addAdminMutation.isPending ? "Adding..." : "Add Org Admin"}
              </Button>
            </form>
          </section>
        </>
      ) : (
        <div className="rounded-[32px] border border-dashed border-slate-300 bg-white/80 p-8 text-center text-slate-600 shadow-inner dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          <p className="text-lg font-semibold">
            {isSuperAdmin
              ? "Select an organization from the list above."
              : "You are not linked to an organization yet."}
          </p>
          <p className="mt-2 text-sm">
            {isSuperAdmin
              ? "Pick a workspace to inspect or create a new one to get started."
              : "Ask a Super Admin to assign you to an organization to unlock these controls."}
          </p>
          {isSuperAdmin && managementQuery.data?.canCreateOrganizations ? (
            <Button
              href="/hr-admin/organization/create"
              className="mt-4 rounded-xl px-4 py-2 text-sm"
            >
              Create the first organization
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
