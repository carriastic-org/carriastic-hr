"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "@/app/components/auth/AuthLayout";
import Button from "@/app/components/atoms/buttons/Button";
import PasswordInput from "@/app/components/atoms/inputs/PasswordInput";
import Text from "@/app/components/atoms/Text/Text";
import { trpc } from "@/trpc/client";

const schema = z
  .object({
    password: z
      .string()
      .nonempty({ message: "Password is required" })
      .min(8, { message: "Password must be at least 8 characters long" }),
    confirmPassword: z
      .string()
      .nonempty({ message: "Confirm Password is required" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormData = z.infer<typeof schema>;

type ResetPasswordClientProps = {
  token: string;
  userId: string;
};

export function ResetPasswordClient({ token, userId }: ResetPasswordClientProps) {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    handleSubmit,
    formState: { errors },
    register,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const updatePasswordMutation = trpc.auth.updateUserPassword.useMutation({
    onSuccess: () => {
      setServerError(null);
      setServerMessage("Password updated successfully. Please sign in.");
      router.push("/auth/login");
    },
    onError: (error) => {
      setServerMessage(null);
      setServerError(error.message || "Unable to reset the password.");
    },
  });

  const handleLogin = (data: FormData) => {
    if (!token || !userId) {
      setServerError("Reset link is invalid or has expired.");
      return;
    }

    setServerError(null);
    setServerMessage(null);
    updatePasswordMutation.mutate({
      userId,
      password: data.password,
    });
  };

  return (
    <AuthLayout
      title="Set a fresh password"
      subtitle="Choose a new password to finish securing your account."
      description="Make it unique. We recommend combining upper & lowercase letters, numbers, and special characters."
      helper="Tip: Avoid using previous passwords or other apps. We'll let you know if your new password meets our security requirements."
      badge="Recovery portal"
      footer={
        <p className="text-sm">
          Ready to jump back in?
          <button
            type="button"
            onClick={() => router.push("/auth/login")}
            className="ml-2 font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-sky-400 dark:hover:text-sky-300"
          >
            Go to login
          </button>
        </p>
      }
      showShowcase={false}
    >
      <form onSubmit={handleSubmit(handleLogin)} className="space-y-6">
        <PasswordInput
          name="password"
          error={errors?.password}
          register={register}
          label="New password"
          placeholder="Min. 8 characters"
          isRequired
        />
        <PasswordInput
          name="confirmPassword"
          error={errors?.confirmPassword}
          register={register}
          label="Confirm new password"
          placeholder="Re-enter password"
          isRequired
        />

        <ul className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          <li>At least 8 characters</li>
          <li>Include a number or symbol</li>
          <li>Avoid reusing old passwords</li>
        </ul>
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

        <Button
          type="submit"
          theme="primary"
          isWidthFull
          disabled={!token || !userId || updatePasswordMutation.isPending}
        >
          <Text
            text={updatePasswordMutation.isPending ? "Updating password..." : "Update password"}
            className="text-[16px] font-semibold"
          />
        </Button>
      </form>
    </AuthLayout>
  );
}
