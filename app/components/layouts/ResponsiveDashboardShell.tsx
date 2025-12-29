'use client';

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";

import { DEFAULT_ORGANIZATION_LOGO } from "@/lib/organization-branding";

type ResponsiveDashboardShellProps = {
  children: ReactNode;
  menu: ReactNode;
  menuLabel?: string;
  faviconUrl?: string | null;
};

const ResponsiveDashboardShell = ({
  children,
  menu,
  menuLabel = "Menu",
  faviconUrl,
}: ResponsiveDashboardShellProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isDrawerOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const resolvedIcon =
      faviconUrl && faviconUrl.trim().length ? faviconUrl : DEFAULT_ORGANIZATION_LOGO;
    const rels = ["icon", "shortcut icon", "apple-touch-icon"];
    rels.forEach((rel) => {
      let link = document.querySelector<HTMLLinkElement>(`head link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = resolvedIcon;
    });
  }, [faviconUrl]);

  const overlayClasses = [
    "fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 md:hidden",
    isDrawerOpen
      ? "pointer-events-auto opacity-100"
      : "pointer-events-none opacity-0",
  ].join(" ");

  const drawerClasses = [
    "fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-sm -translate-x-full transform px-4 py-6 transition-transform duration-300 md:hidden",
    isDrawerOpen ? "translate-x-0" : "",
  ].join(" ");

  const handleDrawerMenuClick = (
    event: MouseEvent<HTMLDivElement>
  ): void => {
    if (!isDrawerOpen) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest("a[href]")) {
      setIsDrawerOpen(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full">
      <div className="absolute inset-x-0 top-0 h-40 w-full bg-gradient-to-b from-white/70 to-transparent blur-2xl dark:from-slate-900/60" />
      <div className="relative z-10 flex w-full flex-col gap-4 px-4 py-4 transition-colors duration-200 sm:px-6 md:flex-row md:gap-6 md:px-10 xl:px-14">
        <div className="flex items-center justify-between md:hidden">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white/80 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          >
            <FiMenu className="text-lg" />
            <span>{menuLabel}</span>
          </button>
        </div>
        <aside className="hidden w-full flex-shrink-0 md:block md:w-72 xl:w-80">
          <div className="sticky top-6">
            {menu}
          </div>
        </aside>
        <main className="flex-1 pb-16 text-slate-800 transition-colors duration-200 dark:text-slate-100">
          {children}
        </main>
      </div>

      <div
        role="presentation"
        aria-hidden={!isDrawerOpen}
        onClick={() => setIsDrawerOpen(false)}
        className={overlayClasses}
      />

      <div className={drawerClasses}>
        <div className="flex h-full w-full flex-col rounded-[32px] bg-transparent">
          <div className="mb-4 flex items-center justify-between rounded-3xl border border-white/50 bg-white/70 px-4 py-2 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-200">
              {menuLabel}
            </span>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="inline-flex items-center gap-2 rounded-2xl border border-transparent px-3 py-1 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-200"
            >
              <FiX className="text-lg" />
              Close
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto pr-1"
            onClickCapture={handleDrawerMenuClick}
          >
            {menu}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponsiveDashboardShell;
