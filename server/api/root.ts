import { createTRPCRouter } from "@/server/api/trpc";
import { healthRouter } from "@/server/api/routers/health";
import { AuthRouter } from "@/server/modules/auth/auth.route";
import { userRouter } from "@/server/modules/user/user.route";
import { attendanceRouter } from "@/server/modules/attendance/attendance.route";
import { leaveRouter } from "@/server/modules/leave/leave.route";
import { hrEmployeesRouter } from "@/server/modules/hr/employees/employees.route";
import { hrAttendanceRouter } from "@/server/modules/hr/attendance/attendance.route";
import { hrLeaveRouter } from "@/server/modules/hr/leave/leave.route";
import { hrDashboardRouter } from "@/server/modules/hr/dashboard/dashboard.route";
import { hrTeamRouter } from "@/server/modules/hr/team/team.route";
import { hrWorkRouter } from "@/server/modules/hr/work/work.route";
import { hrProjectRouter } from "@/server/modules/hr/project/project.route";
import { dashboardRouter } from "@/server/modules/dashboard/dashboard.route";
import { teamRouter } from "@/server/modules/team/team.route";
import { reportRouter } from "@/server/modules/report/report.route";
import { hrReportRouter } from "@/server/modules/hr/reports/reports.route";
import { notificationRouter } from "@/server/modules/notification/notification.route";
import { messageRouter } from "@/server/modules/messages/message.route";
import { invoiceRouter } from "@/server/modules/invoice/invoice.route";
import { hrInvoicesRouter } from "@/server/modules/hr/invoices/invoices.route";
import { hrOrganizationRouter } from "@/server/modules/hr/organization/organization.route";
import { hrDepartmentRouter } from "@/server/modules/hr/department/department.route";
import { hrAnnouncementsRouter } from "@/server/modules/hr/announcements/announcements.route";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: AuthRouter,
  user: userRouter,
  attendance: attendanceRouter,
  leave: leaveRouter,
  dashboard: dashboardRouter,
  team: teamRouter,
  report: reportRouter,
  notification: notificationRouter,
  message: messageRouter,
  invoice: invoiceRouter,
  hrEmployees: hrEmployeesRouter,
  hrAttendance: hrAttendanceRouter,
  hrLeave: hrLeaveRouter,
  hrDashboard: hrDashboardRouter,
  hrTeam: hrTeamRouter,
  hrDepartment: hrDepartmentRouter,
  hrWork: hrWorkRouter,
  hrProject: hrProjectRouter,
  hrReport: hrReportRouter,
  hrInvoices: hrInvoicesRouter,
  hrOrganization: hrOrganizationRouter,
  hrAnnouncements: hrAnnouncementsRouter,
});

export type AppRouter = typeof appRouter;
