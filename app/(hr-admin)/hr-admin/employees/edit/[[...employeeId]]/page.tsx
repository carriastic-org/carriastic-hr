"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useForm } from "react-hook-form";

import Button from "@/app/components/atoms/buttons/Button";
import ImageInput from "@/app/components/atoms/inputs/ImageInput";
import TextArea from "@/app/components/atoms/inputs/TextArea";
import TextInput from "@/app/components/atoms/inputs/TextInput";
import { EmployeeHeader } from "@/app/components/layouts/EmployeeHeader";
import { trpc } from "@/trpc/client";
import type { HrEmployeeForm } from "@/types/hr-admin";
import { uploadProfileImage } from "@/lib/upload-profile-image";

const employmentTypes = ["Full-time", "Part-time", "Contract", "Intern"] as const;
const workArrangements = ["Remote", "Hybrid", "On-site"] as const;
const departmentOptions = ["Engineering", "Design", "Management"] as const;
const statusOptions = ["Active", "On Leave", "Probation", "Pending"] as const;

type EmploymentTypeOption = (typeof employmentTypes)[number];
type WorkArrangementOption = (typeof workArrangements)[number];
type StatusOption = (typeof statusOptions)[number];

type EmployeeFormValues = {
  fullName: string;
  preferredName: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  department: string;
  employmentType: EmploymentTypeOption;
  workArrangement: WorkArrangementOption | "";
  workLocation: string;
  startDate: string;
  status: StatusOption;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  grossSalary: string;
  incomeTax: string;
};

const defaultValues: EmployeeFormValues = {
  fullName: "",
  preferredName: "",
  email: "",
  phone: "",
  address: "",
  role: "",
  department: "",
  employmentType: employmentTypes[0]!,
  workArrangement: "",
  workLocation: "",
  startDate: "",
  status: statusOptions[0]!,
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelation: "",
  grossSalary: "",
  incomeTax: "",
};

const extractEmployeeId = (pathname: string | null) => {
  if (!pathname) return null;
  const segments = pathname.split("/").filter(Boolean);
  const last = segments.at(-1);
  if (!last || last === "edit") {
    return null;
  }
  return decodeURIComponent(last);
};

const toFormValues = (form: HrEmployeeForm): EmployeeFormValues => ({
  fullName: form.fullName,
  preferredName: form.preferredName ?? "",
  email: form.email,
  phone: form.phone ?? "",
  address: form.address ?? "",
  role: form.role,
  department: form.department ?? "",
  employmentType: employmentTypes.includes(form.employmentType as EmploymentTypeOption)
    ? (form.employmentType as EmploymentTypeOption)
    : employmentTypes[0],
  workArrangement: workArrangements.includes(form.workArrangement as WorkArrangementOption)
    ? (form.workArrangement as WorkArrangementOption)
    : "",
  workLocation: form.workLocation ?? "",
  startDate: form.startDate ? form.startDate.split("T")[0] ?? "" : "",
  status: statusOptions.includes(form.status as typeof statusOptions[number])
    ? (form.status as typeof statusOptions[number])
    : statusOptions[0],
  emergencyName: form.emergencyContact?.name ?? "",
  emergencyPhone: form.emergencyContact?.phone ?? "",
  emergencyRelation: form.emergencyContact?.relation ?? "",
  grossSalary: form.grossSalary.toString(),
  incomeTax: form.incomeTax.toString(),
});

const sanitizePayload = (values: EmployeeFormValues) => {
  const parseAmount = (value: string) => {
    if (!value) return undefined;
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      return undefined;
    }
    return parsed;
  };

  const grossSalary = parseAmount(values.grossSalary);
  const incomeTax = parseAmount(values.incomeTax);

  return {
  fullName: values.fullName.trim(),
  preferredName: values.preferredName.trim() || null,
  email: values.email.trim(),
  phone: values.phone.trim() || null,
  address: values.address.trim() || null,
  role: values.role.trim(),
  department: values.department.trim() || null,
  employmentType: values.employmentType,
  workArrangement: values.workArrangement ? values.workArrangement : null,
  workLocation: values.workLocation.trim() || null,
  startDate: values.startDate || null,
  status: values.status,
  emergencyName: values.emergencyName.trim() || null,
  emergencyPhone: values.emergencyPhone.trim() || null,
  emergencyRelation: values.emergencyRelation.trim() || null,
    ...(typeof grossSalary === "number" ? { grossSalary } : {}),
    ...(typeof incomeTax === "number" ? { incomeTax } : {}),
  };
};

const EmptyState = ({ message }: { message: string }) => (
  <section className="rounded-[32px] border border-dashed border-slate-200 bg-white/95 p-10 text-center shadow-xl shadow-indigo-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-200">
      Employee management
    </p>
    <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
      Nothing to edit yet
    </h1>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
    <Link
      href="/hr-admin/employees"
      className="mt-6 inline-flex items-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
    >
      Back to directory
    </Link>
  </section>
);

export default function EditEmployeePage() {
  const pathname = usePathname();
  const employeeId = useMemo(() => extractEmployeeId(pathname), [pathname]);
  const form = useForm<EmployeeFormValues>({ defaultValues });
  const utils = trpc.useUtils();
  const [photoUrl, setPhotoUrl] = useState("/dp.png");
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [leaveFormValues, setLeaveFormValues] = useState({
    annual: "",
    sick: "",
    casual: "",
    parental: "",
  });
  const [compensationValues, setCompensationValues] = useState({
    grossSalary: "",
    incomeTax: "",
  });
  const [leaveAlert, setLeaveAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [compensationAlert, setCompensationAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const employeeFormQuery = trpc.hrEmployees.form.useQuery(
    { employeeId: employeeId ?? "" },
    { enabled: Boolean(employeeId) },
  );
  const updateMutation = trpc.hrEmployees.update.useMutation();
  const updateLeaveQuotaMutation = trpc.hrEmployees.updateLeaveQuota.useMutation();
  const updateCompensationMutation = trpc.hrEmployees.updateCompensation.useMutation();
  const permissions = employeeFormQuery.data?.permissions;
  const editingDisabled = permissions ? !permissions.canEdit : false;
  const canEditCompensation = permissions?.canEditCompensation ?? false;
  const permissionMessage =
    permissions?.reason ?? "You don’t have permission to edit this employee.";

  useEffect(() => {
    if (employeeFormQuery.data?.form) {
      form.reset(toFormValues(employeeFormQuery.data.form));
      setPhotoUrl(employeeFormQuery.data.form.profilePhotoUrl ?? "/dp.png");
    }
  }, [employeeFormQuery.data?.form, form]);

  useEffect(() => {
    const balances = employeeFormQuery.data?.form.leaveBalances;
    if (balances) {
      setLeaveFormValues({
        annual: balances.annual.toString(),
        sick: balances.sick.toString(),
        casual: balances.casual.toString(),
        parental: balances.parental.toString(),
      });
    }
  }, [employeeFormQuery.data?.form.leaveBalances]);

  useEffect(() => {
    const formData = employeeFormQuery.data?.form;
    if (formData) {
      setCompensationValues({
        grossSalary: formData.grossSalary.toString(),
        incomeTax: formData.incomeTax.toString(),
      });
    }
  }, [employeeFormQuery.data?.form]);

  useEffect(() => {
    if (!leaveAlert) {
      return undefined;
    }
    const timer = window.setTimeout(() => setLeaveAlert(null), 5000);
    return () => window.clearTimeout(timer);
  }, [leaveAlert]);

  useEffect(() => {
    if (!compensationAlert) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCompensationAlert(null), 5000);
    return () => window.clearTimeout(timer);
  }, [compensationAlert]);

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!employeeId) {
      return;
    }
    if (permissions && !permissions.canEdit) {
      setPhotoError("You don’t have permission to update the profile photo.");
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Please choose an image smaller than 5MB.");
      event.target.value = "";
      return;
    }

    setPhotoError(null);
    setIsPhotoUploading(true);
    const previousUrl = photoUrl;
    const previewUrl = URL.createObjectURL(file);
    setPhotoUrl(previewUrl);
    try {
      const url = await uploadProfileImage(file, { employeeId });
      setPhotoUrl(url);
      await Promise.all([
        utils.hrEmployees.profile.invalidate({ employeeId }),
        utils.hrEmployees.form.invalidate({ employeeId }),
      ]);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Failed to upload photo.");
      setPhotoUrl(previousUrl);
    } finally {
      setIsPhotoUploading(false);
      URL.revokeObjectURL(previewUrl);
      event.target.value = "";
    }
  };

  const onSubmit = (values: EmployeeFormValues) => {
    if (!employeeId || (permissions && !permissions.canEdit)) {
      return;
    }
    updateMutation.mutate(
      {
        employeeId,
        ...sanitizePayload(values),
      },
      {
        onSuccess: (data) => {
          form.reset(toFormValues(data.form));
        },
      },
    );
  };

  const handleLeaveValueChange =
    (field: keyof typeof leaveFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      setLeaveFormValues((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
      setLeaveAlert(null);
    };

  const parseLeaveValue = (value: string) => {
    if (!value) {
      return 0;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  };

  const handleLeaveQuotaSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (permissions && !permissions.canEdit) {
      setLeaveAlert({
        type: "error",
        message: permissionMessage,
      });
      return;
    }
    if (!employeeId) {
      setLeaveAlert({
        type: "error",
        message: "Employee not found.",
      });
      return;
    }

    updateLeaveQuotaMutation.mutate(
      {
        employeeId,
        annual: parseLeaveValue(leaveFormValues.annual),
        sick: parseLeaveValue(leaveFormValues.sick),
        casual: parseLeaveValue(leaveFormValues.casual),
        parental: parseLeaveValue(leaveFormValues.parental),
      },
      {
        onSuccess: (data) => {
          setLeaveAlert({
            type: "success",
            message: "Leave quotas updated.",
          });
          setLeaveFormValues({
            annual: data.leaveBalances.annual.toString(),
            sick: data.leaveBalances.sick.toString(),
            casual: data.leaveBalances.casual.toString(),
            parental: data.leaveBalances.parental.toString(),
          });
          void Promise.all([
            utils.hrEmployees.profile.invalidate({ employeeId }),
            utils.hrEmployees.form.invalidate({ employeeId }),
          ]);
        },
        onError: (error) => {
          setLeaveAlert({
            type: "error",
            message: error.message,
          });
        },
      },
    );
  };

  const handleCompensationSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!employeeId) {
      setCompensationAlert({
        type: "error",
        message: "Employee not found.",
      });
      return;
    }

    const parseAmount = (value: string) => {
      if (!value.trim()) {
        return null;
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed) || parsed < 0) {
        return null;
      }
      return parsed;
    };

    const grossSalary = parseAmount(compensationValues.grossSalary);
    const incomeTax = parseAmount(compensationValues.incomeTax);

    if (grossSalary === null || incomeTax === null) {
      setCompensationAlert({
        type: "error",
        message: "Enter valid amounts for both gross salary and income tax.",
      });
      return;
    }

    updateCompensationMutation.mutate(
      {
        employeeId,
        grossSalary,
        incomeTax,
      },
      {
        onSuccess: (data) => {
          setCompensationAlert({
            type: "success",
            message: "Compensation updated.",
          });
          setCompensationValues({
            grossSalary: data.compensation.grossSalary.toString(),
            incomeTax: data.compensation.incomeTax.toString(),
          });
          void utils.hrEmployees.form.invalidate({ employeeId });
          void utils.hrEmployees.dashboard.invalidate();
        },
        onError: (error) => {
          setCompensationAlert({
            type: "error",
            message: error.message,
          });
        },
      },
    );
  };

  if (!employeeId) {
    return <EmptyState message="Pick an employee from the directory to edit their profile." />;
  }

  if (employeeFormQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        Loading employee details...
      </div>
    );
  }

  if (employeeFormQuery.isError || !employeeFormQuery.data?.form) {
    return <EmptyState message="We couldn’t load the employee form. Try opening it from the directory again." />;
  }

  const headerForm = employeeFormQuery.data.form;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <EmployeeHeader/>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/hr-admin/employees/view/${encodeURIComponent(employeeId)}`}
            className="inline-flex items-center rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:text-slate-200"
          >
            View profile
          </Link>
        </div>
        {updateMutation.isSuccess ? (
          <p className="text-xs text-emerald-600">
            Employee record updated.
          </p>
        ) : null}
        {updateMutation.isError ? (
          <p className="text-xs text-rose-500">
            {updateMutation.error.message ?? "Failed to update employee."}
          </p>
        ) : null}
        {permissions && !permissions.canEdit ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-100">
            {permissionMessage}
          </div>
        ) : null}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <fieldset
          disabled={editingDisabled}
          className="space-y-6 disabled:cursor-not-allowed disabled:opacity-60"
        >
        <div className="rounded-[32px] border border-white/60 bg-white/95 p-8 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Personal information
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Keep their core profile details up to date.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ImageInput
                id="employee-profile-photo"
                initialImage={photoUrl}
                isUploading={isPhotoUploading}
                error={photoError}
                onChange={handlePhotoUpload}
              />
              <div className="text-sm text-slate-500 dark:text-slate-400">
                <p className="font-semibold text-slate-900 dark:text-white">Profile photo</p>
                <p>Uploads save immediately · JPG/PNG/WEBP · Max 5 MB</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Full name"
                className="w-full"
                name="fullName"
                register={form.register}
                isRequired
              />
              <TextInput
                label="Preferred name"
                className="w-full"
                name="preferredName"
                register={form.register}
              />
              <TextInput
                label="Email address"
                type="email"
                className="w-full"
                name="email"
                register={form.register}
                isRequired
              />
              <TextInput
                label="Phone number"
                type="tel"
                className="w-full"
                name="phone"
                register={form.register}
              />
              <TextArea
                label="Residential address"
                className="md:col-span-2 w-full"
                height="120px"
                name="address"
                register={form.register}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/60 bg-white/95 p-8 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Employment data
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Update squad, manager, and work arrangements.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Employee ID"
                className="w-full"
                defaultValue={headerForm.employeeCode ?? employeeId}
                readOnly
              />
              <div className="flex flex-col">
                <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
                  Department
                </label>
                <select
                  className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-200/70 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  {...form.register("department")}
                >
                  <option value="">Select department</option>
                  {departmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>
              <TextInput
                label="Role / title"
                className="w-full"
                name="role"
                register={form.register}
                isRequired
              />
              <TextInput
                label="Start date"
                type="date"
                className="w-full"
                name="startDate"
                register={form.register}
              />
              <div className="flex flex-col">
                <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
                  Work location
                </label>
                <select
                  className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-200/70 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  {...form.register("workLocation")}
                >
                  <option value="">Select location</option>
                  <option value="Dhaka HQ">Dhaka HQ</option>
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
                  Employment type
                </label>
                <select
                  className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-200/70 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  {...form.register("employmentType")}
                >
                  {employmentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
                  Work arrangement
                </label>
                <select
                  className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-200/70 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  {...form.register("workArrangement")}
                >
                  <option value="">Select arrangement</option>
                  {workArrangements.map((arrangement) => (
                    <option key={arrangement} value={arrangement}>
                      {arrangement}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="mb-2 text-[16px] font-bold text-text_bold dark:text-slate-200">
                  Status
                </label>
                <select
                  className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-200/70 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  {...form.register("status")}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        </fieldset>

        {/* Compensation section lives outside the disabled fieldset */}
        <div className="rounded-[32px] border border-white/60 bg-white/95 p-8 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Compensation
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Store the fixed payroll values used for each invoice.
              </p>
            </div>
            {permissions?.canEdit ? (
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Gross salary (BDT)"
                  type="number"
                  step="0.01"
                  className="w-full"
                  name="grossSalary"
                  register={form.register}
                  isRequired
                  disabled={editingDisabled || updateMutation.isPending}
                />
                <TextInput
                  label="Income tax (BDT)"
                  type="number"
                  step="0.01"
                  className="w-full"
                  name="incomeTax"
                  register={form.register}
                  isRequired
                  disabled={editingDisabled || updateMutation.isPending}
                />
              </div>
            ) : canEditCompensation ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput
                    label="Gross salary (BDT)"
                    type="number"
                    step="0.01"
                    className="w-full"
                    value={compensationValues.grossSalary}
                    onChange={(event) =>
                      setCompensationValues((prev) => ({
                        ...prev,
                        grossSalary: event.target.value,
                      }))
                    }
                    disabled={updateCompensationMutation.isPending}
                    isRequired
                  />
                  <TextInput
                    label="Income tax (BDT)"
                    type="number"
                    step="0.01"
                    className="w-full"
                    value={compensationValues.incomeTax}
                    onChange={(event) =>
                      setCompensationValues((prev) => ({
                        ...prev,
                        incomeTax: event.target.value,
                      }))
                    }
                    disabled={updateCompensationMutation.isPending}
                    isRequired
                  />
                </div>
                {compensationAlert ? (
                  <p
                    className={`text-sm ${
                      compensationAlert.type === "success" ? "text-emerald-600" : "text-rose-500"
                    }`}
                  >
                    {compensationAlert.message}
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => handleCompensationSubmit()}
                    disabled={updateCompensationMutation.isPending}
                  >
                    {updateCompensationMutation.isPending ? "Saving..." : "Save compensation"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You don’t have permission to update compensation for this employee.
              </p>
            )}
          </div>
        </div>

        <fieldset
          disabled={editingDisabled}
          className="space-y-6 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="rounded-[32px] border border-white/60 bg-white/95 p-8 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Emergency contact
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  HR relies on this for urgent communication.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <TextInput
                  label="Name"
                  className="w-full"
                  name="emergencyName"
                  register={form.register}
                />
                <TextInput
                  label="Phone"
                  type="tel"
                  className="w-full"
                  name="emergencyPhone"
                  register={form.register}
                />
                <TextInput
                  label="Relation"
                  className="w-full"
                  name="emergencyRelation"
                  register={form.register}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Link
              href={`/hr-admin/employees/view/${encodeURIComponent(employeeId)}`}
              className="inline-flex items-center rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:text-slate-200"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              disabled={editingDisabled || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </fieldset>
      </form>

      <section className="rounded-[32px] border border-white/60 bg-white/95 p-8 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Leave quotas
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Adjust the available leave balance for this employee. Changes apply immediately.
            </p>
          </div>
          <form onSubmit={handleLeaveQuotaSubmit}>
            <fieldset
              disabled={editingDisabled}
              className="space-y-6 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <TextInput
                  label="Annual leave (days)"
                  className="w-full"
                  type="number"
                  name="leaveAnnual"
                  value={leaveFormValues.annual}
                  onChange={handleLeaveValueChange("annual")}
                  placeholder="0"
                />
                <TextInput
                  label="Sick leave (days)"
                  className="w-full"
                  type="number"
                  name="leaveSick"
                  value={leaveFormValues.sick}
                  onChange={handleLeaveValueChange("sick")}
                  placeholder="0"
                />
                <TextInput
                  label="Casual leave (days)"
                  className="w-full"
                  type="number"
                  name="leaveCasual"
                  value={leaveFormValues.casual}
                  onChange={handleLeaveValueChange("casual")}
                  placeholder="0"
                />
                <TextInput
                  label="Parental leave (days)"
                  className="w-full"
                  type="number"
                  name="leaveParental"
                  value={leaveFormValues.parental}
                  onChange={handleLeaveValueChange("parental")}
                  placeholder="0"
                />
              </div>
              {leaveAlert ? (
                <p
                  className={`text-sm ${
                    leaveAlert.type === "success" ? "text-emerald-600" : "text-rose-500"
                  }`}
                >
                  {leaveAlert.message}
                </p>
              ) : null}
              <div className="flex justify-end">
                <Button type="submit" disabled={editingDisabled || updateLeaveQuotaMutation.isPending}>
                  {updateLeaveQuotaMutation.isPending ? "Updating..." : "Update leave quotas"}
                </Button>
              </div>
            </fieldset>
          </form>
        </div>
      </section>
    </div>
  );
}
