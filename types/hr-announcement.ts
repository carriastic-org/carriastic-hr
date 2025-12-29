import { NotificationAudience, NotificationStatus, UserRole } from "@prisma/client";

export type HrAnnouncementRecipient = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type HrAnnouncementListItem = {
  id: string;
  title: string;
  body: string;
  bodyPreview: string;
  status: NotificationStatus;
  audience: NotificationAudience;
  audienceLabel: string;
  sentAt: string | null;
  createdAt: string;
  recipientCount: number;
  recipients: HrAnnouncementRecipient[];
  isOrganizationWide: boolean;
  senderId: string | null;
  senderName: string | null;
};

export type HrAnnouncementOverviewResponse = {
  viewerRole: UserRole;
  announcements: HrAnnouncementListItem[];
  recipients: HrAnnouncementRecipient[];
};
