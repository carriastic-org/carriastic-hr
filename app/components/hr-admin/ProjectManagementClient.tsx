"use client";

import { useEffect, useMemo, useState } from "react";
import { ProjectStatus } from "@prisma/client";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFolder,
  FiPlusCircle,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";

import Button from "@/app/components/atoms/buttons/Button";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import TextArea from "@/app/components/atoms/inputs/TextArea";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import type { HrProjectMember, HrProjectSummary } from "@/types/hr-project";
import { trpc } from "@/trpc/client";

type AlertState = { type: "success" | "error"; message: string } | null;

type ProjectFormState = {
  name: string;
  code: string;
  clientName: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  projectManagerId: string;
  memberUserIds: string[];
};

const defaultCreateForm: ProjectFormState = {
  name: "",
  code: "",
  clientName: "",
  description: "",
  status: ProjectStatus.ACTIVE,
  startDate: "",
  endDate: "",
  projectManagerId: "",
  memberUserIds: [],
};

const statusLabels: Record<ProjectStatus, string> = {
  [ProjectStatus.ACTIVE]: "Active",
  [ProjectStatus.ON_HOLD]: "On Hold",
  [ProjectStatus.COMPLETED]: "Completed",
  [ProjectStatus.ARCHIVED]: "Archived",
};

const statusClasses: Record<ProjectStatus, string> = {
  [ProjectStatus.ACTIVE]: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-100",
  [ProjectStatus.ON_HOLD]: "bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-100",
  [ProjectStatus.COMPLETED]: "bg-slate-200 text-slate-800 dark:bg-slate-500/20 dark:text-slate-100",
  [ProjectStatus.ARCHIVED]: "bg-slate-300 text-slate-700 dark:bg-slate-600/30 dark:text-slate-200",
};

const projectStatusOptions = Object.values(ProjectStatus);

const AlertBanner = ({ alert }: { alert: AlertState }) => {
  if (!alert) return null;
  const Icon = alert.type === "success" ? FiCheckCircle : FiAlertCircle;
  const classes =
    alert.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${classes}`}>
      <Icon className="text-base" />
      <p className="font-semibold">{alert.message}</p>
    </div>
  );
};

const formatDateInput = (value?: string | null) => (value ? value.slice(0, 10) : "");

const ProjectMemberPill = ({ member }: { member: HrProjectMember }) => (
  <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2 text-left shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{member.fullName}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400">
      {member.designation ?? member.email ?? "Role pending"}
    </p>
  </div>
);

export default function ProjectManagementClient() {
  const utils = trpc.useUtils();
  const overviewQuery = trpc.hrProject.overview.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const createProjectMutation = trpc.hrProject.createProject.useMutation();
  const updateProjectMutation = trpc.hrProject.updateProject.useMutation();
  const deleteProjectMutation = trpc.hrProject.deleteProject.useMutation();

  const [createForm, setCreateForm] = useState<ProjectFormState>(defaultCreateForm);
  const [alert, setAlert] = useState<AlertState>(null);
  const [drafts, setDrafts] = useState<Record<string, ProjectFormState>>({});
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), 5000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  const data = overviewQuery.data;
  const employees = data?.employees ?? [];

  const memberSelectSize = useMemo(() => {
    const total = employees.length;
    return Math.min(12, Math.max(4, total || 6));
  }, [employees.length]);

  const baseDrafts = useMemo(() => {
    if (!data?.projects) {
      return {};
    }
    return data.projects.reduce<Record<string, ProjectFormState>>((acc, project) => {
      acc[project.id] = {
        name: project.name,
        code: project.code ?? "",
        clientName: project.clientName ?? "",
        description: project.description ?? "",
        status: project.status,
        startDate: formatDateInput(project.startDateIso),
        endDate: formatDateInput(project.endDateIso),
        projectManagerId: project.projectManagerId ?? "",
        memberUserIds: project.memberUserIds ?? [],
      };
      return acc;
    }, {});
  }, [data]);

  const getDraftForProject = (project: HrProjectSummary): ProjectFormState =>
    drafts[project.id] ?? baseDrafts[project.id] ?? {
      name: project.name,
      code: project.code ?? "",
      clientName: project.clientName ?? "",
      description: project.description ?? "",
      status: project.status,
      startDate: formatDateInput(project.startDateIso),
      endDate: formatDateInput(project.endDateIso),
      projectManagerId: project.projectManagerId ?? "",
      memberUserIds: project.memberUserIds ?? [],
    };

  const setProjectDraft = (projectId: string, updater: (prev: ProjectFormState) => ProjectFormState) => {
    setDrafts((prev) => {
      const current = prev[projectId] ?? baseDrafts[projectId];
      const next = updater(
        current ?? {
          ...defaultCreateForm,
        },
      );
      return {
        ...prev,
        [projectId]: next,
      };
    });
  };

  const handleCreateMembersChange = (options: HTMLCollectionOf<HTMLOptionElement>) => {
    const selected = Array.from(options).map((option) => option.value);
    setCreateForm((prev) => ({ ...prev, memberUserIds: selected }));
  };

  const handleProjectMembersChange = (projectId: string, options: HTMLCollectionOf<HTMLOptionElement>) => {
    const selected = Array.from(options).map((option) => option.value);
    setProjectDraft(projectId, (prev) => ({ ...prev, memberUserIds: selected }));
  };

  const handleCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.name.trim()) {
      setAlert({ type: "error", message: "Give the project a name before saving." });
      return;
    }

    createProjectMutation.mutate(
      {
        name: createForm.name.trim(),
        code: createForm.code.trim() ? createForm.code.trim() : null,
        clientName: createForm.clientName.trim() ? createForm.clientName.trim() : null,
        description: createForm.description.trim() ? createForm.description.trim() : null,
        status: createForm.status,
        startDate: createForm.startDate || null,
        endDate: createForm.endDate || null,
        projectManagerId: createForm.projectManagerId || null,
        memberUserIds: Array.from(new Set(createForm.memberUserIds)),
      },
      {
        onSuccess: () => {
          setCreateForm(defaultCreateForm);
          setAlert({ type: "success", message: "Project created successfully." });
          void utils.hrProject.overview.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
      },
    );
  };

  const handleSaveProject = (project: HrProjectSummary) => {
    const draft = getDraftForProject(project);
    if (!draft.name.trim()) {
      setAlert({ type: "error", message: "Project name can’t be empty." });
      return;
    }
    setPendingProjectId(project.id);
    updateProjectMutation.mutate(
      {
        projectId: project.id,
        name: draft.name.trim(),
        code: draft.code.trim() ? draft.code.trim() : null,
        clientName: draft.clientName.trim() ? draft.clientName.trim() : null,
        description: draft.description.trim() ? draft.description.trim() : null,
        status: draft.status,
        startDate: draft.startDate || null,
        endDate: draft.endDate || null,
        projectManagerId: draft.projectManagerId || null,
        memberUserIds: Array.from(new Set(draft.memberUserIds)),
      },
      {
        onSuccess: () => {
          setAlert({ type: "success", message: "Project updated successfully." });
          setDrafts((prev) => {
            const next = { ...prev };
            delete next[project.id];
            return next;
          });
          void utils.hrProject.overview.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
        onSettled: () => setPendingProjectId(null),
      },
    );
  };

  const handleDeleteProject = (project: HrProjectSummary) => {
    if (
      !window.confirm(
        `Delete ${project.name}? Members will be unassigned from this project. This action cannot be undone.`,
      )
    ) {
      return;
    }
    setPendingDeleteId(project.id);
    deleteProjectMutation.mutate(
      { projectId: project.id },
      {
        onSuccess: () => {
          setAlert({ type: "success", message: "Project deleted." });
          void utils.hrProject.overview.invalidate();
        },
        onError: (error) => setAlert({ type: "error", message: error.message }),
        onSettled: () => setPendingDeleteId(null),
      },
    );
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner label="Loading project overview..." />
      </div>
    );
  }

  if (overviewQuery.error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="text-lg font-semibold">Unable to load projects</p>
        <p className="text-sm">{overviewQuery.error.message}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="inline-flex items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
          <FiFolder />
          Delivery Programs
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Project Management</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Track active programs, assign managers, and keep staffing aligned on every in-flight initiative.
          </p>
        </div>
      </header>

      <AlertBanner alert={alert} />

      <section className="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
              <FiPlusCircle className="text-2xl" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                New project
              </p>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Create an initiative</h2>
              <p className="text-sm text-slate-500">
                Capture dates, client context, manager, and members to kickstart tracking.
              </p>
            </div>
          </div>
        </div>
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleCreateSubmit}>
          <TextInput
            label="Project name"
            placeholder="HR Platform rollout"
            value={createForm.name}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
            disabled={createProjectMutation.isPending}
            isRequired
          />
          <TextInput
            label="Project code"
            placeholder="HR-2024-NOV"
            value={createForm.code}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))}
            disabled={createProjectMutation.isPending}
          />
          <TextInput
            label="Client / stakeholder"
            placeholder="Internal, Acme Corp, etc."
            value={createForm.clientName}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, clientName: event.target.value }))
            }
            disabled={createProjectMutation.isPending}
          />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-200">
              Project manager
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={createForm.projectManagerId}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, projectManagerId: event.target.value }))
              }
              disabled={createProjectMutation.isPending}
            >
              <option value="">Select a project manager</option>
              {employees.map((employee) => (
                <option key={employee.userId} value={employee.userId}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-200">
              Status
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={createForm.status}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  status: event.target.value as ProjectStatus,
                }))
              }
              disabled={createProjectMutation.isPending}
            >
              {projectStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </div>
          <TextInput
            type="date"
            label="Start date"
            value={createForm.startDate}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, startDate: event.target.value }))}
            disabled={createProjectMutation.isPending}
          />
          <TextInput
            type="date"
            label="Target completion"
            value={createForm.endDate}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, endDate: event.target.value }))}
            disabled={createProjectMutation.isPending}
          />
          <div className="md:col-span-2">
            <TextArea
              label="Objectives / notes"
              placeholder="Why are we building this? Key scope items or milestones..."
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, description: event.target.value }))
              }
              disabled={createProjectMutation.isPending}
              height="120px"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-200">
              Project members
            </label>
            <select
              multiple
              size={memberSelectSize}
              className="h-auto w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={createForm.memberUserIds}
              onChange={(event) => handleCreateMembersChange(event.currentTarget.options)}
              disabled={createProjectMutation.isPending}
            >
              {employees.map((employee) => (
                <option key={employee.userId} value={employee.userId}>
                  {employee.fullName}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Hold Cmd / Ctrl to select multiple teammates.
            </p>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={createProjectMutation.isPending}>
              {createProjectMutation.isPending ? "Creating..." : "Create project"}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-900/5 p-3 text-indigo-600 dark:bg-white/5 dark:text-indigo-200">
            <FiEdit3 className="text-2xl" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Ongoing projects</h2>
            <p className="text-sm text-slate-500">
              Review assignments, adjust managers, update statuses, or archive finished work.
            </p>
          </div>
        </div>

        {data.projects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-slate-500 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">No projects yet</p>
            <p className="mt-1 text-sm">Create your first initiative to start tracking delivery.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {data.projects.map((project) => {
              const draft = getDraftForProject(project);
              const pendingUpdate =
                pendingProjectId === project.id && updateProjectMutation.isPending;
              const pendingDelete =
                pendingDeleteId === project.id && deleteProjectMutation.isPending;
              return (
                <div
                  key={project.id}
                  className="space-y-5 rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Project
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
                          {project.name}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[project.status]}`}
                        >
                          {statusLabels[project.status]}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {project.description ?? "No description yet."}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/5 px-4 py-3 text-right text-slate-900 dark:bg-white/5 dark:text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Members
                      </p>
                      <p className="text-3xl font-semibold">{project.memberCount}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <TextInput
                      label="Project name"
                      value={draft.name}
                      onChange={(event) =>
                        setProjectDraft(project.id, (prev) => ({ ...prev, name: event.target.value }))
                      }
                      disabled={pendingUpdate}
                    />
                    <TextInput
                      label="Project code"
                      value={draft.code}
                      onChange={(event) =>
                        setProjectDraft(project.id, (prev) => ({ ...prev, code: event.target.value }))
                      }
                      disabled={pendingUpdate}
                    />
                    <TextInput
                      label="Client / stakeholder"
                      value={draft.clientName}
                      onChange={(event) =>
                        setProjectDraft(project.id, (prev) => ({
                          ...prev,
                          clientName: event.target.value,
                        }))
                      }
                      disabled={pendingUpdate}
                    />
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-200">
                        Project manager
                      </label>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={draft.projectManagerId}
                        onChange={(event) =>
                          setProjectDraft(project.id, (prev) => ({
                            ...prev,
                            projectManagerId: event.target.value,
                          }))
                        }
                        disabled={pendingUpdate}
                      >
                        <option value="">Select a project manager</option>
                        {employees.map((employee) => (
                          <option key={employee.userId} value={employee.userId}>
                            {employee.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-200">
                        Status
                      </label>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={draft.status}
                        onChange={(event) =>
                          setProjectDraft(project.id, (prev) => ({
                            ...prev,
                            status: event.target.value as ProjectStatus,
                          }))
                        }
                        disabled={pendingUpdate}
                      >
                        {projectStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {statusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <TextInput
                      type="date"
                      label="Start date"
                      value={draft.startDate}
                      onChange={(event) =>
                        setProjectDraft(project.id, (prev) => ({
                          ...prev,
                          startDate: event.target.value,
                        }))
                      }
                      disabled={pendingUpdate}
                    />
                    <TextInput
                      type="date"
                      label="Target completion"
                      value={draft.endDate}
                      onChange={(event) =>
                        setProjectDraft(project.id, (prev) => ({
                          ...prev,
                          endDate: event.target.value,
                        }))
                      }
                      disabled={pendingUpdate}
                    />
                    <div className="md:col-span-2">
                      <TextArea
                        label="Objectives / notes"
                        value={draft.description}
                        onChange={(event) =>
                          setProjectDraft(project.id, (prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                        disabled={pendingUpdate}
                        height="100px"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-200">
                        Members
                      </label>
                      <select
                        multiple
                        size={memberSelectSize}
                        className="h-auto w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={draft.memberUserIds}
                        onChange={(event) =>
                          handleProjectMembersChange(project.id, event.currentTarget.options)
                        }
                        disabled={pendingUpdate}
                      >
                        {employees.map((employee) => (
                          <option key={employee.userId} value={employee.userId}>
                            {employee.fullName}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-slate-500">
                        Hold Cmd / Ctrl to multi-select teammates.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => handleSaveProject(project)}
                      disabled={pendingUpdate}
                      type="button"
                    >
                      {pendingUpdate ? "Saving..." : "Save changes"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(project)}
                      disabled={pendingDelete}
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                    >
                      <FiTrash2 />
                      {pendingDelete ? "Deleting..." : "Delete"}
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 dark:border-slate-700/60 dark:bg-slate-900/70">
                      <div className="mb-3 flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <FiUsers />
                        <p className="text-sm font-semibold">Assignments preview</p>
                      </div>
                      {project.memberPreview.length === 0 ? (
                        <p className="text-sm text-slate-500">No teammates assigned yet.</p>
                      ) : (
                        <div className="grid gap-2">
                          {project.memberPreview.map((member) => (
                            <ProjectMemberPill key={member.userId} member={member} />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 dark:border-slate-700/60 dark:bg-slate-900/70">
                      <div className="mb-3 flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <FiClock />
                        <p className="text-sm font-semibold">Timeline</p>
                      </div>
                      <p className="text-sm text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-100">Start:</span>{" "}
                        {project.startDateIso
                          ? new Date(project.startDateIso).toLocaleDateString()
                          : "Not set"}
                      </p>
                      <p className="text-sm text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-100">Target:</span>{" "}
                        {project.endDateIso
                          ? new Date(project.endDateIso).toLocaleDateString()
                          : "Not set"}
                      </p>
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
