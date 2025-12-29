"use client";

import Image from "next/image";
import { ReactNode } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import Button from "@/app/components/atoms/buttons/Button";
import Text from "@/app/components/atoms/Text/Text";
import Header from "@/app/components/navigations/Header";
import { useTheme } from "@/app/components/theme/ThemeProvider";

type ShowcaseContent = {
  eyebrow: string;
  title: string;
  description: string;
  image: {
    src: string;
    alt: string;
  };
  footer?: ReactNode;
};

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  description?: string;
  helper?: string;
  badge?: string;
  children: ReactNode;
  footer?: ReactNode;
  showcase?: Partial<ShowcaseContent>;
  showShowcase?: boolean;
};

type ThemeToggleButtonProps = {
  className?: string;
};

function ThemeToggleButton({ className = "" }: ThemeToggleButtonProps) {
  const { preference, resolvedTheme, toggleTheme } = useTheme();
  const isSystem = preference === "system";
  const isDark = resolvedTheme === "dark";

  const label = isSystem
    ? `System · ${isDark ? "dark" : "light"}`
    : isDark
    ? "Dark mode"
    : "Light mode";

  const helper = isSystem ? "Matches device setting" : "Manual override";
  const nextThemeLabel = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group inline-flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 text-left text-sm font-medium text-slate-600 shadow-sm shadow-slate-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:shadow-slate-950/40 dark:hover:border-slate-600 ${className}`}
      aria-label={`Switch to ${nextThemeLabel} theme`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-sky-500/10 text-lg text-indigo-500 transition-colors dark:from-slate-800 dark:to-slate-900 dark:text-sky-300">
        {isDark ? <FiMoon /> : <FiSun />}
      </span>
      <span className="flex flex-1 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400 transition-colors duration-150 dark:text-slate-500">
          Theme
        </span>
        <span className="text-sm font-semibold text-slate-900 transition-colors duration-150 dark:text-slate-100">
          {label}
        </span>
        <span className="text-xs text-slate-400 transition-colors duration-150 dark:text-slate-500">
          {helper}
        </span>
      </span>
    </button>
  );
}

const defaultShowcase: ShowcaseContent = {
  eyebrow: "People Ops OS",
  title: "Bring clarity to every HR ritual",
  description:
    "Automate attendance, keep policies visible, and give your teams the context they need to show up prepared.",
  image: {
    src: "/forgetPass.png",
    alt: "Illustration of HR collaboration",
  },
  footer: (
    <Button theme="white" isWidthFull>
      <Text text="Talk to People Ops" className="text-[15px] font-semibold" />
    </Button>
  ),
};

export default function AuthLayout({
  title,
  subtitle,
  description,
  helper,
  badge = "Secure access",
  children,
  footer,
  showcase,
  showShowcase = true,
}: AuthLayoutProps) {
  const hero: ShowcaseContent = {
    ...defaultShowcase,
    ...showcase,
    image: {
      ...defaultShowcase.image,
      ...showcase?.image,
    },
    footer: showcase?.footer ?? defaultShowcase.footer,
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-15%] h-64 w-64 rounded-full bg-sky-200/60 blur-[120px] dark:bg-slate-900" />
        <div className="absolute right-[-5%] top-0 h-80 w-80 rounded-full bg-indigo-200/60 blur-[140px] dark:bg-slate-900" />
        <div className="absolute inset-x-0 bottom-[-20%] h-96 bg-gradient-to-t from-slate-200/70 to-transparent dark:from-slate-900/50" />
      </div>

      <div className="fixed left-0 right-0 top-4 z-40 px-4 sm:top-6 sm:px-6">
        <Header />
      </div>

      <div className="relative z-10 flex min-h-screen items-center px-4 pb-16 pt-28 sm:px-6 sm:pb-12 sm:pt-32 lg:pt-36">
        <div
          className={`mx-auto ${
            showShowcase
              ? "grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr,0.95fr] lg:gap-8"
              : "w-full max-w-lg sm:max-w-xl"
          }`}
        >
          {showShowcase ? (
            <section className="order-2 rounded-[32px] border border-white/30 bg-gradient-to-br from-indigo-600 via-sky-500 to-cyan-400 p-6 text-white shadow-2xl shadow-sky-500/30 backdrop-blur-lg dark:border-slate-900/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 dark:shadow-slate-950 sm:p-8 lg:order-1 lg:p-10">
              <span className="inline-flex items-center rounded-full border border-white/30 px-4 py-1 text-xs uppercase tracking-[0.3em] text-white/80">
                {hero.eyebrow}
              </span>
              <h2 className="mt-6 text-3xl font-semibold leading-tight md:text-4xl">
                {hero.title}
              </h2>
              <p className="mt-4 text-base text-white/80 md:text-lg">
                {hero.description}
              </p>

              <div className="relative mt-8 overflow-hidden rounded-[28px] border border-white/20 bg-white/10">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/30 via-transparent to-transparent" />
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={hero.image.src}
                    alt={hero.image.alt}
                    fill
                    className="object-contain p-6"
                    sizes="(max-width: 1024px) 100vw, 600px"
                    priority
                  />
                </div>
              </div>

              <div className="mt-8">{hero.footer}</div>
            </section>
          ) : null}

          <section className="order-1 rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/50 sm:p-8 lg:order-2 lg:p-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
              <div className="space-y-3 lg:flex-1 lg:min-w-0">
                <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  {badge}
                </span>
                <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white">
                  {title}
                </h1>
                <p className="text-base text-slate-600 dark:text-slate-300">
                  {subtitle}
                </p>
                {description ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {description}
                  </p>
                ) : null}
              </div>
              <ThemeToggleButton className="lg:w-auto lg:min-w-[230px] lg:self-start" />
            </div>

            {helper ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                {helper}
              </div>
            ) : null}

            <div className="mt-8">{children}</div>

            {footer ? (
              <div className="mt-8 border-t border-slate-100 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {footer}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
