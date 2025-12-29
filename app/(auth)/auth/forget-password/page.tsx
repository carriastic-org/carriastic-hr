"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useState } from "react";

import AuthLayout from "../../../components/auth/AuthLayout";
import Button from "../../../components/atoms/buttons/Button";
import EmailInput from "../../../components/atoms/inputs/EmailInput";
import Text from "../../../components/atoms/Text/Text";

const schema = z.object({
  email: z
    .string()
    .nonempty({ message: "Email is required" })
    .email({ message: "Enter a valid email address" }),
});

type FormData = z.infer<typeof schema>;

function ForgetPasswordPage() {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    handleSubmit,
    formState: { errors },
    register,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleLoginButton = () => {
    router.push("/auth/login");
  };

  const handleSubmitForm = async (data: FormData) => {
    setIsSubmitting(true);
    setServerMessage(null);
    setServerError(null);

    try {
      const response = await fetch("/api/forget-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });

      let payload: { message?: string } | undefined;
      try {
        payload = await response.json();
      } catch {
        payload = undefined;
      }

      if (response.status === 404) {
        const message =
          payload?.message || "We couldn't find an account with that email address.";
        window.alert(message);
        throw new Error(message);
      }

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to process the request.");
      }

      setServerError(null);
      setServerMessage(
        payload?.message || "If that account exists, a reset link is on the way.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to process the request.";
      setServerMessage(null);
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Need a reset link?"
      subtitle="We’ll send a secure password reset link to your inbox."
      description="For security purposes, reset links expire after 30 minutes. If you don’t see the email, remember to check spam."
      helper="Enter the email associated with your workspace account. We’ll confirm your identity before you can pick a new password."
      badge="Recovery portal"
      footer={
        <p className="text-sm">
          Remembered your password?
          <button
            type="button"
            onClick={handleLoginButton}
            className="ml-2 font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-sky-400 dark:hover:text-sky-300"
          >
            Back to login
          </button>
        </p>
      }
      showShowcase={false}
    >
      <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-6">
        <EmailInput
          name="email"
          error={errors?.email}
          label="Work email"
          register={register}
          placeholder="you@ndi.team"
          isRequired
        />
        {serverError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
            {serverError}
          </p>
        ) : null}
        {serverMessage ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
            {serverMessage}
          </p>
        ) : null}

        <Button type="submit" theme="primary" isWidthFull disabled={isSubmitting}>
          <Text
            text={isSubmitting ? "Sending link..." : "Send reset link"}
            className="text-[16px] font-semibold"
          />
        </Button>
      </form>
    </AuthLayout>
  );
}

export default ForgetPasswordPage;
