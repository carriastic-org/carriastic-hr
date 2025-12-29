'use client';

import Link from "next/link";
import { type ReactNode } from "react";

type ButtonTheme =
  | "primary"
  | "secondary"
  | "cancel"
  | "cancel-secondary"
  | "white"
  | "aqua";

type Props = {
  children?: ReactNode;
  className?: string;
  theme?: ButtonTheme;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  isWidthFull?: boolean;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  href?: string;
};

const themeClasses: Record<ButtonTheme, string> = {
  primary:
    "bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-600 hover:via-sky-600 hover:to-cyan-500 focus-visible:outline-indigo-500 dark:from-sky-600 dark:via-sky-500 dark:to-cyan-400 dark:hover:from-sky-700 dark:hover:via-sky-600 dark:hover:to-cyan-500 dark:shadow-sky-900/40",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:outline-slate-500",
  cancel:
    "border border-transparent bg-rose-500 text-white hover:bg-rose-600 focus-visible:outline-rose-500 dark:hover:bg-rose-500",
  "cancel-secondary":
    "border border-rose-200 bg-white text-rose-500 hover:bg-rose-50 focus-visible:outline-rose-400 dark:border-rose-800/70 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20 dark:focus-visible:outline-rose-400",
  white:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-500",
  aqua:
    "border border-transparent bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-600 hover:via-sky-600 hover:to-cyan-500 focus-visible:outline-indigo-500 dark:from-sky-600 dark:via-sky-500 dark:to-cyan-400 dark:hover:from-sky-700 dark:hover:via-sky-600 dark:hover:to-cyan-500 dark:shadow-sky-900/40",
};

function Button({
  children,
  className = "",
  theme = "primary",
  onClick,
  isWidthFull = false,
  type = "button",
  disabled = false,
  href,
}: Props) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 rounded";

  const widthClass = isWidthFull ? "w-full" : "w-fit";
  const themeClass = themeClasses[theme] ?? themeClasses.primary;

  if (href) {
    return (
      <Link
        href={href}
        className={`${widthClass} ${baseClasses} ${themeClass} ${className}`}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${widthClass} ${baseClasses} ${themeClass} ${className}`}
    >
      {children}
    </button>
  );
}

export default Button;
