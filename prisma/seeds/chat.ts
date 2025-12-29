import type { PrismaClient } from "@prisma/client";

import { NDI_ORG_ID } from "./data";

type ThreadSeed = {
  id: string;
  title: string;
  organizationId: string;
  createdById: string;
  isPrivate?: boolean;
  participantIds: string[];
  messages: Array<{
    id: string;
    senderId: string;
    body: string;
    createdAt: Date;
  }>;
};

const threadSeeds: ThreadSeed[] = [
  {
    id: "thread-people-ops",
    title: "People Ops Squad",
    organizationId: NDI_ORG_ID,
    createdById: "hr-yeasir",
    isPrivate: false,
    participantIds: [
      "hr-yeasir",
      "hr-arpon",
      "org-admin-tabuchi",
      "org-owner-kohei",
      "super-admin-ndi",
    ],
    messages: [
      {
        id: "chat-msg-ops-1",
        senderId: "hr-yeasir",
        body: "Reminder that calibration packets are due Thursday. Status check?",
        createdAt: new Date("2024-05-02T09:14:00.000Z"),
      },
      {
        id: "chat-msg-ops-2",
        senderId: "org-admin-tabuchi",
        body: "Eng and Design are done. Marketing has two reviews left. I will follow up.",
        createdAt: new Date("2024-05-02T09:16:00.000Z"),
      },
      {
        id: "chat-msg-ops-3",
        senderId: "hr-arpon",
        body: "I can draft nudges for the managers who are pending.",
        createdAt: new Date("2024-05-02T09:17:00.000Z"),
      },
    ],
  },
  {
    id: "thread-frontend-sync",
    title: "Frontend Weekly",
    organizationId: NDI_ORG_ID,
    createdById: "frontend-lead-hazrat",
    participantIds: [
      "frontend-lead-hazrat",
      "emp-mueem",
      "emp-rafidul",
      "org-admin-tabuchi",
      "eng-head-sakib",
    ],
    messages: [
      {
        id: "chat-msg-fe-1",
        senderId: "frontend-lead-hazrat",
        body: "Please review the new design tokens branch before merging.",
        createdAt: new Date("2024-05-03T04:05:00.000Z"),
      },
      {
        id: "chat-msg-fe-2",
        senderId: "emp-mueem",
        body: "Noted. I will add comments after QA stand-up.",
        createdAt: new Date("2024-05-03T04:07:00.000Z"),
      },
      {
        id: "chat-msg-fe-3",
        senderId: "emp-rafidul",
        body: "Lint rules need updating too. Will push a PR shortly.",
        createdAt: new Date("2024-05-03T04:08:00.000Z"),
      },
    ],
  },
];

export const seedChat = async (prisma: PrismaClient) => {
  for (const thread of threadSeeds) {
    const exists = await prisma.thread.findUnique({
      where: { id: thread.id },
      select: { id: true },
    });

    if (exists) continue;

    const createdThread = await prisma.thread.create({
      data: {
        id: thread.id,
        title: thread.title,
        organizationId: thread.organizationId,
        createdById: thread.createdById,
        isPrivate: thread.isPrivate ?? true,
        lastMessageAt:
          thread.messages.length > 0
            ? thread.messages[thread.messages.length - 1]?.createdAt
            : undefined,
      },
    });

    for (const participantId of thread.participantIds) {
      await prisma.threadParticipant.create({
        data: {
          threadId: createdThread.id,
          userId: participantId,
          joinedAt: new Date("2024-05-01T00:00:00.000Z"),
          lastReadAt: thread.messages.length
            ? thread.messages[thread.messages.length - 1]?.createdAt
            : null,
        },
      });
    }

    for (const message of thread.messages) {
      await prisma.chatMessage.create({
        data: {
          id: message.id,
          threadId: createdThread.id,
          senderId: message.senderId,
          body: message.body,
          createdAt: message.createdAt,
        },
      });
    }
  }
};
