"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiEdit2,
  FiEye,
  FiTrash2,
  FiUsers,
  FiUserPlus,
} from "react-icons/fi";

import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import TextArea from "@/app/components/atoms/inputs/TextArea";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { Modal } from "@/app/components/atoms/frame/Modal";
import type { HrTeamPerson } from "@/types/hr-team";
import { TEAM_MANAGEMENT_ROLES } from "@/types/hr-team";
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

const MemberPill = ({ person }: { person: HrTeamPerson }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 text-left shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{person.fullName}</p>
      {person.isTeamLead ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-400/20 dark:text-amber-200">
          Team Lead
        </span>
      ) : null}
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400">
      {person.designation ?? person.teamName ?? "Role coming soon"}
    </p>
  </div>
);

const emptyStateIllustrations = [
  "No teams yet. Start by creating your first squad.",
  "Assign a lead to unlock capacity planning.",
  "Map teammates to squads so reporting stays accurate.",
];

type TeamEditDraft = {
  teamId: string;
  name: string;
  departmentId: string;
  description: string;
  leadUserIds: string[];
  memberUserIds: string[];
};

export default function TeamManagementClient() {
  const utils = trpc.useUtils();
  const overviewQuery = trpc.hrTeam.overview.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const createTeamMutation = trpc.hrTeam.createTeam.useMutation();
  const updateTeamMutation = trpc.hrTeam.updateTeam.useMutation();
  const assignLeadMutation = trpc.hrTeam.assignLead.useMutation();
  const assignMembersMutation = trpc.hrTeam.assignMembers.useMutation();
  const deleteTeamMutation = trpc.hrTeam.deleteTeam.useMutation();

  const data = overviewQuery.data;
  const canManage = data?.canManage ?? false;

  const [createForm, setCreateForm] = useState({
    name: "",
    departmentId: "",
    description: "",
  });
  const [alert, setAlert] = useState<AlertState>(null);
  const [viewTeamId, setViewTeamId] = useState<string | null>(null);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TeamEditDraft | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), 5000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  const memberSelectSize = useMemo(() => {
    const total = data?.employees.length ?? 4;
    return Math.min(10, Math.max(4, total));
  }, [data?.employees.length]);
  const leadSelectSize = useMemo(() => {
    const total = data?.employees.length ?? 6;
    return Math.min(6, Math.max(3, Math.ceil(total / 6)));
  }, [data?.employees.length]);

  const handleCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      setAlert({
        type: "error",
        message: "Only managers, org admins, org owners, or super admins can change teams.",
      });
      return;
    }

    if (!createForm.name.trim() || !createForm.departmentId) {
      setAlert({ type: "error", message: "Provide both a team name and a department." });
      return;
    }

    createTeamMutation.mutate(
      {
        name: createForm.name.trim(),
        departmentId: createForm.departmentId,
        description: createForm.description.trim() ? createForm.description.trim() : undefined,
      },
      {
        onSuccess: () => {
          setCreateForm({ name: "", departmentId: "", description: "" });
          setAlert({ type: "success", message: "Team created successfully." });
          void utils.hrTeam.overview.invalidate();
        },
        onError: (error) => {
          setAlert({ type: "error", message: error.message });
        },
      },
    );
  };

  const handleOpenViewModal = (teamId: string) => {
    setViewTeamId(teamId);
  };

  const handleOpenEditModal = (teamId: string) => {
    const team = data?.teams.find((item) => item.id === teamId);
    if (!team) {
      setAlert({ type: "error", message: "Team not found." });
      return;
    }
    setEditDraft({
      teamId: team.id,
      name: team.name,
      departmentId: team.departmentId,
      description: team.description ?? "",
      leadUserIds: team.leadUserIds,
      memberUserIds: team.memberUserIds,
    });
    setEditTeamId(teamId);
  };

  const handleCloseEditModal = () => {
    setEditTeamId(null);
    setEditDraft(null);
  };

  const handleOpenDeleteModal = (teamId: string) => {
    setDeleteTeamId(teamId);
  };

  const handleCloseDeleteModal = () => {
    setDeleteTeamId(null);
  };

  const handleSaveEdit = async () => {
    if (!editDraft || isSavingEdit) return;
    if (!canManage) {
      setAlert({
        type: "error",
        message: "Only managers, org admins, org owners, or super admins can change teams.",
      });
      return;
    }
    const name = editDraft.name.trim();
    if (!name || !editDraft.departmentId) {
      setAlert({ type: "error", message: "Provide both a team name and a department." });
      return;
    }
    setIsSavingEdit(true);
    try {
      await updateTeamMutation.mutateAsync({
        teamId: editDraft.teamId,
        name,
        departmentId: editDraft.departmentId,
        description: editDraft.description.trim() ? editDraft.description.trim() : null,
      });
      await assignLeadMutation.mutateAsync({
        teamId: editDraft.teamId,
        leadUserIds: Array.from(new Set(editDraft.leadUserIds)),
      });
      await assignMembersMutation.mutateAsync({
        teamId: editDraft.teamId,
        memberUserIds: Array.from(new Set(editDraft.memberUserIds)),
      });
      setAlert({ type: "success", message: "Team updated successfully." });
      handleCloseEditModal();
      void utils.hrTeam.overview.invalidate();
    } catch (error) {
      setAlert({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to update team.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTeamId || isDeleting) return;
    if (!canManage) {
      setAlert({
        type: "error",
        message: "Only managers, org admins, org owners, or super admins can change teams.",
      });
      return;
    }
    setIsDeleting(true);
    try {
      await deleteTeamMutation.mutateAsync({ teamId: deleteTeamId });
      setAlert({ type: "success", message: "Team deleted." });
      handleCloseDeleteModal();
      void utils.hrTeam.overview.invalidate();
    } catch (error) {
      setAlert({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete team.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <LoadingSpinner
          label="Loading team management"
          helper="Fetching teams, departments, and eligible teammates."
        />
      </div>
    );
  }

  if (overviewQuery.error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="text-lg font-semibold">We couldn’t load the team data.</p>
        <p className="text-sm text-rose-600 dark:text-rose-300">
          {overviewQuery.error.message}
        </p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const viewTeam = viewTeamId
    ? data.teams.find((team) => team.id === viewTeamId) ?? null
    : null;
  const editTeam = editTeamId
    ? data.teams.find((team) => team.id === editTeamId) ?? null
    : null;
  const deleteTeam = deleteTeamId
    ? data.teams.find((team) => team.id === deleteTeamId) ?? null
    : null;
  const viewMembers = viewTeam
    ? data.employees.filter((employee) => viewTeam.memberUserIds.includes(employee.userId))
    : [];

  const viewerRole = data.viewerRole;
  const roleList = TEAM_MANAGEMENT_ROLES.join(", ");

  return (
    <div className="space-y-8">
      <header className="space-y-3 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="inline-flex items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
          <FiUsers />
          Team Operations
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Team Management
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Create squads, assign leads, and keep every teammate aligned to the right pod.
            Only {roleList} can make changes. You are signed in as {viewerRole}.
          </p>
        </div>
      </header>

      <AlertBanner alert={alert} />

      {!canManage ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="text-base font-semibold">Read-only access</p>
          <p className="text-sm">
            Managers, org admins, org owners, or super admins can make changes. Contact your
            workspace admin to request access.
          </p>
        </div>
      ) : null}

      {canManage ? (
        <section className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900/5 p-3 text-indigo-600 dark:bg-white/5 dark:text-indigo-300">
              <FiUserPlus className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Create a new team
              </h2>
              <p className="text-sm text-slate-500">
                Give the team a memorable name, attach it to a department, and describe what they do.
              </p>
            </div>
          </div>
          <form className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr]" onSubmit={handleCreateSubmit}>
            <div>
              <TextInput
                label="Team name"
                placeholder="Growth, Platform, Customer Care..."
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
                disabled={createTeamMutation.isPending}
                isRequired
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">Department</label>
              <select
                value={createForm.departmentId}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, departmentId: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-700/30"
                disabled={createTeamMutation.isPending}
              >
                <option value="">Select a department</option>
                {data.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <TextArea
                label="Team mission"
                placeholder="What problems does this team own? Where do they focus?"
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                }
                disabled={createTeamMutation.isPending}
                height="130px"
                className="w-full"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={createTeamMutation.isPending}>
                {createTeamMutation.isPending ? "Creating..." : "Save team"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Team list</h2>
          <p className="text-sm text-slate-500">
            View, edit, or delete teams directly from the table.
          </p>
        </div>

        {data.teams.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-slate-500 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
            <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              No teams yet
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {emptyStateIllustrations.map((tip) => (
                <li key={tip}>&middot; {tip}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-white/90 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3 text-center">Members</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.teams.map((team) => {
                  const leadNames = team.leads.slice(0, 2).map((lead) => lead.fullName).join(", ");
                  return (
                    <tr
                      key={team.id}
                      className="border-t border-slate-100 text-slate-700 dark:border-slate-800 dark:text-slate-200"
                    >
                      <td className="px-4 py-4 align-top">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {team.name}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-600 dark:text-slate-300">
                        {team.departmentName}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {team.leads.length ? `${team.leads.length} lead${team.leads.length === 1 ? "" : "s"}` : "No leads"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {leadNames || "Assign a lead"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {team.memberCount}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            theme="white"
                            className="px-3 py-2 text-xs"
                            onClick={() => handleOpenViewModal(team.id)}
                          >
                            <FiEye className="mr-1.5" />
                            View
                          </Button>
                          <Button
                            theme="secondary"
                            className="px-3 py-2 text-xs"
                            onClick={() => handleOpenEditModal(team.id)}
                            disabled={!canManage}
                          >
                            <FiEdit2 className="mr-1.5" />
                            Edit
                          </Button>
                          <Button
                            theme="cancel-secondary"
                            className="px-3 py-2 text-xs"
                            onClick={() => handleOpenDeleteModal(team.id)}
                            disabled={!canManage}
                          >
                            <FiTrash2 className="mr-1.5" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(viewTeamId)}
        setOpen={(open) => {
          if (!open) {
            setViewTeamId(null);
          }
        }}
        title={viewTeam ? `${viewTeam.name} details` : "Team details"}
        doneButtonText=""
        isDoneButton={false}
        isCancelButton
        cancelButtonText="Close"
      >
        {viewTeam ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Department
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {viewTeam.departmentName}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Members
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {viewTeam.memberCount} teammate{viewTeam.memberCount === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Leads
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {viewTeam.leads.length ? `${viewTeam.leads.length} lead${viewTeam.leads.length === 1 ? "" : "s"}` : "No leads"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {viewTeam.description ?? "No description provided."}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Leads
              </p>
              {viewTeam.leads.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {viewTeam.leads.map((lead) => (
                    <MemberPill key={lead.userId} person={lead} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No leads assigned yet.</p>
              )}
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
          <p className="text-sm text-slate-600">Team not found.</p>
        )}
      </Modal>

      <Modal
        open={Boolean(editTeamId)}
        setOpen={(open) => {
          if (!open) {
            handleCloseEditModal();
          }
        }}
        title={editTeam ? `Edit ${editTeam.name}` : "Edit team"}
        doneButtonText={isSavingEdit ? "Saving..." : "Save changes"}
        cancelButtonText="Cancel"
        isCancelButton
        onDoneClick={handleSaveEdit}
      >
        {editDraft ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Team name"
                value={editDraft.name}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev,
                  )
                }
                disabled={!canManage || isSavingEdit}
                className="w-full"
              />
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Department</label>
                <select
                  value={editDraft.departmentId}
                  onChange={(event) =>
                    setEditDraft((prev) =>
                      prev ? { ...prev, departmentId: event.target.value } : prev,
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-700/30"
                  disabled={!canManage || isSavingEdit}
                >
                  <option value="">Select a department</option>
                  {data.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <TextArea
              label="Team mission"
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
              <p className="text-sm font-semibold text-slate-600">Team leads</p>
              <select
                multiple
                size={leadSelectSize}
                value={editDraft.leadUserIds}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          leadUserIds: Array.from(event.target.selectedOptions).map(
                            (option) => option.value,
                          ),
                        }
                      : prev,
                  )
                }
                disabled={!canManage || isSavingEdit}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-700/30"
              >
                {data.employees.map((employee) => {
                  const statusHints = [
                    employee.designation ? `• ${employee.designation}` : null,
                    employee.teamName && employee.teamId !== editDraft.teamId
                      ? `(Currently ${employee.teamName})`
                      : null,
                    employee.isTeamLead ? "(Team Lead)" : null,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <option key={employee.userId} value={employee.userId}>
                      {employee.fullName} {statusHints}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-600">Members</p>
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
                {data.employees.map((employee) => {
                  const placementHint =
                    employee.teamName && employee.teamId !== editDraft.teamId
                      ? `Currently ${employee.teamName}`
                      : employee.teamName
                        ? "Already here"
                        : "Unassigned";
                  const extraHints = [
                    employee.designation ? employee.designation : null,
                    placementHint,
                    employee.isTeamLead ? "Team Lead" : null,
                  ]
                    .filter(Boolean)
                    .join(" • ");
                  return (
                    <option key={employee.userId} value={employee.userId}>
                      {employee.fullName}
                      {extraHints ? ` (${extraHints})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Team not found.</p>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteTeamId)}
        setOpen={(open) => {
          if (!open) {
            handleCloseDeleteModal();
          }
        }}
        title="Delete team?"
        doneButtonText=""
        isDoneButton={false}
        isCancelButton={false}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Delete {deleteTeam?.name ?? "this team"}? Members will be unassigned from this team.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button theme="secondary" onClick={handleCloseDeleteModal} disabled={isDeleting}>
              Cancel
            </Button>
            <Button theme="cancel" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete team"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
