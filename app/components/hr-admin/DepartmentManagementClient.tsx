'use client';

import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiLayers,
  FiTarget,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";

import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import TextArea from "@/app/components/atoms/inputs/TextArea";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import type { HrDepartmentPerson } from "@/types/hr-department";
import { trpc } from "@/trpc/client";

type AlertState = { type: "success" | "error"; message: string } | null;

const AlertBanner = ({ alert }: { alert: AlertState }) => {
  if (!alert) return null;
  const Icon = alert.type === "success" ? FiCheckCircle : FiAlertCircle;
  const baseClasses =
    alert.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${baseClasses}`}>
      <Icon className="text-base" />
      <p className="font-semibold">{alert.message}</p>
    </div>
  );
};

const MemberPill = ({ person }: { person: HrDepartmentPerson }) => (
  <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2 text-left shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{person.fullName}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400">
      {person.designation ?? person.departmentName ?? "Role coming soon"}
    </p>
  </div>
);

export default function DepartmentManagementClient() {
  const utils = trpc.useUtils();
  const overviewQuery = trpc.hrDepartment.overview.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const createMutation = trpc.hrDepartment.create.useMutation();
  const updateMutation = trpc.hrDepartment.update.useMutation();
  const assignHeadMutation = trpc.hrDepartment.assignHead.useMutation();
  const assignMembersMutation = trpc.hrDepartment.assignMembers.useMutation();

  const [createForm, setCreateForm] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [detailEdits, setDetailEdits] = useState<
    Record<string, { name: string; code: string; description: string }>
  >({});
  const [headEdits, setHeadEdits] = useState<Record<string, string>>({});
  const [memberEdits, setMemberEdits] = useState<Record<string, string[]>>({});
  const [alert, setAlert] = useState<AlertState>(null);
  const [pendingDetailId, setPendingDetailId] = useState<string | null>(null);
  const [pendingHeadId, setPendingHeadId] = useState<string | null>(null);
  const [pendingMembersId, setPendingMembersId] = useState<string | null>(null);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), 5000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  const data = overviewQuery.data;
  const memberSelectSize = useMemo(() => {
    const total = data?.employees.length ?? 0;
    return Math.min(12, Math.max(5, total || 5));
  }, [data?.employees.length]);

  if (overviewQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <LoadingSpinner
          label="Loading departments"
          helper="Collecting department summaries and team members."
        />
      </div>
    );
  }

  if (overviewQuery.error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="text-lg font-semibold">We couldn’t load the department data.</p>
        <p className="text-sm text-rose-600 dark:text-rose-300">
          {overviewQuery.error.message}
        </p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const canManage = data.canManage;

  const handleCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      setAlert({
        type: "error",
        message: "Only org admins, org owners, or super admins can manage departments.",
      });
      return;
    }

    if (!createForm.name.trim()) {
      setAlert({ type: "error", message: "Provide a department name first." });
      return;
    }

    createMutation.mutate(
      {
        name: createForm.name.trim(),
        code: createForm.code.trim() ? createForm.code.trim() : null,
        description: createForm.description.trim() ? createForm.description.trim() : null,
      },
      {
        onSuccess: () => {
          setCreateForm({ name: "", code: "", description: "" });
          setAlert({ type: "success", message: "Department created successfully." });
          void utils.hrDepartment.overview.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
      },
    );
  };

  const handleSaveDetails = (departmentId: string) => {
    if (!canManage) {
      setAlert({
        type: "error",
        message: "Only org admins, org owners, or super admins can manage departments.",
      });
      return;
    }
    const department = data.departments.find((dept) => dept.id === departmentId);
    if (!department) {
      setAlert({ type: "error", message: "Department not found." });
      return;
    }
    const edits =
      detailEdits[departmentId] ?? {
        name: department.name ?? "",
        code: department.code ?? "",
        description: department.description ?? "",
      };
    const name = edits.name.trim();
    if (!name) {
      setAlert({ type: "error", message: "Department name cannot be empty." });
      return;
    }
    const code = edits.code.trim() ? edits.code.trim() : null;
    const description = edits.description.trim() ? edits.description.trim() : null;
    setPendingDetailId(departmentId);
    updateMutation.mutate(
      {
        departmentId,
        name,
        code,
        description,
      },
      {
        onSuccess: () => {
          setAlert({ type: "success", message: `${name} has been updated.` });
          setDetailEdits((prev) => {
            const next = { ...prev };
            delete next[departmentId];
            return next;
          });
          void utils.hrDepartment.overview.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
        onSettled: () => setPendingDetailId(null),
      },
    );
  };

  const handleSaveHead = (departmentId: string) => {
    if (!canManage) {
      setAlert({
        type: "error",
        message: "Only org admins, org owners, or super admins can manage departments.",
      });
      return;
    }
    const selectedHead = headEdits[departmentId] ?? data.departments.find((dept) => dept.id === departmentId)?.headUserId ?? "";
    setPendingHeadId(departmentId);
    assignHeadMutation.mutate(
      {
        departmentId,
        headUserId: selectedHead ? selectedHead : null,
      },
      {
        onSuccess: () => {
          setAlert({ type: "success", message: "Department manager updated." });
          setHeadEdits((prev) => {
            const next = { ...prev };
            delete next[departmentId];
            return next;
          });
          void utils.hrDepartment.overview.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
        onSettled: () => setPendingHeadId(null),
      },
    );
  };

  const handleSaveMembers = (departmentId: string) => {
    if (!canManage) {
      setAlert({
        type: "error",
        message: "Only org admins, org owners, or super admins can manage departments.",
      });
      return;
    }
    const department = data.departments.find((dept) => dept.id === departmentId);
    if (!department) {
      setAlert({ type: "error", message: "Department not found." });
      return;
    }
    const selectedMembers = memberEdits[departmentId] ?? department.memberUserIds;
    setPendingMembersId(departmentId);
    assignMembersMutation.mutate(
      {
        departmentId,
        memberUserIds: Array.from(new Set(selectedMembers)),
      },
      {
        onSuccess: () => {
          setAlert({ type: "success", message: "Department members updated." });
          setMemberEdits((prev) => {
            const next = { ...prev };
            delete next[departmentId];
            return next;
          });
          void utils.hrDepartment.overview.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
        onSettled: () => setPendingMembersId(null),
      },
    );
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="inline-flex items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
          <FiLayers />
          Structure & Leadership
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Department Management
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Create departments, assign managers, and map teammates so reporting lines stay crystal clear.
          </p>
        </div>
      </header>

      <AlertBanner alert={alert} />

      {!canManage ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="text-base font-semibold">Read-only access</p>
          <p className="text-sm">
            Only org admins, org owners, or super admins can change departments. Contact your workspace admin for access.
          </p>
        </div>
      ) : null}

      {canManage ? (
        <section className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900/5 p-3 text-indigo-600 dark:bg-white/5 dark:text-indigo-300">
              <FiTarget className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Create a new department
              </h2>
              <p className="text-sm text-slate-500">
                Give the unit a clear name, optional code, and note its mission or scope.
              </p>
            </div>
          </div>
          <form className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr]" onSubmit={handleCreateSubmit}>
            <div>
              <TextInput
                label="Department name"
                placeholder="People Ops, Finance, Growth..."
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                disabled={createMutation.isPending}
                isRequired
                className="w-full"
              />
            </div>
            <div>
              <TextInput
                label="Department code"
                placeholder="OPS, FIN, GTM"
                value={createForm.code}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))}
                disabled={createMutation.isPending}
                className="w-full"
              />
            </div>
            <div className="md:col-span-2">
              <TextArea
                label="Mission / scope"
                placeholder="What problems does this department solve?"
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                }
                disabled={createMutation.isPending}
                height="120px"
                className="w-full"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Save department"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Manage departments</h2>
          <p className="text-sm text-slate-500">
            Update department details, assign managers, and keep members aligned.
          </p>
        </div>

        {data.departments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-slate-500 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
            <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              No departments yet
            </p>
            <p className="mt-2 text-sm">
              Start by creating your first department so projects and approvals stay organized.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {data.departments.map((department) => {
              const detailValues =
                detailEdits[department.id] ?? {
                  name: department.name ?? "",
                  code: department.code ?? "",
                  description: department.description ?? "",
                };
              const selectedHead =
                headEdits[department.id] ?? department.headUserId ?? "";
              const selectedMembers =
                memberEdits[department.id] ?? department.memberUserIds;
              const pendingDetails = pendingDetailId === department.id && updateMutation.isPending;
              const pendingHead = pendingHeadId === department.id && assignHeadMutation.isPending;
              const pendingMembers =
                pendingMembersId === department.id && assignMembersMutation.isPending;
              return (
                <div
                  key={department.id}
                  className="space-y-6 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Department
                      </p>
                      <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
                        {department.name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {department.description ?? "No description provided yet."}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/5 px-4 py-3 text-right text-slate-900 dark:bg-white/5 dark:text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Headcount
                      </p>
                      <p className="text-3xl font-semibold">{department.memberCount}</p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FiLayers className="text-indigo-500" />
                        <div>
                          <p className="text-sm font-semibold text-slate-600">Department details</p>
                          <p className="text-xs text-slate-500">
                            Rename, update code, or document the scope.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <TextInput
                          label="Name"
                          value={detailValues.name}
                          onChange={(event) =>
                            setDetailEdits((prev) => ({
                              ...prev,
                              [department.id]: {
                                ...detailValues,
                                name: event.target.value,
                              },
                            }))
                          }
                          disabled={!canManage}
                          className="w-full"
                        />
                        <TextInput
                          label="Code"
                          value={detailValues.code}
                          onChange={(event) =>
                            setDetailEdits((prev) => ({
                              ...prev,
                              [department.id]: {
                                ...detailValues,
                                code: event.target.value,
                              },
                            }))
                          }
                          disabled={!canManage}
                          className="w-full"
                        />
                        <TextArea
                          label="Mission / scope"
                          value={detailValues.description}
                          onChange={(event) =>
                            setDetailEdits((prev) => ({
                              ...prev,
                              [department.id]: {
                                ...detailValues,
                                description: event.target.value,
                              },
                            }))
                          }
                          disabled={!canManage}
                          height="110px"
                          className="w-full"
                        />
                      </div>
                      <Button
                        theme="secondary"
                        onClick={() => handleSaveDetails(department.id)}
                        disabled={!canManage || pendingDetails}
                      >
                        {pendingDetails ? "Saving..." : "Save details"}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FiUserCheck className="text-indigo-500" />
                        <div>
                          <p className="text-sm font-semibold text-slate-600">
                            Department manager
                          </p>
                          <p className="text-xs text-slate-500">
                            Choose who leads approvals and reports for this department.
                          </p>
                        </div>
                      </div>
                      <select
                        value={selectedHead}
                        onChange={(event) =>
                          setHeadEdits((prev) => ({
                            ...prev,
                            [department.id]: event.target.value,
                          }))
                        }
                        disabled={!canManage}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-700/30"
                      >
                        <option value="">No manager assigned</option>
                        {data.employees.map((employee) => (
                          <option key={employee.userId} value={employee.userId}>
                            {employee.fullName} {employee.designation ? `· ${employee.designation}` : ""}
                          </option>
                        ))}
                      </select>
                      <Button
                        theme="secondary"
                        onClick={() => handleSaveHead(department.id)}
                        disabled={!canManage || pendingHead}
                      >
                        {pendingHead ? "Saving..." : "Save manager"}
                      </Button>
                      <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/60">
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Current manager
                        </p>
                        {department.headName ? (
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {department.headName}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-500">No manager assigned yet.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FiUsers className="text-indigo-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-600">Members</p>
                        <p className="text-xs text-slate-500">
                          Select everyone who belongs to this department. They’ll appear in reports and invites.
                        </p>
                      </div>
                    </div>
                    <select
                      multiple
                      size={memberSelectSize}
                      value={selectedMembers}
                      onChange={(event) =>
                        setMemberEdits((prev) => ({
                          ...prev,
                          [department.id]: Array.from(event.target.selectedOptions).map(
                            (option) => option.value,
                          ),
                        }))
                      }
                      disabled={!canManage}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-700/30"
                    >
                      {data.employees.length === 0 ? (
                        <option value="" disabled>
                          No employees available
                        </option>
                      ) : (
                        data.employees.map((employee) => {
                          const hints = [
                            employee.designation ? `• ${employee.designation}` : null,
                            employee.departmentName && employee.departmentId !== department.id
                              ? `(Currently ${employee.departmentName})`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <option key={employee.userId} value={employee.userId}>
                              {employee.fullName} {hints}
                            </option>
                          );
                        })
                      )}
                    </select>
                    <Button
                      theme="secondary"
                      onClick={() => handleSaveMembers(department.id)}
                      disabled={!canManage || pendingMembers}
                    >
                      {pendingMembers ? "Saving..." : "Save members"}
                    </Button>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Member preview
                      </p>
                      {department.memberPreview.length ? (
                        <div className="flex flex-wrap gap-2">
                          {department.memberPreview.map((member) => (
                            <MemberPill key={member.userId} person={member} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No members assigned yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
