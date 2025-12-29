export type DeviceNotificationPayload = {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  timestamp: string;
  type: string;
  status: string;
};
