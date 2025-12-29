export type HrAttendanceStatus = "On time" | "Late" | "On leave" | "Absent";

export type HrAttendanceLog = {
  id: string;
  employeeId: string;
  name: string;
  department: string | null;
  squad: string | null;
  checkIn: string;
  checkOut: string;
  status: HrAttendanceStatus;
  source: "Manual" | "System";
};

export type HrAttendanceStatusCounts = Record<HrAttendanceStatus, number>;

export type HrAttendanceCalendarSignal = "ontime" | "late" | "leave" | "absent" | "none";

export type HrAttendanceCalendarDay = {
  date: string;
  signal: HrAttendanceCalendarSignal;
};

export type HrAttendanceWeeklyTrendPoint = {
  date: string;
  label: string;
  presentCount: number;
  presentPercentage: number;
};

export type HrAttendanceEmployeeOption = {
  id: string;
  name: string;
  department: string | null;
  squad: string | null;
};

export type HrAttendanceOverviewResponse = {
  date: string;
  employees: HrAttendanceEmployeeOption[];
  dayLogs: HrAttendanceLog[];
  statusCounts: HrAttendanceStatusCounts;
  calendar: HrAttendanceCalendarDay[];
  weeklyTrend: HrAttendanceWeeklyTrendPoint[];
};

export type HrAttendanceHistoryRow = {
  date: string;
  checkIn: string;
  checkOut: string;
  status: HrAttendanceStatus;
  source: "Manual" | "System";
};

export type HrAttendanceHistoryResponse = {
  employeeId: string;
  month: number;
  year: number;
  rows: HrAttendanceHistoryRow[];
};
