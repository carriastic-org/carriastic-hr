"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiPlusCircle } from "react-icons/fi";

import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
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
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${baseClasses}`}>
      <Icon className="text-base" />
      <p className="font-semibold">{alert.message}</p>
    </div>
  );
};

const initialFormState = {
  name: "",
  domain: "",
  timezone: "Asia/Dhaka",
  locale: "en-US",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  ownerDesignation: "Org Owner",
  sendInvite: true,
  logoUrl: DEFAULT_ORGANIZATION_LOGO,
};

export default function CreateOrganizationClient() {
  const [form, setForm] = useState(initialFormState);
  const [alert, setAlert] = useState<AlertState>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState(DEFAULT_ORGANIZATION_LOGO);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const createOrganizationMutation = trpc.hrOrganization.createOrganization.useMutation();
  const organizationListQuery = trpc.hrOrganization.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const creationLocked = (organizationListQuery.data?.organizations.length ?? 0) > 0;

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), 4000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creationLocked) {
      setAlert({
        type: "error",
        message: "An organization already exists. Delete it before creating another.",
      });
      return;
    }
    if (!form.name.trim() || !form.ownerName.trim() || !form.ownerEmail.trim()) {
      setAlert({
        type: "error",
        message: "Organization name, owner name, and owner email are required.",
      });
      return;
    }
    setInviteUrl(null);
    createOrganizationMutation.mutate(
      {
        name: form.name.trim(),
        domain: form.domain.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        locale: form.locale.trim() || undefined,
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ownerPhone: form.ownerPhone.trim() || undefined,
        ownerDesignation: form.ownerDesignation.trim() || undefined,
        sendInvite: form.sendInvite,
        logoUrl: form.logoUrl?.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          setAlert({
            type: "success",
            message: `${result.organizationName} created. Invite sent to ${result.ownerEmail}.`,
          });
          setInviteUrl(result.inviteUrl);
          setForm(initialFormState);
          setLogoPreview(DEFAULT_ORGANIZATION_LOGO);
          setLogoError(null);
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
      },
    );
  };

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setLogoError(null);
    setIsUploadingLogo(true);
    try {
      const url = await uploadOrganizationLogo(file);
      setForm((prev) => ({ ...prev, logoUrl: url }));
      setLogoPreview(url);
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : "Failed to upload logo.");
    } finally {
      setIsUploadingLogo(false);
      event.target.value = "";
    }
  };

  const handleUseDefaultLogo = () => {
    setForm((prev) => ({ ...prev, logoUrl: DEFAULT_ORGANIZATION_LOGO }));
    setLogoPreview(DEFAULT_ORGANIZATION_LOGO);
    setLogoError(null);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-950/60">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Super admin action
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
              Create a new organization
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Spin up a fresh workspace and invite the Org Owner in one step. We&apos;ll provision the organization and send the owner an onboarding link.
            </p>
          </div>
          <Button href="/hr-admin/organization" className="rounded-2xl px-5 py-2 text-sm">
            Back to organization settings
          </Button>
        </div>
      </div>

      <AlertBanner alert={alert} />
      {creationLocked ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          An organization already exists in this workspace. Delete the current workspace before creating another.
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-lg shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-950/60"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-indigo-500/10 p-3 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-200">
            <FiPlusCircle className="text-xl" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Organization details
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Give the workspace a name, optional domain, and defaults for timezone and locale.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-dashed border-slate-200/70 p-4 dark:border-slate-700/60">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
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
                  disabled={isUploadingLogo || creationLocked}
                />
                {isUploadingLogo ? "Uploading..." : "Choose logo"}
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
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">{logoError}</p>
              ) : null}
            </div>
          </div>
        </div>

        <TextInput
          label="Organization name"
          isRequired
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
        <TextInput
          label="Email domain (optional)"
          placeholder="example.com"
          value={form.domain}
          onChange={(event) => setForm((prev) => ({ ...prev, domain: event.target.value }))}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Default timezone"
            value={form.timezone}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, timezone: event.target.value }))
            }
          />
          <TextInput
            label="Locale"
            value={form.locale}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, locale: event.target.value }))
            }
          />
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />

        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Org Owner invitation
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            We&apos;ll create the owner account with inactive status and send them a secure invite link.
          </p>
        </div>

        <TextInput
          label="Owner full name"
          isRequired
          value={form.ownerName}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, ownerName: event.target.value }))
          }
        />
        <TextInput
          label="Owner work email"
          isRequired
          type="email"
          value={form.ownerEmail}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, ownerEmail: event.target.value }))
          }
        />
        <TextInput
          label="Owner phone number"
          placeholder="+8801XXXXXXXXX"
          value={form.ownerPhone}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, ownerPhone: event.target.value }))
          }
        />
        <TextInput
          label="Owner designation"
          value={form.ownerDesignation}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, ownerDesignation: event.target.value }))
          }
        />

        <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={form.sendInvite}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, sendInvite: event.target.checked }))
            }
            className="h-5 w-5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400 dark:border-slate-600 dark:bg-slate-800"
          />
          Send invite email automatically
        </label>

        <Button
          type="submit"
          disabled={createOrganizationMutation.isPending || isUploadingLogo || creationLocked}
          className="rounded-2xl px-6 py-2 text-base"
        >
          {creationLocked
            ? "Organization already exists"
            : createOrganizationMutation.isPending
              ? "Creating..."
              : "Create organization"}
        </Button>

        {inviteUrl ? (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-sm text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
            <p className="font-semibold">Invite link</p>
            <p className="break-all text-xs">{inviteUrl}</p>
            <p className="mt-2 text-xs">
              Share this link with the Org Owner if the email invitation is delayed.
            </p>
          </div>
        ) : null}
      </form>
    </div>
  );
}
