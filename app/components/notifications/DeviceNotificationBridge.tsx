"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useRealtimeSocket } from "@/app/components/realtime/RealtimeProvider";
import type { DeviceNotificationPayload } from "@/types/realtime";
import { trpc } from "@/trpc/client";

const DEVICE_ICON = "/logo/demo.logo.png";

export const DeviceNotificationBridge = () => {
  const socket = useRealtimeSocket();
  const router = useRouter();
  const utils = trpc.useUtils();
  const deliveredRef = useRef(new Set<string>());
  const permissionRequestedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    if (Notification.permission === "default" && !permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      void Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleRealtimeNotification = (payload: DeviceNotificationPayload) => {
      if (!payload?.id || deliveredRef.current.has(payload.id)) {
        return;
      }

      deliveredRef.current.add(payload.id);

      void utils.notification.unseenCount.invalidate();
      void utils.notification.list.invalidate();
      void utils.dashboard.notifications.invalidate();

      if (typeof window === "undefined" || !("Notification" in window)) {
        return;
      }

      if (Notification.permission !== "granted") {
        return;
      }

      const deviceNotification = new Notification(payload.title, {
        body: payload.body,
        tag: payload.id,
        icon: DEVICE_ICON,
        badge: DEVICE_ICON,
      });

      deviceNotification.onclick = () => {
        window.focus();
        deviceNotification.close();
        if (payload.actionUrl) {
          router.push(payload.actionUrl);
        } else {
          router.push(`/notification/${payload.id}`);
        }
      };
    };

    socket.on("notification:new", handleRealtimeNotification);

    return () => {
      socket.off("notification:new", handleRealtimeNotification);
    };
  }, [router, socket, utils]);

  return null;
};
