import { PrismaClient } from "@prisma/client";

const baseDate = new Date("2025-01-10T00:00:00+06:00");

const attendanceRecords = [
  {
    id: "att-1",
    employeeId: "eng-head-sakib",
    attendanceDate: baseDate,
    checkInAt: new Date("2025-01-10T09:05:00+06:00"),
    checkOutAt: new Date("2025-01-10T18:05:00+06:00"),
    totalWorkSeconds: 9 * 3600,
    status: "PRESENT" as const,
    note: "Client sync in the morning.",
    location: "Dhaka HQ",
    source: "Turnstile",
  },
  {
    id: "att-2",
    employeeId: "backend-lead-sufi",
    attendanceDate: baseDate,
    checkInAt: new Date("2025-01-10T09:20:00+06:00"),
    checkOutAt: new Date("2025-01-10T18:30:00+06:00"),
    totalWorkSeconds: 8 * 3600,
    status: "LATE" as const,
    note: "Traffic delay reported.",
    location: "Remote",
    source: "VPN",
  },
  {
    id: "att-3",
    employeeId: "emp-saiful",
    attendanceDate: baseDate,
    checkInAt: new Date("2025-01-10T09:00:00+06:00"),
    checkOutAt: new Date("2025-01-10T17:45:00+06:00"),
    totalWorkSeconds: 7.75 * 3600,
    status: "PRESENT" as const,
    location: "Dhaka HQ",
    source: "Turnstile",
  },
  {
    id: "att-4",
    employeeId: "eng-head-sakib",
    attendanceDate: new Date("2025-01-11T00:00:00+06:00"),
    checkInAt: new Date("2025-01-11T09:10:00+06:00"),
    checkOutAt: new Date("2025-01-11T13:00:00+06:00"),
    totalWorkSeconds: 4 * 3600,
    status: "HALF_DAY" as const,
    note: "Left early for customer visit.",
    location: "Client site",
    source: "Mobile",
  },
  {
    id: "att-5",
    employeeId: "backend-lead-sufi",
    attendanceDate: new Date("2025-01-11T00:00:00+06:00"),
    status: "ABSENT" as const,
    note: "Approved sick leave.",
    location: "N/A",
  },
];

export const seedAttendance = async (prisma: PrismaClient) => {
  await prisma.attendanceRecord.createMany({ data: attendanceRecords });
};
