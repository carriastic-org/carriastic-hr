"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { IconType } from "react-icons";
import { FiEdit2, FiEye, FiTrash2 } from "react-icons/fi";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EmploymentType, UserRole, WorkModel } from "@prisma/client";

import Button from "../../../components/atoms/buttons/Button";
import TextArea from "../../../components/atoms/inputs/TextArea";
import TextInput from "../../../components/atoms/inputs/TextInput";
import { Modal } from "../../../components/atoms/frame/Modal";
import { employeeStatusStyles } from "../../../utils/statusStyles";
import { trpc } from "@/trpc/client";
import type { EmployeeDirectoryEntry, EmployeeStatus } from "@/types/hr-admin";
import LoadingSpinner from "@/app/components/LoadingSpinner";

const IconActionButton = ({
  label,
  icon: Icon,
  href,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: IconType;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) => {
  const baseClasses =
    "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500";
  const styles = disabled ? `${baseClasses} pointer-events-none opacity-40` : baseClasses;
  const content = (
    <span className={styles}>
      <Icon className="text-base" />
    </span>
  );

  if (href && !disabled) {
    return (
      <Link href={href} aria-label={label}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="disabled:cursor-not-allowed"
    >
      {content}
    </button>
  );
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const countNewHiresInDays = (
  employees: EmployeeDirectoryEntry[],
  days: number
) => {
  const now = Date.now();
  const msInDay = 1000 * 60 * 60 * 24;
  return employees.filter((employee) => {
    if (!employee.startDate) return false;
    const start = new Date(employee.startDate).getTime();
    if (Number.isNaN(start)) return false;
    const diffDays = Math.floor((now - start) / msInDay);
    return diffDays <= days;
  }).length;
};

const statusFilterOptions: EmployeeStatus[] = [
  "Active",
  "On Leave",
  "Probation",
  "Pending",
];

const phoneRegex = /^\+?[0-9()\s-]{7,20}$/;

const manualInviteSchema = z.object({
  fullName: z.string().min(3, "Full name is required"),
  employeeCode: z.string().min(1, "Employee ID is required"),
  workEmail: z.string().email("Provide a valid work email"),
  inviteRole: z.string().min(1, "Select a role"),
  designation: z.string().min(2, "Designation is required"),
  phoneNumber: z
    .string()
    .min(7, "Phone number is required")
    .regex(phoneRegex, "Enter a valid phone number"),
  departmentId: z.string().optional(),
  teamId: z.string().optional(),
  managerId: z.string().optional(),
  startDate: z.string().optional(),
  workLocation: z.string().optional(),
  workModel: z.enum(["ONSITE", "HYBRID", "REMOTE"], {
    errorMap: () => ({ message: "Select a work arrangement" }),
  }),
  employmentType: z.string().min(1, "Choose an employment type"),
  notes: z.string().max(2000).optional(),
  sendInvite: z.boolean().optional(),
});

type ManualInviteFormValues = z.infer<typeof manualInviteSchema>;

const buildSuggestedEmail = (fullName: string, domain?: string | null) => {
  const safeDomain = (domain ?? "ndihr.io").replace(/^@/, "");
  if (!fullName.trim()) {
    return `name@${safeDomain}`;
  }
  const slug = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "");
  return `${slug || "name"}@${safeDomain}`;
};

export default function EmployeeManagementPage() {
  const utils = trpc.useUtils();
  const dashboardQuery = trpc.hrEmployees.dashboard.useQuery();
  const employeeDirectory = dashboardQuery.data?.directory ?? [];
  const manualInviteOptions = dashboardQuery.data?.manualInvite;
  const departmentOptions = manualInviteOptions?.departments ?? [];
  const teamOptions = manualInviteOptions?.teams ?? [];
  const locationOptions = manualInviteOptions?.locations ?? [];
  const employmentTypeOptions = manualInviteOptions?.employmentTypes ?? [];
  const workModelOptions = manualInviteOptions?.workModels ?? [];
  const inviteRoleOptions = manualInviteOptions?.allowedRoles ?? [];
  const manualInviteDisabled = inviteRoleOptions.length === 0;
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | EmployeeStatus>("all");
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [terminatingEmployeeId, setTerminatingEmployeeId] = useState<string | null>(null);
  const [pendingTermination, setPendingTermination] = useState<EmployeeDirectoryEntry | null>(null);
  const [isTerminateModalOpen, setIsTerminateModalOpen] = useState(false);
  const manualInviteForm = useForm<ManualInviteFormValues>({
    resolver: zodResolver(manualInviteSchema),
    defaultValues: {
      fullName: "",
      employeeCode: "",
      workEmail: "",
      inviteRole: "",
      designation: "",
      phoneNumber: "",
      departmentId: "",
      teamId: "",
      managerId: "",
      startDate: "",
      workLocation: "",
      workModel: "HYBRID",
      employmentType: "",
      notes: "",
      sendInvite: true,
    },
  });
  const {
    register: inviteRegister,
    handleSubmit: handleInviteSubmit,
    reset: resetInviteForm,
    watch: watchInviteForm,
    setValue: setInviteValue,
    formState: { errors: inviteErrors },
  } = manualInviteForm;
  const defaultManualInviteValues = useMemo<ManualInviteFormValues>(
    () => ({
      fullName: "",
      employeeCode: "",
      workEmail: "",
      inviteRole: manualInviteOptions?.allowedRoles[0]?.value ?? "",
      designation: "",
      phoneNumber: "",
      departmentId: "",
      teamId: "",
      managerId: "",
      startDate: "",
      workLocation: "",
      workModel: manualInviteOptions?.workModels[0]?.value ?? "HYBRID",
      employmentType: manualInviteOptions?.employmentTypes[0]?.value ?? "",
      notes: "",
      sendInvite: true,
    }),
    [manualInviteOptions],
  );
  const [fullNameForPlaceholder, setFullNameForPlaceholder] = useState("");
  const workEmailPlaceholder = useMemo(
    () => buildSuggestedEmail(fullNameForPlaceholder ?? "", manualInviteOptions?.organizationDomain),
    [fullNameForPlaceholder, manualInviteOptions?.organizationDomain],
  );
  const [managerSummary, setManagerSummary] = useState(
    "Select a department to auto-assign a manager.",
  );
  const selectedDepartmentId = watchInviteForm("departmentId");
  const selectedTeamId = watchInviteForm("teamId");
  const availableTeams = useMemo(
    () =>
      selectedDepartmentId
        ? teamOptions.filter((team) => team.departmentId === selectedDepartmentId)
        : [],
    [selectedDepartmentId, teamOptions],
  );
  const previousDepartmentRef = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousDepartmentRef.current;
    if (previous && selectedDepartmentId && previous !== selectedDepartmentId) {
      setInviteValue("teamId", "");
    }
    previousDepartmentRef.current = selectedDepartmentId ?? null;
  }, [selectedDepartmentId, setInviteValue]);

  useEffect(() => {
    if (!manualInviteOptions) {
      return;
    }
    const department = manualInviteOptions.departments.find(
      (dept) => dept.id === selectedDepartmentId,
    );
    const team = manualInviteOptions.teams.find((teamOption) => teamOption.id === selectedTeamId);

    const nextManagerId = team?.leadId ?? department?.headId ?? "";
    const nextManagerName =
      team?.leadName ??
      department?.headName ??
      (selectedDepartmentId ? "No manager assigned for this department yet." : "Select a department to auto-assign a manager.");

    setInviteValue("managerId", nextManagerId ?? "");
    setManagerSummary(nextManagerName);
  }, [manualInviteOptions, selectedDepartmentId, selectedTeamId, setInviteValue]);

  useEffect(() => {
    if (!actionAlert) {
      return;
    }
    const timer = window.setTimeout(() => setActionAlert(null), 5000);
    return () => window.clearTimeout(timer);
  }, [actionAlert]);

  useEffect(() => {
    if (!manualInviteOptions) {
      return;
    }
    resetInviteForm(defaultManualInviteValues);
  }, [defaultManualInviteValues, manualInviteOptions, resetInviteForm]);

  const terminateMutation = trpc.hrEmployees.deleteEmployee.useMutation({
    onSettled: () => {
      setTerminatingEmployeeId(null);
      setIsTerminateModalOpen(false);
      setPendingTermination(null);
    },
  });
  const inviteMutation = trpc.hrEmployees.invite.useMutation({
    onSuccess: (data) => {
      setActionAlert({
        type: "success",
        message: data.invitationSent
          ? `Invitation email sent to ${data.email}.`
          : `Invite link generated for ${data.email}.`,
      });
      resetInviteForm(defaultManualInviteValues);
      setFullNameForPlaceholder("");
      void utils.hrEmployees.dashboard.invalidate();
    },
    onError: (error) => {
      setActionAlert({
        type: "error",
        message: error.message,
      });
    },
  });
  const handleManualInviteSubmit = handleInviteSubmit((values) => {
    inviteMutation.mutate({
      ...values,
      employeeCode: values.employeeCode.trim(),
      inviteRole: values.inviteRole as UserRole,
      employmentType: values.employmentType as EmploymentType,
      workModel: values.workModel as WorkModel,
      departmentId: values.departmentId || undefined,
      teamId: values.teamId || undefined,
      managerId: values.managerId || undefined,
      phoneNumber: values.phoneNumber.trim(),
      startDate: values.startDate || undefined,
      workLocation: values.workLocation || undefined,
      notes: values.notes?.trim() || undefined,
      sendInvite: values.sendInvite ?? true,
    });
  });

  const handleTerminateEmployee = (employee: EmployeeDirectoryEntry) => {
    if (!employee.canTerminate) {
      setActionAlert({
        type: "error",
        message: "You do not have permission to terminate this employee.",
      });
      return;
    }
    setPendingTermination(employee);
    setIsTerminateModalOpen(true);
  };

  const confirmTerminateEmployee = () => {
    if (!pendingTermination) {
      return;
    }
    if (terminateMutation.isPending) {
      return;
    }
    if (!pendingTermination.canTerminate) {
      setActionAlert({
        type: "error",
        message: "You do not have permission to terminate this employee.",
      });
      setPendingTermination(null);
      setIsTerminateModalOpen(false);
      return;
    }
    const targetName = pendingTermination.name;
    setTerminatingEmployeeId(pendingTermination.id);
    terminateMutation.mutate(
      { employeeId: pendingTermination.id },
      {
        onSuccess: () => {
          void utils.hrEmployees.dashboard.invalidate();
          setActionAlert({
            type: "success",
            message: `${targetName} has been terminated.`,
          });
        },
        onError: (error) => {
          setActionAlert({ type: "error", message: error.message });
        },
      },
    );
  };

  const filteredDirectory = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return employeeDirectory.filter((employee) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          employee.name,
          employee.email,
          employee.role,
          employee.manager ?? "",
          employee.squad ?? "",
          employee.employeeCode ?? "",
        ].some((value) => value.toLowerCase().includes(normalizedSearch));

      const matchesDepartment =
        departmentFilter === "all" ||
        (employee.department?.toLowerCase() ?? "") ===
          departmentFilter.toLowerCase();

      const matchesStatus =
        statusFilter === "all" || employee.status === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [departmentFilter, employeeDirectory, searchTerm, statusFilter]);

  const totalEmployees = employeeDirectory.length;
  const activeEmployees = employeeDirectory.filter(
    (employee) => employee.status === "Active"
  ).length;
  const remoteHybridEmployees = employeeDirectory.filter((employee) => {
    const arrangement = employee.workArrangement?.toLowerCase();
    return arrangement === "remote" || arrangement === "hybrid";
  }).length;
  const newHires = countNewHiresInDays(employeeDirectory, 60);

  const overviewCards = useMemo(
    () => [
      {
        label: "Total employees",
        value: totalEmployees.toString().padStart(2, "0"),
        helper: `+${newHires} joined last 60 days`,
      },
      {
        label: "Active workforce",
        value: `${activeEmployees}`,
        helper:
          totalEmployees > 0
            ? `${Math.round(
                (activeEmployees / totalEmployees) * 100
              )}% of total`
            : "No records yet",
      },
      {
        label: "Remote + hybrid",
        value: remoteHybridEmployees.toString(),
        helper:
          totalEmployees > 0
            ? `${Math.round(
                (remoteHybridEmployees / totalEmployees) * 100
              )}% flexible`
            : "—",
      },
    ],
    [
      totalEmployees,
      newHires,
      activeEmployees,
      remoteHybridEmployees,
    ]
  );

  const directorySummary =
    filteredDirectory.length === totalEmployees
      ? `${totalEmployees} records · Export-ready and synced with payroll`
      : `${filteredDirectory.length} of ${totalEmployees} records match your filters`;

  const handleScrollToManualSignup = () => {
    const manualSignupSection = document.getElementById("manual-signup");
    manualSignupSection?.scrollIntoView({ behavior: "smooth" });
  };

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <LoadingSpinner label="Loading employees..." helper=""/>
      </div>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center text-slate-600">
        <p>We couldn&apos;t load the employee directory right now.</p>
        <Button
          onClick={() => dashboardQuery.refetch()}
          disabled={dashboardQuery.isFetching}
          className="px-6 py-3 text-sm"
        >
          {dashboardQuery.isFetching ? "Refreshing..." : "Retry"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {actionAlert ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            actionAlert.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
          }`}
        >
          {actionAlert.message}
        </div>
      ) : null}

      <section className="rounded-[32px] border border-white/60 bg-white/95 p-8 shadow-xl shadow-indigo-100 transition dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-300">
              Employee management
            </p>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
                Bring onboarding and people data into one desk.
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Manually create employee accounts, send invites, then jump into detailed
                profiles without switching apps.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <TextInput
                label="Search directory"
                placeholder="Name, squad, status..."
                className="w-full sm:flex-1"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <Button
                onClick={handleScrollToManualSignup}
                className="px-6 py-3 text-sm"
              >
                + Add employee
              </Button>
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2">
            {overviewCards.map((card) => (
              <div
                key={card.label}
                className="rounded-3xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/60 p-5 shadow-inner shadow-white/60 dark:border-slate-700/70 dark:from-slate-900 dark:to-slate-900/60 dark:shadow-none"
              >
                <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                  {card.value}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {card.helper}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-white/60 bg-white/95 p-6 shadow-xl shadow-indigo-100 transition dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Employee directory
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {directorySummary}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-inner shadow-white/60 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              <option value="all">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.name}>
                  {department.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-inner shadow-white/60 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as EmployeeStatus | "all")
              }
            >
              <option value="all">Status: All</option>
              {statusFilterOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Team Lead</th>
                <th className="px-4 py-3">Start date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredDirectory.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No employees match the current filters. Try adjusting your
                    search.
                  </td>
                </tr>
              ) : (
                filteredDirectory.map((employee) => {
                  const statusStyles =
                    employeeStatusStyles[employee.status] ??
                    employeeStatusStyles.Active;
                  return (
                    <tr
                      key={employee.id}
                      className="transition hover:bg-slate-50/60 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {employee.profilePhotoUrl ? (
                            <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/70 shadow shadow-slate-900/5 dark:border-slate-700/70 dark:shadow-slate-900/40">
                              <Image
                                src={employee.profilePhotoUrl}
                                alt={employee.name}
                                fill
                                sizes="44px"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 text-sm font-semibold uppercase text-white shadow shadow-indigo-500/30 dark:from-slate-800 dark:to-slate-700">
                              {employee.avatarInitials}
                            </div>
                          )}

                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {employee.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-800 dark:text-slate-100">
                          {employee.role}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {employee.squad ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {employee.department ?? "—"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusStyles.bg}`}
                        >
                          {employee.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {employee.manager ?? "—"}
                        <span className="block text-xs text-slate-400">
                          {employee.workArrangement ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {formatDate(employee.startDate)}
                        <span className="block text-xs text-slate-400">
                          {employee.experience} exp
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <IconActionButton
                            label={`View ${employee.name}`}
                            icon={FiEye}
                            href={`/hr-admin/employees/view/${encodeURIComponent(
                              employee.id,
                            )}`}
                          />
                          <IconActionButton
                            label={`Edit ${employee.name}`}
                            icon={FiEdit2}
                            href={`/hr-admin/employees/edit/${encodeURIComponent(
                              employee.id,
                            )}`}
                          />
                          {employee.canTerminate ? (
                            <IconActionButton
                              label={`Terminate ${employee.name}`}
                              icon={FiTrash2}
                              onClick={() => handleTerminateEmployee(employee)}
                              disabled={terminatingEmployeeId === employee.id}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        id="manual-signup"
        className="rounded-[32px] border border-white/60 bg-white/95 p-6 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none"
      >
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Manually add an employee
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Send a secure invite. Once they complete signup they can sign in right away.
            </p>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleManualInviteSubmit}>
            <TextInput
              label="Full name"
              placeholder="e.g. Afsana Khan"
              className="w-full"
              name="fullName"
              register={inviteRegister}
              error={inviteErrors.fullName}
              isRequired
              disabled={manualInviteDisabled}
              registerOptions={{
                onChange: (event) => {
                  setFullNameForPlaceholder(event.target.value);
                  return event;
                },
              }}
            />
            <TextInput
              label="Employee ID"
              placeholder="e.g. NDI-0102"
              className="w-full"
              name="employeeCode"
              register={inviteRegister}
              error={inviteErrors.employeeCode}
              isRequired
              disabled={manualInviteDisabled}
            />
            <TextInput
              label="Work email"
              type="email"
              placeholder={workEmailPlaceholder}
              className="w-full"
              name="workEmail"
              register={inviteRegister}
              error={inviteErrors.workEmail}
              isRequired
              disabled={manualInviteDisabled}
            />
            <TextInput
              label="Phone number"
              type="tel"
              placeholder="+8801xxxxxxxxx"
              className="w-full"
              name="phoneNumber"
              register={inviteRegister}
              error={inviteErrors.phoneNumber}
              isRequired
              disabled={manualInviteDisabled}
            />
            <div className="flex flex-col">
              <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
                Role
              </label>
              <select
                className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-200/70 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                {...inviteRegister("inviteRole")}
                disabled={manualInviteDisabled}
              >
                {inviteRoleOptions.length === 0 ? (
                  <option value="">No roles available</option>
                ) : null}
                {inviteRoleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              {inviteErrors.inviteRole ? (
                <p className="mt-1 text-xs text-rose-500">{inviteErrors.inviteRole.message}</p>
              ) : null}
            </div>
            <TextInput
              label="Designation"
              placeholder="e.g. Payroll Associate"
              className="w-full"
              name="designation"
              register={inviteRegister}
              error={inviteErrors.designation}
              isRequired
              disabled={manualInviteDisabled}
            />
            <TextInput
              label="Start date"
              type="date"
              className="w-full"
              name="startDate"
              register={inviteRegister}
              error={inviteErrors.startDate}
              disabled={manualInviteDisabled}
            />
            <div className="flex flex-col">
              <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
                Work location
              </label>
              <select
                className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-200/70 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                {...inviteRegister("workLocation")}
                disabled={manualInviteDisabled}
              >
                <option value="">Select location</option>
                {locationOptions.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
              {inviteErrors.workLocation ? (
                <p className="mt-1 text-xs text-rose-500">{inviteErrors.workLocation.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col">
              <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
                Work arrangement
              </label>
              <select
                className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-200/70 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                {...inviteRegister("workModel")}
                disabled={manualInviteDisabled}
              >
                <option value="">Select arrangement</option>
                {workModelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {inviteErrors.workModel ? (
                <p className="mt-1 text-xs text-rose-500">{inviteErrors.workModel.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col">
              <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
                Department
              </label>
              <select
                className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-200/70 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                {...inviteRegister("departmentId")}
                disabled={manualInviteDisabled}
              >
                <option value="">Select department</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              {inviteErrors.departmentId ? (
                <p className="mt-1 text-xs text-rose-500">{inviteErrors.departmentId.message}</p>
              ) : null}
            </div>
            {availableTeams.length > 0 ? (
              <div className="flex flex-col">
                <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
                  Team (optional)
                </label>
                <select
                  className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-200/70 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  {...inviteRegister("teamId")}
                  disabled={manualInviteDisabled}
                >
                  <option value="">No specific team</option>
                  {availableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                      {team.leadName ? ` · Lead ${team.leadName}` : ""}
                    </option>
                  ))}
                </select>
                {inviteErrors.teamId ? (
                  <p className="mt-1 text-xs text-rose-500">{inviteErrors.teamId.message}</p>
                ) : null}
              </div>
            ) : (
              <input type="hidden" {...inviteRegister("teamId")} />
            )}
            <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-sm dark:border-slate-700/70 dark:bg-slate-900/40">
              <input type="hidden" {...inviteRegister("managerId")} />
              <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Manager assignment
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {managerSummary}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Managers are auto-selected from department heads or team leads. You can update them later inside the employee profile.
              </p>
            </div>
            <div className="flex flex-col">
              <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
                Employment type
              </label>
              <select
                className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-200/70 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                {...inviteRegister("employmentType")}
                disabled={manualInviteDisabled}
              >
                {employmentTypeOptions.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {inviteErrors.employmentType ? (
                <p className="mt-1 text-xs text-rose-500">{inviteErrors.employmentType.message}</p>
              ) : null}
            </div>
            <TextArea
              label="Notes for HR (optional)"
              placeholder="Share onboarding context, paperwork status, or equipment needs."
              className="w-full md:col-span-2"
              height="120px"
              name="notes"
              register={inviteRegister}
              error={inviteErrors.notes}
              disabled={manualInviteDisabled}
            />
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <Button
                type="submit"
                className="px-6 py-3 text-sm"
                disabled={manualInviteDisabled || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? "Sending invite..." : "Send invite"}
              </Button>
              <Button
                type="button"
                theme="white"
                className="px-6 py-3 text-sm"
                onClick={() => {
                  resetInviteForm(defaultManualInviteValues);
                  setFullNameForPlaceholder("");
                }}
                disabled={manualInviteDisabled || inviteMutation.isPending}
              >
                Reset form
              </Button>
            </div>
          </form>
        </div>
      </section>
      <Modal
        open={isTerminateModalOpen}
        setOpen={(open) => {
          setIsTerminateModalOpen(open);
          if (!open) {
            setPendingTermination(null);
          }
        }}
        title="Terminate employee?"
        doneButtonText={terminatingEmployeeId ? "Terminating..." : "Terminate"}
        cancelButtonText="Cancel"
        isCancelButton
        buttonWidth="140px"
        buttonHeight="44px"
        onDoneClick={confirmTerminateEmployee}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Terminate {pendingTermination?.name ?? "this employee"}? This immediately revokes access
          and cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
