import { z } from "zod";

const overviewInputSchema = z.object({
  date: z.string().datetime().optional(),
});

export type HrDashboardOverviewInput = z.infer<typeof overviewInputSchema>;

export const hrDashboardOverviewSchema = overviewInputSchema.optional();
