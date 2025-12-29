"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import AuthLayout from "../../../components/auth/AuthLayout";
import Button from "../../../components/atoms/buttons/Button";
import EmailInput from "../../../components/atoms/inputs/EmailInput";
import PasswordInput from "../../../components/atoms/inputs/PasswordInput";
import Text from "../../../components/atoms/Text/Text";

const passwordPattern = /^.{8,}$/;

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .regex(passwordPattern, "Password must be at least 8 characters."),
});

type FormData = z.infer<typeof schema>;

function LoginPage() {
  const router = useRouter();
  const [rememberMe, setRememberMe] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberedEmail");

    if (rememberedEmail) {
      setValue("email", rememberedEmail);
      setRememberMe(true);
    }
  }, [setValue]);

  const handleForgotPasswordClick = () => {
    router.push("/auth/forget-password");
  };

  const toggleRememberMe = (event: ChangeEvent<HTMLInputElement>) => {
    setRememberMe(event.target.checked);
  };

  const persistRememberedCredentials = (data: FormData) => {
    if (rememberMe) {
      localStorage.setItem("rememberedEmail", data.email);
    } else {
      localStorage.removeItem("rememberedEmail");
    }
  };

  const attemptSignIn = async (data: FormData) => {
    const response = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
      callbackUrl: "/",
    });

    if (!response || response.error || response.status === 401) {
      throw new Error("Invalid email or password.");
    }

    persistRememberedCredentials(data);
    router.push(response.url ?? "/");
  };

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      await attemptSignIn(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in right now.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue."
      description="Use your work email and password to access your dashboard."
      helper="Forgot your credentials? Use the recovery link below."
      showShowcase={false}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <EmailInput
            name="email"
            error={errors?.email}
            label="Work email"
            register={register}
            placeholder="you@company.com"
            isRequired
          />
          <PasswordInput
            name="password"
            error={errors?.password}
            register={register}
            label="Password"
            placeholder="Enter your password"
            isRequired
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
              checked={rememberMe}
              onChange={toggleRememberMe}
            />
            <span>Remember my email</span>
          </label>
          <button
            type="button"
            onClick={handleForgotPasswordClick}
            className="font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-sky-400 dark:hover:text-sky-300"
          >
            Forgot password?
          </button>
        </div>

        {formError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
            {formError}
          </p>
        ) : null}
        <Button type="submit" theme="primary" isWidthFull disabled={isSubmitting}>
          <Text text={isSubmitting ? "Signing in..." : "Sign in"} className="text-[16px] font-semibold" />
        </Button>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
