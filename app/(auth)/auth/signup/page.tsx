"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import AuthLayout from "../../../components/auth/AuthLayout";
import Button from "../../../components/atoms/buttons/Button";
import ImageInput from "../../../components/atoms/inputs/ImageInput";
import PasswordInput from "../../../components/atoms/inputs/PasswordInput";
import Text from "../../../components/atoms/Text/Text";
import TextInput from "../../../components/atoms/inputs/TextInput";
import { trpc } from "@/trpc/client";

const roleLabelMap: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ORG_OWNER: "Org Owner",
  ORG_ADMIN: "Org Admin",
  HR_ADMIN: "HR Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const schema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    preferredName: z.string().optional(),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .max(64, { message: "Password is too long" }),
    confirm_password: z
      .string()
      .min(8, { message: "Confirm password is required" }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams?.get("token") ?? null;

  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState("/dp.png");
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      preferredName: "",
      password: "",
      confirm_password: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = form;

  const inviteQuery = trpc.auth.inviteDetails.useQuery(
    { token: inviteToken ?? "" },
    { enabled: Boolean(inviteToken) },
  );

  const completeInvite = trpc.auth.completeInvite.useMutation({
    onSuccess: () => {
      setServerError(null);
      setServerMessage("Invitation accepted. Redirecting you to sign in...");
      setShowSuccessModal(true);
    },
    onError: (error) => {
      setServerMessage(null);
      setServerError(error.message ?? "Unable to complete your invitation.");
    },
  });
  const isSubmitting = completeInvite.isPending;

  useEffect(() => {
    if (inviteQuery.data) {
      reset({
        firstName: inviteQuery.data.firstName ?? "",
        lastName: inviteQuery.data.lastName ?? "",
        preferredName: inviteQuery.data.preferredName ?? "",
        password: "",
        confirm_password: "",
      });
      setPhotoUrl(inviteQuery.data.profilePhotoUrl ?? "/dp.png");
    }
  }, [inviteQuery.data, reset]);

  useEffect(() => {
    if (!showSuccessModal) {
      return;
    }
    const timeout = setTimeout(() => {
      router.push("/auth/login");
    }, 3000);
    return () => clearTimeout(timeout);
  }, [showSuccessModal, router]);

  const invitationSummary = useMemo(() => {
    if (!inviteQuery.data) {
      return [];
    }
    const details = inviteQuery.data;
    return [
      { label: "Organization", value: details.organizationName },
      { label: "Department", value: details.departmentName ?? "—" },
      {
        label: "Role",
        value: `${roleLabelMap[details.role] ?? details.role}${
          details.designation ? ` · ${details.designation}` : ""
        }`,
      },
      { label: "Work email", value: details.email },
      { label: "Tentative start", value: formatDate(details.startDate) },
    ];
  }, [inviteQuery.data]);

  const handleProfilePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Please choose an image smaller than 5MB.");
      event.target.value = "";
      return;
    }

    setPhotoError(null);
    setIsPhotoUploading(true);
    const previewUrl = URL.createObjectURL(file);
    setPhotoUrl(previewUrl);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/signup/photo", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to upload photo");
      }
      setPhotoUrl(payload.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload image.";
      setPhotoError(message);
    } finally {
      setIsPhotoUploading(false);
      URL.revokeObjectURL(previewUrl);
      event.target.value = "";
    }
  };

  const handleOnSubmit = (data: FormData) => {
    setServerError(null);
    setServerMessage(null);

    if (!inviteToken) {
      setServerError("A valid invitation link is required.");
      return;
    }

    if (!photoUrl || photoUrl === "/dp.png") {
      setPhotoError("Please upload your profile photo.");
      return;
    }

    completeInvite.mutate({
      token: inviteToken,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      preferredName: data.preferredName?.trim() || undefined,
      password: data.password,
      profilePhotoUrl: photoUrl,
    });
  };

  const handleLoginButton = () => {
    router.push("/auth/login");
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit(handleOnSubmit)} className="space-y-6" autoComplete="off">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
          Invitation details
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {invitationSummary.map((item) => (
            <div key={item.label}>
              <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {item.label}
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ImageInput
            id="invite-profile-photo"
            initialImage={photoUrl}
            isUploading={isPhotoUploading}
            error={photoError}
            onChange={handleProfilePhotoChange}
          />
          <div className="text-sm text-slate-500 dark:text-slate-400">
            <p className="font-semibold text-slate-900 dark:text-white">Profile photo</p>
            <p>Uploads save immediately · JPG/PNG/WEBP · Max 5 MB</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <TextInput
            label="First name"
            className="w-full"
            name="firstName"
            register={register}
            isRequired
            error={errors.firstName}
          />
          <TextInput
            label="Last name"
            className="w-full"
            name="lastName"
            register={register}
            isRequired
            error={errors.lastName}
          />
          <TextInput
            label="Preferred name"
            className="w-full md:col-span-2"
            name="preferredName"
            register={register}
            error={errors.preferredName}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PasswordInput
          label="Password"
          name="password"
          register={register}
          placeholder="Enter a new password"
          error={errors.password}
        />
        <PasswordInput
          label="Confirm password"
          name="confirm_password"
          register={register}
          placeholder="Re-type your password"
          error={errors.confirm_password}
        />
      </div>

      {serverError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {serverError}
        </p>
      ) : null}
      {serverMessage ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
          {serverMessage}
        </p>
      ) : null}

      <Button type="submit" theme="primary" isWidthFull disabled={isSubmitting || isPhotoUploading}>
        <Text
          text={
            isPhotoUploading
              ? "Uploading photo..."
              : isSubmitting
                ? "Completing invitation..."
                : "Create account"
          }
          className="text-[16px] font-semibold"
        />
      </Button>
    </form>
  );

  const layoutTitle = inviteQuery.data
    ? `Join ${inviteQuery.data.organizationName}`
    : "Accept your invitation";

  const content = (() => {
    if (!inviteToken) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          A valid invitation link is required to create an account. Please check your email for the
          latest invite or contact your HR administrator.
        </div>
      );
    }

    if (inviteQuery.isLoading) {
      return (
        <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
          Checking your invitation...
        </div>
      );
    }

    if (inviteQuery.isError || !inviteQuery.data) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {inviteQuery.error?.message ?? "We couldn't validate your invitation. Please request a new link."}
        </div>
      );
    }

    return renderForm();
  })();

  return (
    <>
      <AuthLayout
        title={layoutTitle}
        subtitle="Let’s confirm a few details and set up your secure access."
        description="We pre-filled everything your administrator provided. You can update your preferred name and choose a password."
        helper="This link is unique to you. Keep it private."
        badge="Invitation"
        footer={
          <p className="text-sm">
            Already have an account?
            <button
              type="button"
              onClick={handleLoginButton}
              className="ml-2 font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-sky-400 dark:hover:text-sky-300"
            >
              Sign in instead
            </button>
          </p>
        }
        showcase={{
          footer: (
            <Button onClick={handleLoginButton} theme="white" isWidthFull>
              <Text text="Return to login" className="text-[15px] font-semibold" />
            </Button>
          ),
        }}
      >
        {content}
      </AuthLayout>
      {showSuccessModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/20 bg-white p-8 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <Text text="Invitation accepted" className="text-2xl font-semibold text-text_primary" />
            <p className="text-sm text-text_secondary">
              Your account is ready. You’ll be redirected to login so you can access your workspace.
            </p>
            <Button theme="primary" isWidthFull onClick={() => router.push("/auth/login")}>
              <Text text="Go to login" className="font-semibold" />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default SignupPage;
