"use client";

import { useEffect, useMemo, useState } from "react";
import { NotificationAudience, type NotificationStatus } from "@prisma/client";

import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import TextArea from "@/app/components/atoms/inputs/TextArea";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { trpc } from "@/trpc/client";
import type { HrAnnouncementListItem, HrAnnouncementRecipient } from "@/types/hr-announcement";

type AlertState = { type: "success" | "error"; message: string } | null;

const statusBadgeClasses: Partial<Record<NotificationStatus, string>> = {
  SENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  SCHEDULED: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100",
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
};

const sentAtFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatTimestamp = (iso?: string | null) => {
  if (!iso) {
    return "Draft";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Scheduled";
  }
  return sentAtFormatter.format(date);
};

const RecipientChip = ({
  recipient,
  onRemove,
}: {
  recipient: HrAnnouncementRecipient;
  onRemove?: (id: string) => void;
}) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
    {recipient.name}
    {onRemove && (
      <button
        type="button"
        onClick={() => onRemove(recipient.id)}
        className="text-slate-400 transition hover:text-rose-500"
        aria-label={`Remove ${recipient.name}`}
      >
        ×
      </button>
    )}
  </span>
);

const RecipientToggle = ({
  label,
  value,
  active,
  onSelect,
}: {
  label: string;
  value: NotificationAudience;
  active: boolean;
  onSelect: (value: NotificationAudience) => void;
}) => (
  <button
    type="button"
    onClick={() => onSelect(value)}
    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
      active
        ? "bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-500/10 dark:text-indigo-100"
        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
    }`}
  >
    {label}
  </button>
);

const AnnouncementCard = ({ announcement }: { announcement: HrAnnouncementListItem }) => {
  const timestampLabel = announcement.sentAt ? `Sent • ${formatTimestamp(announcement.sentAt)}` : "Draft";
  const statusClass = statusBadgeClasses[announcement.status] ?? "bg-slate-100 text-slate-600";
  const recipientsToShow = announcement.recipients.slice(0, 4);
  const remaining = announcement.recipients.length - recipientsToShow.length;

  return (
    <article className="space-y-4 rounded-[28px] border border-white/60 bg-white/90 p-6 shadow-lg shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-950/30">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
            {announcement.audienceLabel}
          </p>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{announcement.title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">{announcement.bodyPreview}</p>
        </div>
        <div className="flex items-center gap-3 self-stretch text-sm text-slate-500 dark:text-slate-400">
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800">
            {timestampLabel}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${statusClass}`}>
            {announcement.status}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
        <span>From {announcement.senderName ?? "HR"}</span>
        <span>Audience</span>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span>{announcement.isOrganizationWide ? "Entire organization" : "Selected teammates"}</span>
      </div>
      {!announcement.isOrganizationWide && announcement.recipients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recipientsToShow.map((recipient) => (
            <RecipientChip key={recipient.id} recipient={recipient} />
          ))}
          {remaining > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              +{remaining} more
            </span>
          )}
        </div>
      )}
    </article>
  );
};

function HrAdminAnnouncementsPage() {
  const utils = trpc.useUtils();
  const overviewQuery = trpc.hrAnnouncements.overview.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const sendMutation = trpc.hrAnnouncements.send.useMutation({
    onSuccess: async () => {
      setForm({ title: "", body: "" });
      setRecipientMode(NotificationAudience.ORGANIZATION);
      setSelectedRecipients([]);
      setRecipientSearch("");
      setAlert({ type: "success", message: "Announcement shared with the selected audience." });
      await utils.hrAnnouncements.overview.invalidate();
    },
    onError: (error) => setAlert({ type: "error", message: error.message }),
  });

  const [form, setForm] = useState({ title: "", body: "" });
  const [recipientMode, setRecipientMode] = useState<NotificationAudience>(NotificationAudience.ORGANIZATION);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [alert, setAlert] = useState<AlertState>(null);

  const recipients = useMemo(
    () => overviewQuery.data?.recipients ?? [],
    [overviewQuery.data?.recipients],
  );
  const announcements = useMemo(
    () => overviewQuery.data?.announcements ?? [],
    [overviewQuery.data?.announcements],
  );

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), 5000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  const recipientMap = useMemo(() => {
    const map = new Map<string, HrAnnouncementRecipient>();
    recipients.forEach((recipient) => {
      map.set(recipient.id, recipient);
    });
    return map;
  }, [recipients]);

  const selectedRecipientEntries = useMemo(
    () =>
      selectedRecipients
        .map((id) => recipientMap.get(id))
        .filter((value): value is HrAnnouncementRecipient => Boolean(value)),
    [recipientMap, selectedRecipients],
  );

  const filteredRecipients = useMemo(() => {
    const query = recipientSearch.trim().toLowerCase();
    if (!query) {
      return recipients;
    }
    return recipients.filter(
      (recipient) =>
        recipient.name.toLowerCase().includes(query) || recipient.email.toLowerCase().includes(query),
    );
  }, [recipientSearch, recipients]);

  const toggleRecipient = (id: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMutation.mutate({
      title: form.title,
      body: form.body,
      audience: recipientMode,
      recipientIds:
        recipientMode === NotificationAudience.INDIVIDUAL ? selectedRecipients : undefined,
    });
  };

  const isIndividualMode = recipientMode === NotificationAudience.INDIVIDUAL;
  const isSubmitDisabled =
    sendMutation.isPending ||
    !form.title.trim() ||
    !form.body.trim() ||
    (isIndividualMode && selectedRecipients.length === 0);

  return (
    <div className="space-y-8">
      <header className="rounded-[32px] border border-white/60 bg-white/90 p-8 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 dark:bg-white/5 dark:text-slate-300">
          Broadcast
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">Announcements</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Share priorities, wins, and policy updates with the whole organization or a handful of teammates.
        </p>
      </header>

      {alert && (
        <div
          className={`rounded-3xl border px-4 py-3 text-sm font-semibold ${
            alert.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
          }`}
        >
          {alert.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-5 rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-lg shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              Compose
            </p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Send announcement</h2>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <TextInput
              label="Announcement topic"
              placeholder="e.g. Q2 priorities"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              isRequired
              disabled={sendMutation.isPending}
            />
            <TextArea
              label="Details"
              placeholder="Give teammates the context they need..."
              height="160px"
              value={form.body}
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
              isRequired
              disabled={sendMutation.isPending}
            />
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recipients</p>
              <div className="flex flex-wrap gap-3">
                <RecipientToggle
                  label="To organization"
                  value={NotificationAudience.ORGANIZATION}
                  active={!isIndividualMode}
                  onSelect={setRecipientMode}
                />
                <RecipientToggle
                  label="Specific employees"
                  value={NotificationAudience.INDIVIDUAL}
                  active={isIndividualMode}
                  onSelect={setRecipientMode}
                />
              </div>
              {!isIndividualMode ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Every active teammate in your organization will receive this in their notifications.
                </p>
              ) : (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={(event) => setRecipientSearch(event.target.value)}
                    placeholder="Search by name or email"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    disabled={sendMutation.isPending || overviewQuery.isLoading}
                  />
                  {selectedRecipientEntries.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedRecipientEntries.map((recipient) => (
                        <RecipientChip
                          key={recipient.id}
                          recipient={recipient}
                          onRemove={(id) => toggleRecipient(id)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-white/90 p-2 dark:border-slate-800 dark:bg-slate-950/40">
                    {overviewQuery.isLoading ? (
                      <div className="flex items-center justify-center py-6 text-sm text-slate-500 dark:text-slate-400">
                        Loading teammates...
                      </div>
                    ) : filteredRecipients.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        No teammates match that search.
                      </p>
                    ) : (
                      filteredRecipients.map((recipient) => (
                        <label
                          key={recipient.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRecipients.includes(recipient.id)}
                            onChange={() => toggleRecipient(recipient.id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            disabled={sendMutation.isPending}
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold">{recipient.name}</span>
                            <span className="text-xs text-slate-500">{recipient.email}</span>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Only active teammates appear here. Remove someone by unchecking their name.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitDisabled}>
                {sendMutation.isPending ? "Sending..." : "Send announcement"}
              </Button>
            </div>
          </form>
        </section>

        <section className="space-y-4 rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-lg shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                History
              </p>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Recent announcements</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Last {announcements.length} broadcasts.
              </p>
            </div>
            <Button
              theme="secondary"
              onClick={() => overviewQuery.refetch()}
              disabled={overviewQuery.isFetching}
              className="px-4 py-2 text-xs"
            >
              {overviewQuery.isFetching ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
          {overviewQuery.isLoading ? (
            <div className="flex min-h-[200px] items-center justify-center text-slate-500 dark:text-slate-400">
              <LoadingSpinner label="Loading announcements" helper="Fetching your most recent broadcasts." />
            </div>
          ) : overviewQuery.isError ? (
            <div className="space-y-3 rounded-3xl border border-rose-200 bg-rose-50/80 p-6 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              <p>We couldn&apos;t load recent announcements.</p>
              <Button
                theme="cancel-secondary"
                onClick={() => overviewQuery.refetch()}
                disabled={overviewQuery.isFetching}
              >
                Try again
              </Button>
            </div>
          ) : announcements.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white/80 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
              <p className="text-base font-semibold">No announcements yet</p>
              <p className="text-sm">Your next broadcast will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default HrAdminAnnouncementsPage;
