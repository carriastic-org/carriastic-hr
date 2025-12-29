import type { EmployeeStatus } from "@/types/hr-admin";

export const employeeStatusStyles: Record<
  EmployeeStatus,
  { bg: string; text: string }
> = {
  Active: {
    bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
    text: "text-emerald-700 dark:text-emerald-200",
  },
  "On Leave": {
    bg: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
    text: "text-amber-700 dark:text-amber-200",
  },
  Probation: {
    bg: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200",
    text: "text-indigo-700 dark:text-indigo-200",
  },
  Pending: {
    bg: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-200",
    text: "text-purple-700 dark:text-purple-200",
  },
};
