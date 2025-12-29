import MessagesClient from "@/app/components/messages/MessagesClient";

export default function HrAdminMessagesPage() {
  return (
    <div className="space-y-8">
      <header className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Messages</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Coordinate decisions, follow up on requests, and keep teams aligned.
        </p>
      </header>

      <MessagesClient />
    </div>
  );
}
