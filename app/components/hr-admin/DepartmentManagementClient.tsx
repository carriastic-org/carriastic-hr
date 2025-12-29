'use client';

import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiLayers,
  FiTarget,
  FiEdit2,
  FiEye,
  FiTrash2,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";

import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import TextArea from "@/app/components/atoms/inputs/TextArea";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { Modal } from "@/app/components/atoms/frame/Modal";
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

type DepartmentEditDraft = {
  departmentId: string;
  name: string;
  code: string;
  description: string;
  headUserId: string;
  memberUserIds: string[];
};

export default function DepartmentManagementClient() {
  const utils = trpc.useUtils();
  const overviewQuery = trpc.hrDepartment.overview.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const createMutation = trpc.hrDepartment.create.useMutation();
  const updateMutation = trpc.hrDepartment.update.useMutation();
  const assignHeadMutation = trpc.hrDepartment.assignHead.useMutation();
  const assignMembersMutation = trpc.hrDepartment.assignMembers.useMutation();
  const deleteMutation = trpc.hrDepartment.delete.useMutation();

  const [createForm, setCreateForm] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [alert, setAlert] = useState<AlertState>(null);
  const [viewDepartmentId, setViewDepartmentId] = useState<string | null>(null);
  const [editDepartmentId, setEditDepartmentId] = useState<string | null>(null);
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DepartmentEditDraft | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
  const viewDepartment = viewDepartmentId
    ? data.departments.find((dept) => dept.id === viewDepartmentId) ?? null
    : null;
  const editDepartment = editDepartmentId
    ? data.departments.find((dept) => dept.id === editDepartmentId) ?? null
    : null;
  const deleteDepartment = deleteDepartmentId
    ? data.departments.find((dept) => dept.id === deleteDepartmentId) ?? null
    : null;
  const viewMembers = viewDepartment
    ? data.employees.filter((employee) => viewDepartment.memberUserIds.includes(employee.userId))
    : [];

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

  const handleOpenViewModal = (departmentId: string) => {
    setViewDepartmentId(departmentId);
  };

  const handleOpenEditModal = (departmentId: string) => {
    const department = data.departments.find((dept) => dept.id === departmentId);
    if (!department) {
      setAlert({ type: "error", message: "Department not found." });
      return;
    }
    setEditDraft({
      departmentId: department.id,
      name: department.name ?? "",
      code: department.code ?? "",
      description: department.description ?? "",
      headUserId: department.headUserId ?? "",
      memberUserIds: department.memberUserIds,
    });
    setEditDepartmentId(departmentId);
  };

  const handleCloseEditModal = () => {
    setEditDepartmentId(null);
    setEditDraft(null);
  };

  const handleOpenDeleteModal = (departmentId: string) => {
    setDeleteDepartmentId(departmentId);
  };

  const handleCloseDeleteModal = () => {
    setDeleteDepartmentId(null);
  };

  const handleSaveEdit = async () => {
    if (!editDraft || isSavingEdit) return;
    if (!canManage) {
      setAlert({
        type: "error",
        message: "Only org admins, org owners, or super admins can manage departments.",
      });
      return;
    }
    const name = editDraft.name.trim();
    if (!name) {
      setAlert({ type: "error", message: "Department name cannot be empty." });
      return;
    }
    const code = editDraft.code.trim() ? editDraft.code.trim() : null;
    const description = editDraft.description.trim() ? editDraft.description.trim() : null;
    const headUserId = editDraft.headUserId.trim() ? editDraft.headUserId : null;
    setIsSavingEdit(true);
    try {
      await updateMutation.mutateAsync({
        departmentId: editDraft.departmentId,
        name,
        code,
        description,
      });
      await assignHeadMutation.mutateAsync({
        departmentId: editDraft.departmentId,
        headUserId,
      });
      await assignMembersMutation.mutateAsync({
        departmentId: editDraft.departmentId,
        memberUserIds: Array.from(new Set(editDraft.memberUserIds)),
      });
      setAlert({ type: "success", message: `${name} has been updated.` });
      handleCloseEditModal();
      void utils.hrDepartment.overview.invalidate();
    } catch (error) {
      setAlert({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to update department.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDepartmentId || isDeleting) return;
    if (!canManage) {
      setAlert({
        type: "error",
        message: "Only org admins, org owners, or super admins can manage departments.",
      });
      return;
    }
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync({ departmentId: deleteDepartmentId });
      setAlert({ type: "success", message: "Department deleted." });
      handleCloseDeleteModal();
      void utils.hrDepartment.overview.invalidate();
    } catch (error) {
      setAlert({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete department.",
      });
    } finally {
      setIsDeleting(false);
    }
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
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Department list</h2>
          <p className="text-sm text-slate-500">
            View, edit, or delete departments directly from the table.
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
          <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-white/90 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Manager</th>
                  <th className="px-4 py-3 text-center">Members</th>
                  <th className="px-4 py-3">Last updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((department) => (
                  <tr
                    key={department.id}
                    className="border-t border-slate-100 text-slate-700 dark:border-slate-800 dark:text-slate-200"
                  >
                    <td className="px-4 py-4 align-top">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {department.name}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600 dark:text-slate-300">
                      {department.code ?? "Not set"}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {department.headName ?? "Unassigned"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {department.headEmail ?? "No manager email"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {department.memberCount}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">
                      {new Date(department.updatedAtIso).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          theme="white"
                          className="px-3 py-2 text-xs"
                          onClick={() => handleOpenViewModal(department.id)}
                        >
                          <FiEye className="mr-1.5" />
                          View
                        </Button>
                        <Button
                          theme="secondary"
                          className="px-3 py-2 text-xs"
                          onClick={() => handleOpenEditModal(department.id)}
                          disabled={!canManage}
                        >
                          <FiEdit2 className="mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          theme="cancel-secondary"
                          className="px-3 py-2 text-xs"
                          onClick={() => handleOpenDeleteModal(department.id)}
                          disabled={!canManage}
                        >
                          <FiTrash2 className="mr-1.5" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(viewDepartmentId)}
        setOpen={(open) => {
          if (!open) {
            setViewDepartmentId(null);
          }
        }}
        title={viewDepartment ? `${viewDepartment.name} details` : "Department details"}
        doneButtonText=""
        isDoneButton={false}
        isCancelButton
        cancelButtonText="Close"
      >
        {viewDepartment ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Department code
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {viewDepartment.code ?? "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Members
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {viewDepartment.memberCount} members
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Manager
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {viewDepartment.headName ?? "Unassigned"}
                </p>
                <p className="text-xs text-slate-500">
                  {viewDepartment.headEmail ?? "No manager email"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last updated
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {new Date(viewDepartment.updatedAtIso).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {viewDepartment.description ?? "No description provided."}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Members
              </p>
              {viewMembers.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {viewMembers.map((member) => (
                    <MemberPill key={member.userId} person={member} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No members assigned yet.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Department not found.</p>
        )}
      </Modal>

      <Modal
        open={Boolean(editDepartmentId)}
        setOpen={(open) => {
          if (!open) {
            handleCloseEditModal();
          }
        }}
        title={editDepartment ? `Edit ${editDepartment.name}` : "Edit department"}
        doneButtonText={isSavingEdit ? "Saving..." : "Save changes"}
        cancelButtonText="Cancel"
        isCancelButton
        onDoneClick={handleSaveEdit}
      >
        {editDraft ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Department name"
                value={editDraft.name}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev,
                  )
                }
                disabled={!canManage || isSavingEdit}
                className="w-full"
              />
              <TextInput
                label="Department code"
                value={editDraft.code}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, code: event.target.value } : prev,
                  )
                }
                disabled={!canManage || isSavingEdit}
                className="w-full"
              />
            </div>
            <TextArea
              label="Mission / scope"
              value={editDraft.description}
              onChange={(event) =>
                setEditDraft((prev) =>
                  prev ? { ...prev, description: event.target.value } : prev,
                )
              }
              disabled={!canManage || isSavingEdit}
              height="120px"
              className="w-full"
            />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-600">
                <FiUserCheck className="text-indigo-500" />
                <p className="text-sm font-semibold">Department manager</p>
              </div>
              <select
                value={editDraft.headUserId}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, headUserId: event.target.value } : prev,
                  )
                }
                disabled={!canManage || isSavingEdit}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-700/30"
              >
                <option value="">No manager assigned</option>
                {data.employees.map((employee) => (
                  <option key={employee.userId} value={employee.userId}>
                    {employee.fullName} {employee.designation ? `· ${employee.designation}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-600">
                <FiUsers className="text-indigo-500" />
                <p className="text-sm font-semibold">Members</p>
              </div>
              <select
                multiple
                size={memberSelectSize}
                value={editDraft.memberUserIds}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          memberUserIds: Array.from(event.target.selectedOptions).map(
                            (option) => option.value,
                          ),
                        }
                      : prev,
                  )
                }
                disabled={!canManage || isSavingEdit}
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
                      employee.departmentName && employee.departmentId !== editDraft.departmentId
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
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Department not found.</p>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteDepartmentId)}
        setOpen={(open) => {
          if (!open) {
            handleCloseDeleteModal();
          }
        }}
        title="Delete department?"
        doneButtonText=""
        isDoneButton={false}
        isCancelButton={false}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Delete {deleteDepartment?.name ?? "this department"}? Members will be unassigned from
            this department.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              theme="secondary"
              onClick={handleCloseDeleteModal}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button theme="cancel" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete department"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
