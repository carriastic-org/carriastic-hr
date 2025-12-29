export const leaveTypeValues = [
  "CASUAL",
  "SICK",
  "ANNUAL",
  "PATERNITY_MATERNITY",
] as const;

export type LeaveTypeValue = (typeof leaveTypeValues)[number];

export type LeaveTypeOption = {
  value: LeaveTypeValue;
  label: string;
  shortLabel: string;
  description: string;
  defaultAllocationDays: number;
  accentClass: string;
  chipClass: string;
};

export const leaveTypeOptions: LeaveTypeOption[] = [
  {
    value: "CASUAL",
    label: "Casual Leave",
    shortLabel: "Casual",
    description: "For personal errands, short breaks, or flexible time off.",
    defaultAllocationDays: 10,
    accentClass: "from-emerald-500 via-emerald-400 to-emerald-500",
    chipClass:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100",
  },
  {
    value: "SICK",
    label: "Sick Leave",
    shortLabel: "Sick",
    description: "Rest and recovery when unwell or for medical visits.",
    defaultAllocationDays: 7,
    accentClass: "from-sky-500 via-sky-400 to-sky-500",
    chipClass: "bg-sky-50 text-sky-600 dark:bg-sky-500/20 dark:text-sky-100",
  },
  {
    value: "ANNUAL",
    label: "Annual Leave",
    shortLabel: "Annual",
    description: "Planned vacations or extended breaks during the year.",
    defaultAllocationDays: 14,
    accentClass: "from-amber-500 via-amber-400 to-amber-500",
    chipClass:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100",
  },
  {
    value: "PATERNITY_MATERNITY",
    label: "Paternity/Maternity Leave",
    shortLabel: "Paternity/Maternity",
    description: "Bonding time for new parents, inclusive of all caregivers.",
    defaultAllocationDays: 30,
    accentClass: "from-violet-500 via-violet-400 to-violet-500",
    chipClass:
      "bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-100",
  },
];

export const leaveTypeLabelMap: Record<LeaveTypeValue, string> = leaveTypeOptions.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<LeaveTypeValue, string>,
);

export const leaveTypeOptionMap: Record<LeaveTypeValue, LeaveTypeOption> =
  leaveTypeOptions.reduce((acc, option) => {
    acc[option.value] = option;
    return acc;
  }, {} as Record<LeaveTypeValue, LeaveTypeOption>);
