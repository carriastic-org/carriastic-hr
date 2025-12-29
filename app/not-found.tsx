import Link from "next/link";

import Button from "./components/atoms/buttons/Button";

const helpfulLinks = [
  { label: "Employee dashboard", href: "/" },
  { label: "My attendance", href: "/attendance" },
  { label: "Profile settings", href: "/profile" },
  { label: "HR admin", href: "/hr-admin" },
];

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center px-6 py-12 text-slate-800 dark:text-slate-100">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white via-indigo-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
      <div className="absolute inset-x-0 top-12 -z-10 h-72 bg-gradient-to-r from-indigo-200/40 via-sky-200/40 to-emerald-200/40 blur-3xl dark:from-slate-800/60 dark:via-sky-900/40 dark:to-slate-900/40" />
      <div className="relative flex w-full max-w-5xl flex-col gap-8 rounded-[40px] border border-white/60 bg-white/90 p-8 shadow-2xl shadow-indigo-100 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70 dark:shadow-slate-950/60 sm:p-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-indigo-500 dark:text-sky-400">
              Error 404
            </p>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white sm:text-5xl">
              The page you&apos;re looking for drifted away
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300">
              We couldn&apos;t find this route in your workspace. It may have been moved,
              deleted, or you may have followed an outdated link. Let&apos;s get you back
              to somewhere helpful.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/">
                <Button theme="primary" className="px-6 py-3 text-sm font-semibold">
                  Back to dashboard
                </Button>
              </Link>
              <Link href="/support">
                <Button theme="secondary" className="px-6 py-3 text-sm font-semibold">
                  Contact support
                </Button>
              </Link>
            </div>
            <div className="rounded-3xl border border-dashed border-slate-200/80 bg-white/70 p-6 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                Tips
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
                <li>Double-check the URL for typos or trailing spaces.</li>
                <li>Use the navigation to jump back into your workflows.</li>
                <li>Reach out to support if you think something went missing.</li>
              </ul>
            </div>
          </div>
          <div className="rounded-[32px] border border-slate-100 bg-slate-50/70 p-6 shadow-inner dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
              Quick links
            </p>
            <div className="mt-6 space-y-3">
              {helpfulLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-2xl border border-transparent bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-slate-900 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-sky-500/40 dark:hover:text-slate-50"
                >
                  {link.label}
                  <span aria-hidden className="text-xs text-slate-400">
                    →
                  </span>
                </Link>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              Need urgent help? Email{" "}
              <a
                className="font-semibold text-indigo-600 hover:underline dark:text-sky-400"
                href="mailto:hr@ndi.hr"
              >
                hr@ndi.hr
              </a>{" "}
              and we&apos;ll jump in.
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/60 bg-gradient-to-r from-indigo-500/90 via-sky-500/90 to-blue-500/90 px-6 py-5 text-center text-white shadow-lg shadow-indigo-400/40 dark:border-slate-800">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] opacity-80">
            Still lost?
          </p>
          <p className="mt-2 text-lg">
            Our team is here for you 24/7. Reach out and we&apos;ll get you back on track.
          </p>
        </div>
      </div>
    </div>
  );
}
