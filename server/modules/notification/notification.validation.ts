import { NotificationType } from "@prisma/client";
import { z } from "zod";

const list = z
  .object({
    type: z.nativeEnum(NotificationType).optional(),
  })
  .optional();

const detail = z.object({
  id: z.string().min(1, "Notification id is required"),
});

const markAsSeen = z.object({
  id: z.string().min(1, "Notification id is required"),
});

export const NotificationValidation = {
  list,
  detail,
  markAsSeen,
};
