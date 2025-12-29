import { z } from "zod";

const threadIdSchema = z.string().min(1, "Thread ID is required.");

export const MessageValidation = {
  list: z
    .object({
      query: z
        .string()
        .max(120, "Search query must be at most 120 characters.")
        .optional()
        .nullable(),
    })
    .optional(),
  directory: z
    .object({
      query: z
        .string()
        .max(120, "Search query must be at most 120 characters.")
        .optional()
        .nullable(),
    })
    .optional(),
  threadMessages: z.object({
    threadId: threadIdSchema,
  }),
  sendMessage: z.object({
    threadId: threadIdSchema,
    body: z
      .string()
      .trim()
      .min(1, "Message cannot be empty.")
      .max(2000, "Message must be 2000 characters or fewer."),
  }),
  createThread: z.object({
    title: z
      .string()
      .trim()
      .min(3, "Title should be at least 3 characters.")
      .max(100, "Title should be 100 characters or fewer.")
      .optional()
      .nullable(),
    participantIds: z
      .array(z.string().min(1))
      .min(1, "Select at least one participant."),
    message: z
      .string()
      .trim()
      .min(1, "Message cannot be empty.")
      .max(2000, "Message must be 2000 characters or fewer."),
  }),
};

export type MessageListInput = z.infer<typeof MessageValidation.list>;
export type DirectoryInput = z.infer<typeof MessageValidation.directory>;
export type ThreadMessagesInput = z.infer<typeof MessageValidation.threadMessages>;
export type SendMessageInput = z.infer<typeof MessageValidation.sendMessage>;
export type CreateThreadInput = z.infer<typeof MessageValidation.createThread>;
