"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

import { DeviceNotificationBridge } from "./components/notifications/DeviceNotificationBridge";
import { RealtimeProvider } from "./components/realtime/RealtimeProvider";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { TRPCReactProvider } from "@/trpc/react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TRPCReactProvider>
        <RealtimeProvider>
          <ThemeProvider>
            <DeviceNotificationBridge />
            {children}
          </ThemeProvider>
        </RealtimeProvider>
      </TRPCReactProvider>
    </SessionProvider>
  );
}
