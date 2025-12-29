"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { RiUserAddLine } from "react-icons/ri";

import Button from "@/app/components/atoms/buttons/Button";
import { Modal } from "@/app/components/atoms/frame/Modal";
import { useRealtimeSocket } from "@/app/components/realtime/RealtimeProvider";
import { trpc } from "@/trpc/client";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
const weekdayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});
const dateOnlyFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatRelativeTime = (iso?: string | null) => {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const diffMs = target.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, "minute");
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return relativeTimeFormatter.format(diffHours, "hour");
  }
  const diffDays = Math.round(diffHours / 24);
  return relativeTimeFormatter.format(diffDays, "day");
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfWeek = (date: Date) => {
  const clone = new Date(date);
  const day = clone.getDay();
  clone.setHours(0, 0, 0, 0);
  clone.setDate(clone.getDate() - day);
  return clone;
};

const formatMessageTimestamp = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (isSameDay(date, now)) {
    return timeFormatter.format(date);
  }
  const currentWeekStart = startOfWeek(now);
  if (date >= currentWeekStart) {
    return `${weekdayTimeFormatter.format(date)} ${timeFormatter.format(date)}`;
  }
  return dateOnlyFormatter.format(date);
};

const emptyState = (
  <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
    <HiOutlineChatBubbleLeftRight className="mx-auto mb-4 text-4xl text-slate-400 dark:text-slate-500" />
    <p className="text-lg font-semibold text-slate-700 dark:text-slate-100">No messages yet</p>
    <p className="text-sm">
      Start a conversation to collaborate with teammates and keep decisions transparent.
    </p>
  </div>
);

const initialsFromName = (name?: string | null) => {
  if (!name) return "??";
  const normalized = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (normalized.length === 0) {
    return "??";
  }
  const [first, second] = normalized;
  return `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase().slice(0, 2) || "??";
};

const MessagesClient = () => {
  const utils = trpc.useUtils();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const socket = useRealtimeSocket();

  const listQuery = trpc.message.list.useQuery(
    searchTerm.trim() ? { query: searchTerm.trim() } : undefined,
    {
      refetchOnWindowFocus: true,
    },
  );

  const threads = useMemo(
    () => listQuery.data?.threads ?? [],
    [listQuery.data?.threads],
  );
  const defaultThreadId = threads[0]?.id ?? null;
  const resolvedThreadId = selectedThreadId ?? defaultThreadId;

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === resolvedThreadId) ?? null,
    [resolvedThreadId, threads],
  );

  const threadMessagesQuery = trpc.message.threadMessages.useQuery(
    { threadId: resolvedThreadId ?? "" },
    {
      enabled: Boolean(resolvedThreadId),
      refetchOnWindowFocus: true,
    },
  );

  const sendMessage = trpc.message.sendMessage.useMutation({
    onSuccess: async (_, variables) => {
      setComposerValue("");
      await Promise.all([
        utils.message.threadMessages.invalidate({ threadId: variables.threadId }),
        utils.message.list.invalidate(),
      ]);
    },
  });

  const directoryQuery = trpc.message.directory.useQuery(undefined, {
    enabled: isNewChatOpen,
    staleTime: 1000 * 60 * 5,
  });
  const [newChatTitle, setNewChatTitle] = useState("");
  const [newChatMessage, setNewChatMessage] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const resetNewChatForm = useCallback(() => {
    setParticipantIds([]);
    setParticipantSearch("");
    setNewChatTitle("");
    setNewChatMessage("");
  }, []);

  const handleModalToggle: Dispatch<SetStateAction<boolean>> = useCallback(
    (value) => {
      setIsNewChatOpen((previous) => {
        const nextValue = typeof value === "function" ? value(previous) : value;
        if (!nextValue) {
          resetNewChatForm();
        }
        return nextValue;
      });
    },
    [resetNewChatForm],
  );

  const selectedThread = threadMessagesQuery.data;
  const availableMembers = useMemo(
    () => directoryQuery.data?.members ?? [],
    [directoryQuery.data?.members],
  );
  const viewerId = selectedThread?.viewerId ?? directoryQuery.data?.viewerId ?? null;
  const shareableParticipantIds = useMemo(
    () => (viewerId ? participantIds.filter((id) => id !== viewerId) : participantIds),
    [participantIds, viewerId],
  );

  const createThread = trpc.message.createThread.useMutation({
    onSuccess: async (thread) => {
      handleModalToggle(false);
      setSelectedThreadId(thread.id);
      await utils.message.list.invalidate();
      await utils.message.threadMessages.invalidate({ threadId: thread.id });
    },
  });

  const filteredMembers = useMemo(() => {
    if (!participantSearch.trim()) {
      return availableMembers;
    }
    const query = participantSearch.trim().toLowerCase();
    return availableMembers.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        (member.designation?.toLowerCase().includes(query) ?? false),
    );
  }, [availableMembers, participantSearch]);

  const toggleParticipant = useCallback((memberId: string) => {
    setParticipantIds((previous) =>
      previous.includes(memberId)
        ? previous.filter((id) => id !== memberId)
        : [...previous, memberId],
    );
  }, []);

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedThreadId || !composerValue.trim()) return;
    sendMessage.mutate({ threadId: resolvedThreadId, body: composerValue });
  };

  const handleCreateThread = () => {
    if (!newChatMessage.trim() || shareableParticipantIds.length === 0) {
      return;
    }
    createThread.mutate({
      title: newChatTitle.trim() ? newChatTitle.trim() : undefined,
      participantIds: shareableParticipantIds,
      message: newChatMessage,
    });
  };

  const messages = selectedThread?.messages ?? [];

  const showComposer = Boolean(resolvedThreadId);
  const isComposerDisabled =
    sendMessage.isPending || !composerValue.trim() || !resolvedThreadId;

  const invalidateThreadList = useCallback(() => {
    void utils.message.list.invalidate();
  }, [utils]);

  const refreshThreadMessages = useCallback(
    (threadId: string) => {
      void utils.message.threadMessages.invalidate({ threadId });
    },
    [utils],
  );

  const handleIncomingRealtimeMessage = useCallback(
    (payload: { threadId: string }) => {
      if (payload?.threadId) {
        refreshThreadMessages(payload.threadId);
      }
      invalidateThreadList();
    },
    [invalidateThreadList, refreshThreadMessages],
  );

  useEffect(() => {
    if (!socket) {
      return;
    }
    socket.on("thread:created", invalidateThreadList);
    socket.on("thread:updated", invalidateThreadList);
    socket.on("message:new", handleIncomingRealtimeMessage);

    return () => {
      socket.off("thread:created", invalidateThreadList);
      socket.off("thread:updated", invalidateThreadList);
      socket.off("message:new", handleIncomingRealtimeMessage);
    };
  }, [handleIncomingRealtimeMessage, invalidateThreadList, socket]);

  useEffect(() => {
    if (!socket || !resolvedThreadId) {
      return;
    }
    socket.emit("thread:subscribe", { threadId: resolvedThreadId });
  }, [resolvedThreadId, socket]);

  return (
    <>
      <section className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="rounded-[32px] border border-white/60 bg-white/90 p-4 shadow-lg dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase text-slate-400">Conversations</p>
            <Button
              theme="secondary"
              className="px-3 py-1 text-xs font-semibold"
              onClick={() => handleModalToggle(true)}
            >
              <RiUserAddLine className="mr-1" />
              Start chat
            </Button>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search teammates or threads..."
            className="mt-4 w-full rounded border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <div className="mt-4 space-y-3">
            {listQuery.isLoading ? (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading threads...
              </div>
            ) : listQuery.error ? (
              <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                <p>Unable to load conversations.</p>
                <Button
                  theme="secondary"
                  className="text-xs"
                  onClick={() => listQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : threads.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                No conversations yet.
              </div>
            ) : (
              threads.map((thread) => {
                const isActive = thread.id === resolvedThreadId;
                const lastMessageTime = formatRelativeTime(thread.lastMessageAt);
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-transparent bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 text-white shadow-lg shadow-indigo-500/30"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{thread.title}</p>
                      <span
                        className={`text-[11px] uppercase tracking-wide ${
                          isActive ? "text-white/80" : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {lastMessageTime ?? "No activity"}
                      </span>
                    </div>
                    <p
                      className={`text-xs ${isActive ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}
                    >
                      {thread.participantCount} member{thread.participantCount === 1 ? "" : "s"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="flex max-h-[80vh] flex-col rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-lg dark:border-slate-700/70 dark:bg-slate-900/80">
          {resolvedThreadId ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-700/70">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">
                    {activeThread?.participantCount ?? threadMessagesQuery.data?.participants.length ?? 0}{" "}
                    members
                  </p>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {activeThread?.title ?? selectedThread?.title ?? "Thread"}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {threadMessagesQuery.data?.participants.slice(0, 4).map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-2 rounded-2xl border border-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300"
                    >
                      <div className="relative h-7 w-7 overflow-hidden rounded-full border border-white/60 bg-slate-200 text-[10px] font-semibold uppercase text-slate-600 shadow-inner dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {participant.avatarUrl ? (
                          <Image
                            src={participant.avatarUrl}
                            alt={participant.name}
                            fill
                            className="object-cover"
                            sizes="28px"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">
                            {initialsFromName(participant.name)}
                          </span>
                        )}
                      </div>
                      <span>{participant.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-2">
                {threadMessagesQuery.isLoading ? (
                  <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                    Loading messages...
                  </div>
                ) : threadMessagesQuery.error ? (
                  <div className="space-y-3 rounded-3xl border border-rose-200 bg-rose-50/70 p-6 text-center text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    <p>We couldn&rsquo;t load this conversation.</p>
                    <Button theme="secondary" onClick={() => threadMessagesQuery.refetch()}>
                      Try again
                    </Button>
                  </div>
                ) : messages.length === 0 ? (
                  emptyState
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        viewerId && message.senderId === viewerId ? "justify-end" : ""
                      }`}
                    >
                      <div
                        className={`max-w-3xl rounded px-5 py-2 text-sm leading-relaxed min-w-[200px]`}
                      >
                        <div className={`flex items-center ${viewerId && message.senderId === viewerId ? "justify-end" : "justify-start"} gap-3 text-xs font-semibold uppercase tracking-wide`}>
                          <span>{message.senderName}</span>
                        </div>
                        <p className={`mt-2 px-2 py-1 rounded whitespace-pre-line shadow-lg shadow-indigo-500/30 ${
                          viewerId && message.senderId === viewerId
                            ? "bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 text-white"
                            : "border border-slate-100 bg-white text-slate-700 shadow dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                        }`}>{message.body}</p>
                        <span
                            className={
                              viewerId && message.senderId === viewerId
                                ? "text-white/80"
                                : "text-slate-400 dark:text-slate-500"
                            }
                          >
                            {formatMessageTimestamp(message.createdAt)}
                          </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {showComposer && (
                <form
                  onSubmit={handleSend}
                  className="mt-6 rounded-3xl border border-slate-100 bg-white/90 p-4 shadow-inner dark:border-slate-700/70 dark:bg-slate-900/60"
                >
                  <textarea
                    value={composerValue}
                    onChange={(event) => setComposerValue(event.target.value)}
                    placeholder="Write a message..."
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  {sendMessage.error && (
                    <p className="mt-2 text-sm text-rose-500">{sendMessage.error.message}</p>
                  )}
                  <div className="mt-4 flex justify-end">
                    <Button type="submit" disabled={isComposerDisabled}>
                      {sendMessage.isPending ? "Sending..." : "Send message"}
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : (
            emptyState
          )}
        </div>
      </section>

      <Modal
        open={isNewChatOpen}
        setOpen={handleModalToggle}
        title="Start a chat"
        doneButtonText={createThread.isPending ? "Creating..." : "Start conversation"}
        onDoneClick={handleCreateThread}
        isCancelButton
        cancelButtonText="Cancel"
        buttonWidth="180px"
        buttonHeight="44px"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Conversation title
            </label>
            <input
              type="text"
              value={newChatTitle}
              onChange={(event) => setNewChatTitle(event.target.value)}
              placeholder="Optional. Something memorable for the team."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Message
            </label>
            <textarea
              value={newChatMessage}
              onChange={(event) => setNewChatMessage(event.target.value)}
              rows={3}
              placeholder="Kick off the conversation..."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Invite teammates ({shareableParticipantIds.length} selected)
            </label>
            <input
              type="text"
              value={participantSearch}
              onChange={(event) => setParticipantSearch(event.target.value)}
              placeholder="Search by name or email"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-slate-100 bg-white/70 dark:border-slate-700 dark:bg-slate-900/70">
              {directoryQuery.isLoading ? (
                <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                  Loading directory...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                  No teammates match that search.
                </div>
              ) : (
                filteredMembers
                  .filter((member) => member.id !== viewerId)
                  .map((member) => {
                    const isSelected = participantIds.includes(member.id);
                    return (
                      <label
                        key={member.id}
                        className="flex cursor-pointer items-center justify-between border-b border-slate-100 px-4 py-3 last:border-none dark:border-slate-800"
                      >
                        <div>
                          <p className="text-sm font-semibold">{member.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {member.designation ?? "Contributor"} · {member.email}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleParticipant(member.id)}
                          className="h-5 w-5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </label>
                    );
                  })
              )}
            </div>
            {shareableParticipantIds.length === 0 && (
              <p className="mt-2 text-xs text-rose-500">Select at least one teammate.</p>
            )}
          </div>
          {createThread.error && (
            <p className="text-sm text-rose-500">{createThread.error.message}</p>
          )}
        </div>
      </Modal>
    </>
  );
};

export default MessagesClient;
