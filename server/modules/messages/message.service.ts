import { TRPCError } from "@trpc/server";
import { Prisma, type UserRole } from "@prisma/client";

import type { TRPCContext } from "@/server/api/trpc";
import type {
  CreateThreadInput,
  DirectoryInput,
  MessageListInput,
  SendMessageInput,
  ThreadMessagesInput,
} from "./message.validation";

const userDirectorySelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  role: true,
  status: true,
  profile: {
    select: {
      preferredName: true,
      firstName: true,
      lastName: true,
      profilePhotoUrl: true,
    },
  },
  employment: {
    select: {
      designation: true,
    },
  },
});

type UserDirectoryRecord = Prisma.UserGetPayload<{ select: typeof userDirectorySelect }>;

const participantSelect = Prisma.validator<Prisma.ThreadParticipantSelect>()({
  id: true,
  userId: true,
  lastReadAt: true,
  user: {
    select: userDirectorySelect,
  },
});

type ParticipantRecord = Prisma.ThreadParticipantGetPayload<{ select: typeof participantSelect }>;

const threadSummaryInclude = Prisma.validator<Prisma.ThreadParticipantInclude>()({
  thread: {
    select: {
      id: true,
      title: true,
      isPrivate: true,
      lastMessageAt: true,
      participants: {
        select: participantSelect,
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: {
            select: userDirectorySelect,
          },
        },
      },
    },
  },
});

const threadDetailSelect = Prisma.validator<Prisma.ThreadSelect>()({
  id: true,
  title: true,
  isPrivate: true,
  lastMessageAt: true,
  createdAt: true,
  participants: {
    select: participantSelect,
  },
  messages: {
    orderBy: { createdAt: "asc" },
    include: {
      sender: {
        select: userDirectorySelect,
      },
    },
  },
});

type ThreadDetailRecord = Prisma.ThreadGetPayload<{ select: typeof threadDetailSelect }>;

const displayName = (user?: UserDirectoryRecord | null) => {
  const preferred = user?.profile?.preferredName?.trim();
  if (preferred) {
    return preferred;
  }
  const parts = [user?.profile?.firstName, user?.profile?.lastName].filter(
    (value): value is string => Boolean(value && value.trim().length > 0),
  );
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return user?.email ?? "Unknown member";
};

const avatarUrl = (user?: UserDirectoryRecord | null) => user?.profile?.profilePhotoUrl ?? null;

const designationOf = (user?: UserDirectoryRecord | null) => user?.employment?.designation ?? null;

const requireSessionUser = (ctx: TRPCContext) => {
  const viewer = ctx.session?.user;
  if (!viewer) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!viewer.organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Join an organization to use chat.",
    });
  }
  return viewer;
};

const ensureThreadMembership = async (
  ctx: TRPCContext,
  threadId: string,
  userId: string,
  organizationId: string,
) => {
  const membership = await ctx.prisma.threadParticipant.findFirst({
    where: { threadId, userId },
    select: {
      id: true,
      threadId: true,
      lastReadAt: true,
      thread: {
        select: {
          id: true,
          organizationId: true,
        },
      },
    },
  });

  if (!membership) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Thread is not available." });
  }

  if (membership.thread.organizationId !== organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Thread is restricted to another organization." });
  }

  return membership;
};

const buildThreadTitle = ({
  title,
  participants,
  viewerId,
}: {
  title?: string | null;
  participants: ParticipantRecord[];
  viewerId: string;
}) => {
  if (title && title.trim().length > 0) {
    return title.trim();
  }

  const counterpartNames = participants
    .filter((participant) => participant.userId !== viewerId)
    .map((participant) => displayName(participant.user));

  if (counterpartNames.length === 0) {
    return "Personal Notes";
  }

  const uniqueNames = Array.from(new Set(counterpartNames));
  return uniqueNames.slice(0, 3).join(", ");
};

const sanitizeMessageBody = (body: string) => body.trim();

export type DirectoryEntry = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  designation: string | null;
  role: UserRole;
};

export type ThreadParticipantView = {
  id: string;
  name: string;
  avatarUrl: string | null;
  designation: string | null;
};

export type ThreadMessageView = {
  id: string;
  threadId: string;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
};

export type ThreadSummaryView = {
  id: string;
  title: string;
  lastMessageAt: string | null;
  lastMessage?: ThreadMessageView;
  unreadCount: number;
  participantCount: number;
  participants: ThreadParticipantView[];
};

export type ThreadDetailView = {
  id: string;
  title: string;
  participants: ThreadParticipantView[];
  messages: ThreadMessageView[];
  viewerId: string;
};

const toParticipantView = (participant: ParticipantRecord): ThreadParticipantView => ({
  id: participant.userId,
  name: displayName(participant.user),
  avatarUrl: avatarUrl(participant.user),
  designation: designationOf(participant.user),
});

const toThreadMessage = (message: {
  id: string;
  threadId: string;
  body: string;
  createdAt: Date;
  senderId: string;
  sender: UserDirectoryRecord;
}): ThreadMessageView => ({
  id: message.id,
  threadId: message.threadId,
  body: message.body,
  createdAt: message.createdAt.toISOString(),
  senderId: message.senderId,
  senderName: displayName(message.sender),
  senderAvatar: avatarUrl(message.sender),
});

const listThreads = async (
  ctx: TRPCContext,
  input?: MessageListInput,
): Promise<{ threads: ThreadSummaryView[] }> => {
  const viewer = requireSessionUser(ctx);

  const memberships = await ctx.prisma.threadParticipant.findMany({
    where: {
      userId: viewer.id,
      thread: {
        organizationId: viewer.organizationId,
      },
    },
    include: threadSummaryInclude,
    orderBy: [
      { thread: { lastMessageAt: "desc" } },
      { thread: { updatedAt: "desc" } },
    ],
  });

  const unreadCounts = await Promise.all(
    memberships.map((membership) =>
      ctx.prisma.chatMessage.count({
        where: {
          threadId: membership.threadId,
          senderId: { not: viewer.id },
          ...(membership.lastReadAt ? { createdAt: { gt: membership.lastReadAt } } : {}),
        },
      }),
    ),
  );

  const summaries: ThreadSummaryView[] = memberships.map((membership, index) => {
    const { thread } = membership;
    const participants = thread.participants.map(toParticipantView);
    const lastMessageRecord = thread.messages.at(0);
    const lastMessage = lastMessageRecord
      ? toThreadMessage({
          id: lastMessageRecord.id,
          threadId: thread.id,
          body: lastMessageRecord.body,
          createdAt: lastMessageRecord.createdAt,
          senderId: lastMessageRecord.senderId,
          sender: lastMessageRecord.sender,
        })
      : undefined;

    return {
      id: thread.id,
      title: buildThreadTitle({
        title: thread.title,
        participants: thread.participants,
        viewerId: viewer.id,
      }),
      lastMessageAt: thread.lastMessageAt ? thread.lastMessageAt.toISOString() : null,
      lastMessage,
      unreadCount: unreadCounts[index] ?? 0,
      participants,
      participantCount: participants.length,
    };
  });

  if (!input?.query) {
    return { threads: summaries };
  }

  const normalizedQuery = input.query.trim().toLowerCase();
  const filtered = summaries.filter((summary) => {
    if (summary.title.toLowerCase().includes(normalizedQuery)) {
      return true;
    }
    return summary.participants.some((p) => p.name.toLowerCase().includes(normalizedQuery));
  });

  return { threads: filtered };
};

const directory = async (
  ctx: TRPCContext,
  input?: DirectoryInput,
): Promise<{ viewerId: string; members: DirectoryEntry[] }> => {
  const viewer = requireSessionUser(ctx);
  const query = input?.query?.trim();

  const members = await ctx.prisma.user.findMany({
    where: {
      organizationId: viewer.organizationId,
      status: { not: "TERMINATED" },
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              {
                profile: {
                  OR: [
                    { firstName: { contains: query, mode: "insensitive" } },
                    { lastName: { contains: query, mode: "insensitive" } },
                    { preferredName: { contains: query, mode: "insensitive" } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    select: userDirectorySelect,
    orderBy: [
      { profile: { firstName: "asc" } },
      { profile: { lastName: "asc" } },
    ],
  });

  return {
    viewerId: viewer.id,
    members: members.map((member) => ({
      id: member.id,
      name: displayName(member),
      designation: designationOf(member),
      email: member.email,
      avatarUrl: avatarUrl(member),
      role: member.role,
    })),
  };
};

const getThreadDetail = async (
  ctx: TRPCContext,
  input: ThreadMessagesInput,
): Promise<ThreadDetailView> => {
  const viewer = requireSessionUser(ctx);
  await ensureThreadMembership(ctx, input.threadId, viewer.id, viewer.organizationId);

  const thread = await ctx.prisma.thread.findFirst({
    where: {
      id: input.threadId,
      organizationId: viewer.organizationId,
    },
    select: threadDetailSelect,
  });

  if (!thread) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Thread could not be found." });
  }

  await ctx.prisma.threadParticipant.updateMany({
    where: { threadId: input.threadId, userId: viewer.id },
    data: { lastReadAt: new Date() },
  });

  const participants = thread.participants.map(toParticipantView);
  const messages = thread.messages.map((message) =>
    toThreadMessage({
      id: message.id,
      threadId: message.threadId,
      body: message.body,
      createdAt: message.createdAt,
      senderId: message.senderId,
      sender: message.sender,
    }),
  );

  return {
    id: thread.id,
    title: buildThreadTitle({
      title: thread.title,
      participants: thread.participants,
      viewerId: viewer.id,
    }),
    participants,
    messages,
    viewerId: viewer.id,
  };
};

const sendMessage = async (
  ctx: TRPCContext,
  input: SendMessageInput,
): Promise<ThreadMessageView> => {
  const viewer = requireSessionUser(ctx);
  const membership = await ensureThreadMembership(
    ctx,
    input.threadId,
    viewer.id,
    viewer.organizationId,
  );

  const sanitized = sanitizeMessageBody(input.body);
  if (!sanitized) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Message cannot be empty." });
  }

  const created = await ctx.prisma.chatMessage.create({
    data: {
      threadId: input.threadId,
      senderId: viewer.id,
      body: sanitized,
    },
    include: {
      sender: {
        select: userDirectorySelect,
      },
    },
  });

  await Promise.all([
    ctx.prisma.thread.update({
      where: { id: input.threadId },
      data: { lastMessageAt: created.createdAt },
    }),
    ctx.prisma.threadParticipant.update({
      where: { id: membership.id },
      data: { lastReadAt: created.createdAt },
    }),
  ]);

  return toThreadMessage({
    id: created.id,
    threadId: input.threadId,
    body: created.body,
    createdAt: created.createdAt,
    senderId: created.senderId,
    sender: created.sender,
  });
};

const createThread = async (
  ctx: TRPCContext,
  input: CreateThreadInput,
): Promise<ThreadDetailView> => {
  const viewer = requireSessionUser(ctx);
  const sanitizedMessage = sanitizeMessageBody(input.message);
  if (!sanitizedMessage) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Message cannot be empty." });
  }

  const uniqueParticipantIds = Array.from(new Set([...input.participantIds, viewer.id]));

  const members = await ctx.prisma.user.findMany({
    where: {
      id: { in: uniqueParticipantIds },
      organizationId: viewer.organizationId,
    },
    select: { id: true },
  });

  if (members.length !== uniqueParticipantIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One or more participants could not be added to this chat.",
    });
  }

  const now = new Date();
  const createdThread = await ctx.prisma.thread.create({
    data: {
      organizationId: viewer.organizationId,
      createdById: viewer.id,
      title: input.title?.trim() || null,
      isPrivate: uniqueParticipantIds.length <= 10,
      lastMessageAt: now,
      participants: {
        create: uniqueParticipantIds.map((participantId) => ({
          userId: participantId,
          lastReadAt: participantId === viewer.id ? now : null,
        })),
      },
      messages: {
        create: {
          senderId: viewer.id,
          body: sanitizedMessage,
          createdAt: now,
        },
      },
    },
    select: { id: true },
  });

  return getThreadDetail(ctx, { threadId: createdThread.id });
};

export const MessageService = {
  listThreads,
  directory,
  getThreadDetail,
  sendMessage,
  createThread,
};

export type MessageListResponse = Awaited<ReturnType<typeof listThreads>>;
export type DirectoryResponse = Awaited<ReturnType<typeof directory>>;
export type ThreadDetailResponse = Awaited<ReturnType<typeof getThreadDetail>>;
export type SendMessageResponse = Awaited<ReturnType<typeof sendMessage>>;
