"use client";

import { useSession } from "next-auth/react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";

const RealtimeContext = createContext<Socket | null>(null);

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      return;
    }

    let isMounted = true;
    let socketInstance: Socket | null = null;

    const initialize = async () => {
      try {
        await fetch("/api/socket");
      } catch (error) {
        console.error("Socket init failed", error);
        return;
      }
      if (!isMounted) {
        return;
      }
      socketInstance = io({
        path: "/api/socket_io",
        withCredentials: true,
      });
      setSocket(socketInstance);
      socketInstance.on("connect_error", (err) => {
        console.error("Socket connection error", err.message);
      });
    };

    void initialize();

    return () => {
      isMounted = false;
      socketInstance?.disconnect();
      socketInstance = null;
      setSocket(null);
    };
  }, [status]);

  return <RealtimeContext.Provider value={socket}>{children}</RealtimeContext.Provider>;
};

export const useRealtimeSocket = () => useContext(RealtimeContext);
