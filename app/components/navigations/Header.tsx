'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const navLinks = [
  { href: '/support', label: 'Support' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/auth/login';

  const isActive = (href: string) => pathname?.startsWith(href);

  return (
    <header className="mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-3xl border border-white/70 bg-white/90 px-4 py-4 text-slate-900 shadow-xl shadow-slate-200/70 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100 dark:shadow-slate-950/40 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3">
      <button
        type="button"
        onClick={() => router.push('/')}
        className="flex w-full items-center gap-3 text-left sm:w-auto"
        aria-label="Go to dashboard"
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg shadow-indigo-500/30">
          <Image
            src="/logo/demo.logo.png"
            alt="HR Management"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
            priority
          />
        </span>
        <div className="hidden flex-col sm:flex">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Demo
          </span>
          <span className="text-base font-semibold leading-tight">
            Demo Organization
          </span>
        </div>
      </button>

      <nav className="flex w-full flex-wrap items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-300 sm:w-auto sm:justify-end">
        {navLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative rounded-full px-3 py-1 transition-colors duration-200 ${
                active
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {link.label}
              {active ? (
                <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400" />
              ) : null}
            </Link>
          );
        })}
        {!isLoginPage ? (
          <Link
            href="/auth/login"
            className="inline-flex w-full items-center justify-center rounded border border-transparent bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 px-5 py-2 text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-600 hover:via-sky-600 hover:to-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:from-sky-600 dark:via-sky-500 dark:to-cyan-400 sm:w-auto"
          >
            Login
          </Link>
        ) : null}
      </nav>
    </header>
  );
}

export default Header;
