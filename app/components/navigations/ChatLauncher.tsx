'use client';

import { FaRocketchat } from "react-icons/fa";

export function ChatLauncher() {
  return (
    <div className="pointer-events-none fixed bottom-8 right-8 z-50">
      <button
        type="button"
        aria-label="Open chat"
        className="pointer-events-auto group flex items-center gap-3 rounded-full border border-white/50 bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 px-5 py-3 text-white shadow-2xl shadow-indigo-500/30 transition-all hover:scale-[1.02] dark:border-slate-700/70 dark:shadow-slate-900/60"
        onClick={() => alert("Chat clicked!")}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-2xl dark:bg-slate-900/60">
          <FaRocketchat />
        </span>
        <span className="hidden pr-2 text-sm font-semibold sm:block">
          Need help?
        </span>
      </button>
    </div>
  );
}
