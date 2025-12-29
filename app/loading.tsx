import LoadingSpinner from "./components/LoadingSpinner";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white via-white/80 to-indigo-50 px-4 text-center dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <LoadingSpinner label="Syncing your workspace" helper="Pulling latest data"/>
    </div>
  );
}
