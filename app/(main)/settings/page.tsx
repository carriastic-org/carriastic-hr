"use client";

import { useState } from "react";
import { Card } from "../../components/atoms/frame/Card";
import { ThemeSwitcher } from "../../components/theme/ThemeSwitcher";
import { useTheme } from "../../components/theme/ThemeProvider";
import Button from "../../components/atoms/buttons/Button";
import {
  FiBell,
  FiMail,
  FiMonitor,
  FiMoon,
  FiSun,
  FiZap,
} from "react-icons/fi";

type NotificationKey = "email" | "push" | "reminders";

const themeOptions = [
  {
    value: "system" as const,
    label: "System",
    description: "Match your device preference automatically.",
    icon: <FiMonitor />,
  },
  {
    value: "light" as const,
    label: "Light",
    description: "Bright, airy surfaces with soft shadows.",
    icon: <FiSun />,
  },
  {
    value: "dark" as const,
    label: "Dark",
    description: "Low-light palette with higher contrast.",
    icon: <FiMoon />,
  },
];

const notificationSettingsCopy: Record<
  NotificationKey,
  { title: string; description: string; icon: React.ReactNode }
> = {
  email: {
    title: "Email updates",
    description: "Announcements, approvals, and policy revisions.",
    icon: <FiMail />,
  },
  push: {
    title: "Push notifications",
    description: "Instant alerts for approvals and exceptions.",
    icon: <FiBell />,
  },
  reminders: {
    title: "Daily digests",
    description: "Condensed summary of attendance & leave activity.",
    icon: <FiZap />,
  },
};

export default function SettingsPage() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    email: true,
    push: true,
    reminders: false,
  });

  const toggleNotification = (key: NotificationKey) => {
    setNotifications((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const handleResetNotifications = () => {
    setNotifications({
      email: true,
      push: true,
      reminders: false,
    });
  };

  return (
    <div className="space-y-8">
      <div className="glass-panel gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
            Workspace
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Settings
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Personalise your experience and keep control over alerts across the platform.
          </p>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card title="Appearance" className="gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {themeOptions.map((option) => {
              const isSelected = preference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPreference(option.value)}
                  aria-pressed={isSelected}
                  className={[
                    "flex h-full flex-col gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                    isSelected
                      ? "border-indigo-400 bg-indigo-50/70 text-indigo-700 shadow-lg shadow-indigo-100 dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-200 dark:shadow-sky-900/40"
                      : "border-slate-200 bg-white/80 text-slate-600 hover:border-indigo-200 hover:bg-white dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-sky-500/40 dark:hover:bg-slate-900",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3 text-base font-semibold">
                    <span className="text-xl">{option.icon}</span>
                    {option.label}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl border border-dashed border-slate-200/60 bg-white/70 px-4 py-3 text-sm text-slate-500 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-400">
            Active theme: <span className="font-semibold text-slate-700 dark:text-slate-200">{resolvedTheme}</span>{" "}
            {preference === "system" && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800/80 dark:text-slate-300">
                System controlled
              </span>
            )}
          </div>
          <ThemeSwitcher />
        </Card>

        <Card title="Notifications" className="gap-4">
          <div className="flex flex-col gap-3">
            {Object.entries(notificationSettingsCopy).map(([key, { title, description, icon }]) => {
              const typedKey = key as NotificationKey;
              const enabled = notifications[typedKey];
              return (
                <div
                  key={key}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-lg text-indigo-500 dark:text-sky-400">
                      {icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => toggleNotification(typedKey)}
                    className={[
                      "relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-200",
                      enabled
                        ? "bg-primary_dark dark:bg-sky-500"
                        : "bg-slate-300 dark:bg-slate-700",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-all duration-200",
                        enabled ? "translate-x-6" : "translate-x-1",
                      ].join(" ")}
                    />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button theme="secondary" onClick={handleResetNotifications}>
              Restore defaults
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
