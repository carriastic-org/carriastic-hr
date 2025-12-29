import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { Server as SocketIOServer } from "socket.io";
import { parse } from "cookie";
import type { Server as HTTPServer } from "http";
import type { Socket } from "net";

import { prisma } from "@/server/db";
import { registerSocketServer } from "@/server/socket";
import { threadRoom, userRoom } from "@/server/modules/messages/socket-rooms";

type NextApiResponseServerIO = NextApiResponse & {
  socket: Socket & {
    server: HTTPServer & {
      io?: SocketIOServer;
    };
  };
};

const attachCookies = (req: NextApiRequest) => {
  if (!req.cookies) {
    const cookieHeader = req.headers.cookie;
    req.cookies = cookieHeader ? parse(cookieHeader) : {};
  }
};

const handler = async (req: NextApiRequest, res: NextApiResponseServerIO) => {
  if (!res.socket.server.io) {
    const io = new SocketIOServer(res.socket.server, {
      path: "/api/socket_io",
    });

    io.use(async (socket, next) => {
      try {
        const req = socket.request as NextApiRequest;
        attachCookies(req);
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        if (!token?.sub) {
          return next(new Error("Unauthorized"));
        }
        (socket.data as { userId?: string }).userId = token.sub;
        return next();
      } catch (error) {
        return next(error as Error);
      }
    });

    io.on("connection", async (socket) => {
      const { userId } = socket.data as { userId?: string };
      if (!userId) {
        socket.disconnect();
        return;
      }

      socket.join(userRoom(userId));

      const memberships = await prisma.threadParticipant.findMany({
        where: { userId },
        select: { threadId: true },
      });

      memberships.forEach(({ threadId }) => {
        socket.join(threadRoom(threadId));
      });

      socket.on("thread:subscribe", async ({ threadId }: { threadId?: string }) => {
        if (!threadId) return;
        const membership = await prisma.threadParticipant.findFirst({
          where: { threadId, userId },
          select: { id: true },
        });
        if (membership) {
          socket.join(threadRoom(threadId));
        }
      });
    });

    registerSocketServer(io);
    console.log("Socket.IO server running");
  }
  res.end();
};

export default handler;
