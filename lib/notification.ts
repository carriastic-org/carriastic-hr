export const notificationTypeLabels = {
  ANNOUNCEMENT: "Announcement",
  LEAVE: "Leave",
  ATTENDANCE: "Attendance",
  REPORT: "Reports",
  INVOICE: "Invoices",
} as const;

export type NotificationTypeValue = keyof typeof notificationTypeLabels;

export const getNotificationTypeLabel = (type?: string | null) => {
  if (!type) {
    return "";
  }
  return notificationTypeLabels[type as NotificationTypeValue] ?? type;
};
