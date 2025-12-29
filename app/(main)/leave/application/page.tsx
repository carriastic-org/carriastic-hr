"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Button from "../../../components/atoms/buttons/Button";
import Text from "../../../components/atoms/Text/Text";
import TextFeild from "../../../components/atoms/TextFeild/TextFeild";
import RadioGroup from "../../../components/atoms/inputs/RadioGroup";
import TextArea from "../../../components/atoms/inputs/TextArea";
import CustomDatePicker from "../../../components/atoms/inputs/DatePicker";
import { EmployeeHeader } from "../../../components/layouts/EmployeeHeader";
import ApplicationPreview from "../../../components/Preview";
import {
  leaveTypeOptionMap,
  leaveTypeOptions,
  leaveTypeValues,
  type LeaveTypeValue,
} from "@/lib/leave-types";
import { trpc } from "@/trpc/client";
import { Card } from "@/app/components/atoms/frame/Card";

const leaveApplicationSchema = z
  .object({
    leaveType: z.enum(leaveTypeValues, {
      errorMap: () => ({ message: "Please select a leave type" }),
    }),
    reason: z
      .string()
      .min(10, { message: "Please describe your leave in at least 10 characters." }),
    note: z
      .string()
      .max(2000, { message: "Notes must be under 2000 characters." })
      .optional()
      .or(z.literal("")),
    startDate: z.date({ required_error: "Start date is required" }),
    endDate: z.date({ required_error: "End date is required" }),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

type FormData = z.infer<typeof leaveApplicationSchema>;

type UploadedAttachment = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string;
  downloadUrl: string;
  uploadedAt: string;
};

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

const helperSteps = [
  "Fill in the leave window and reason with clear context for approvers.",
  "Attach supporting documents (medical slips, approvals) if needed.",
  "Preview the generated letter and export it as PDF for your records.",
];

const calculateInclusiveDays = (start?: Date | string | null, end?: Date | string | null) => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }
  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(0, 0, 0, 0);
  const diffMs = normalizedEnd.getTime() - normalizedStart.getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.floor(diffMs / dayMs) + 1;
};

const formatFileSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return "—";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
};

export default function LeaveApplicationPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const leaveMutation = trpc.leave.submitApplication.useMutation();
  const summaryQuery = trpc.leave.summary.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const {
    data: profileData,
    isLoading: isProfileLoading,
    error: profileError,
  } = trpc.user.profile.useQuery();

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-GB");

  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentRequirementError, setAttachmentRequirementError] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [formMessage, setFormMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [userData, setUserData] = useState({
    name: "",
    email: "",
    phone: "",
    employeeId: "",
    department: "",
    designation: "",
    leaveType: "",
    reason: "",
    note: "",
    from: "",
    to: "",
    date: formattedDate,
    organization: profileData?.organizationName || "",
  });

  useEffect(() => {
    if (!profileData) return;

    const preferredName = profileData.profile?.preferredName;
    const nameFromProfile = [profileData.profile?.firstName, profileData.profile?.lastName]
      .filter(Boolean)
      .join(" ");
    const fullName = preferredName ?? nameFromProfile ?? profileData.email ?? "";

    setUserData((prev) => ({
      ...prev,
      name: fullName || prev.name,
      email: profileData.profile?.workEmail ?? profileData.email ?? prev.email,
      phone:
        profileData.profile?.workPhone ??
        profileData.profile?.personalPhone ??
        profileData.phone ??
        prev.phone,
      employeeId: profileData.employment?.employeeCode ?? prev.employeeId,
      department:
        profileData.employment?.departmentName ??
        profileData.employment?.teamName ??
        prev.department,
      designation: profileData.employment?.designation ?? prev.designation,
    }));
  }, [profileData]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(leaveApplicationSchema),
    defaultValues: {
      leaveType: leaveTypeOptions[0]?.value,
      reason: "",
      note: "",
      startDate: new Date(),
      endDate: new Date(),
    },
  });

  const valueOrFallback = (value?: string | null) => {
    if (value && value.trim().length > 0) return value;
    return isProfileLoading ? "Loading..." : "—";
  };

  const highlightCards = [
    {
      label: "Department",
      value: valueOrFallback(userData.department),
      description: valueOrFallback(userData.designation),
    },
    {
      label: "Employee ID",
      value: valueOrFallback(userData.employeeId),
      description: "Linked to your HR profile",
    },
    {
      label: "Application Date",
      value: userData.date,
      description: "Captured automatically",
    },
  ];

  const profileFields = [
    { label: "Applicant Name", value: valueOrFallback(userData.name) },
    { label: "Department", value: valueOrFallback(userData.department) },
    { label: "Employee ID", value: valueOrFallback(userData.employeeId) },
    { label: "Designation", value: valueOrFallback(userData.designation) },
  ];

  const selectedLeaveType = watch("leaveType");
  const startDateValue = watch("startDate");
  const endDateValue = watch("endDate");
  const leaveBalances = summaryQuery.data?.balances ?? [];
  const selectedOption =
    leaveTypeOptionMap[selectedLeaveType as LeaveTypeValue] ??
    leaveTypeOptions[0];
  const selectedBalance = leaveBalances.find(
    (entry) => (entry.type as LeaveTypeValue) === selectedLeaveType,
  );
  const requestedDays = calculateInclusiveDays(startDateValue, endDateValue);
  const hasNoBalance = selectedBalance ? selectedBalance.remaining <= 0 : false;
  const exceedsBalance = selectedBalance
    ? requestedDays > selectedBalance.remaining
    : false;
  const quotaBlocked = hasNoBalance || exceedsBalance;
  const requestIsValid = requestedDays > 0;
  const requiresMedicalAttachment = selectedLeaveType === "SICK";
  const missingRequiredAttachment = requiresMedicalAttachment && attachments.length === 0;
  const submitDisabled =
    leaveMutation.isPending ||
    isFormSubmitted ||
    quotaBlocked ||
    !requestIsValid ||
    summaryQuery.isLoading ||
    pendingUploads > 0 ||
    missingRequiredAttachment;

  useEffect(() => {
    if (requiresMedicalAttachment && attachments.length === 0) {
      setAttachmentRequirementError("Sick leave requests must include at least one supporting document.");
    } else {
      setAttachmentRequirementError(null);
    }
  }, [requiresMedicalAttachment, attachments.length]);
  const quotaMessage = summaryQuery.isLoading
    ? "Checking available days..."
    : summaryQuery.error
      ? "Unable to load your leave balance right now."
      : !selectedBalance
        ? "Balance data unavailable. Please refresh."
        : hasNoBalance
          ? `You have no ${selectedOption?.shortLabel ?? "selected"} leave remaining.`
          : exceedsBalance
            ? `Request spans ${requestedDays} day${
                requestedDays === 1 ? "" : "s"
              }, but only ${selectedBalance.remaining} day${
                selectedBalance.remaining === 1 ? "" : "s"
              } remain.`
            : `You have ${selectedBalance.remaining} day${
                selectedBalance.remaining === 1 ? "" : "s"
              } available.`;

  const uploadLeaveAttachment = async (file: File): Promise<UploadedAttachment> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/leave/attachments", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      attachment?: UploadedAttachment;
      message?: string;
    };

    if (!response.ok || !payload.attachment) {
      throw new Error(payload?.message || "Unable to upload the attachment.");
    }

    return payload.attachment;
  };

  const deleteLeaveAttachment = async (storageKey: string) => {
    await fetch("/api/leave/attachments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: storageKey }),
    }).catch(() => {
      // Deletion failures are non-blocking; orphan files can be cleaned up separately.
    });
  };

  const handleAttachmentChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const availableSlots = MAX_ATTACHMENTS - attachments.length - pendingUploads;
    if (availableSlots <= 0) {
      setAttachmentError(`You can attach up to ${MAX_ATTACHMENTS} files.`);
      event.target.value = "";
      return;
    }

    const filesToProcess = files.slice(0, availableSlots);

    for (const file of filesToProcess) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setAttachmentError("Attachments must be smaller than 5 MB.");
        continue;
      }

      setPendingUploads((prev) => prev + 1);
      try {
        const uploaded = await uploadLeaveAttachment(file);
        setAttachments((prev) => [...prev, uploaded]);
        setAttachmentError(null);
      } catch (error) {
        setAttachmentError(
          error instanceof Error ? error.message : "Failed to upload the attachment.",
        );
      } finally {
        setPendingUploads((prev) => Math.max(0, prev - 1));
      }
    }

    event.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const next = prev.filter((attachment) => attachment.id !== id);
      const removed = prev.find((attachment) => attachment.id === id);
      if (removed) {
        void deleteLeaveAttachment(removed.storageKey);
      }
      return next;
    });
  };

  const onSubmit = async (data: FormData) => {
    setFormMessage(null);

    const requestedType = data.leaveType as LeaveTypeValue;
    const targetBalance = leaveBalances.find(
      (entry) => (entry.type as LeaveTypeValue) === requestedType,
    );
    const totalRequestedDays = calculateInclusiveDays(data.startDate, data.endDate);
    const leaveLabel =
      leaveTypeOptionMap[requestedType]?.shortLabel ?? data.leaveType;

    if (summaryQuery.isLoading) {
      setFormMessage({
        type: "error",
        text: "Please wait while we confirm your available leave balance.",
      });
      return;
    }

    if (!targetBalance) {
      setFormMessage({
        type: "error",
        text: "We could not determine your remaining leave. Refresh and try again.",
      });
      return;
    }

    if (targetBalance.remaining <= 0) {
      setFormMessage({
        type: "error",
        text: `You currently have no ${leaveLabel} days remaining.`,
      });
      return;
    }

    if (totalRequestedDays > targetBalance.remaining) {
      setFormMessage({
        type: "error",
        text: `This request covers ${totalRequestedDays} day${
          totalRequestedDays === 1 ? "" : "s"
        }, but you only have ${targetBalance.remaining} day${
          targetBalance.remaining === 1 ? "" : "s"
        } available.`,
      });
      return;
    }

    if (pendingUploads > 0) {
      setAttachmentError("Please wait while your attachments finish uploading.");
      return;
    }

    if (missingRequiredAttachment) {
      setAttachmentRequirementError("Supporting documentation is required for sick leave.");
      return;
    }

    try {
      await leaveMutation.mutateAsync({
        leaveType: requestedType,
        reason: data.reason,
        note: data.note || undefined,
        startDate: data.startDate,
        endDate: data.endDate,
        attachments: attachments.length
          ? attachments.map((attachment) => ({
              id: attachment.id,
              name: attachment.name,
              type: attachment.mimeType ?? undefined,
              size: attachment.sizeBytes ?? undefined,
              storageKey: attachment.storageKey,
            }))
          : undefined,
      });

      const leaveMeta = leaveTypeOptionMap[data.leaveType as LeaveTypeValue];

      setUserData((prev) => ({
        ...prev,
        leaveType: leaveMeta?.label ?? data.leaveType,
        reason: data.reason,
        note: data.note ?? "",
        from: data.startDate.toLocaleDateString("en-GB"),
        to: data.endDate.toLocaleDateString("en-GB"),
        date: new Date().toLocaleDateString("en-GB"),
      }));
      setIsFormSubmitted(true);
      setFormMessage({
        type: "success",
        text: "Leave application submitted successfully. Redirecting you to history...",
      });
      await utils.leave.summary.invalidate();
      setTimeout(() => {
        router.push("/leave");
      }, 1500);
    } catch (error) {
      setFormMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to submit the application right now.",
      });
      setIsFormSubmitted(false);
    }
  };

  const generatePDF = async () => {
    if (typeof window === "undefined" || !isFormSubmitted) return;

    const element = document.getElementById("application-preview");
    if (element) {
      const applicantName = userData.name.replace(/\s+/g, "_").toLowerCase();
      const date = userData.date.replace(/\//g, "-");
      const fileName = `leave-application_${applicantName}-${date}.pdf`;

      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default ?? html2pdfModule;

      html2pdf().from(element).save(fileName);
    }
  };

  return (
    <div>
      <div className="space-y-6">
        <EmployeeHeader
          hasRightButton
          buttonText="Leave History"
          onButtonClick={() => router.push("/leave")}
        />

        {profileError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-100">
            Unable to load your employee profile right now. {profileError.message}
          </div>
        )}

        <Card>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
              Leave application
            </p>
            <Text
              text="Submit a clear request"
              className="text-2xl font-semibold text-slate-900 transition-colors duration-200 dark:text-slate-100 md:text-3xl"
            />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Describe your leave window, attach supporting files, and get a PDF-ready
              application instantly.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {highlightCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {card.value}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{card.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                  Selected leave balance
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedOption?.label ?? "Leave type"}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {quotaMessage}
                </p>
              </div>
              <span
                className={`rounded-full px-4 py-1 text-xs font-semibold ${
                  quotaBlocked
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-100"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
                }`}
              >
                {quotaBlocked ? "Action needed" : "Good to apply"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Requested duration: {requestedDays} day{requestedDays === 1 ? "" : "s"}.
              {exceedsBalance && " Reduce the window or pick another type."}
            </p>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6 rounded-3xl border border-slate-100 bg-slate-50/70 p-6 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70">
              <div className="space-y-2">
                <Text
                  text="Applicant snapshot"
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Pulled directly from your employee profile. Update there if something
                  looks off.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {profileFields.map((field) => (
                  <TextFeild
                    key={field.label}
                    label={field.label}
                    text={field.value}
                    textFontSize="16px"
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70"
                  />
                ))}
              </div>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-700" />
              <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
                <Controller
                  name="leaveType"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      name="leaveType"
                      title="Leave Type"
                      options={leaveTypeOptions.map((option) => ({
                        label: option.label,
                        value: option.value,
                      }))}
                      selectedValue={field.value}
                      onChange={(value) => field.onChange(value)}
                      isRequired
                      error={errors.leaveType}
                      className="col-span-2 rounded-2xl border border-dashed border-slate-200 bg-white p-4 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70"
                    />
                  )}
                />
                <TextArea
                  className="col-span-2"
                  label="Reason"
                  isRequired
                  placeholder="Explain why you need this leave"
                  register={register}
                  name="reason"
                  error={errors.reason}
                  height="120px"
                />
                <TextArea
                  className="col-span-2"
                  label="Additional note"
                  placeholder="Optional context for HR or your manager"
                  register={register}
                  name="note"
                  error={errors.note}
                  height="100px"
                />
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field }) => (
                    <CustomDatePicker
                      {...field}
                      label="From"
                      isRequired
                      error={errors.startDate}
                      placeholder="Select start date"
                      value={field.value}
                      onChange={(date) => field.onChange(date ?? field.value)}
                      className="col-span-2 md:col-span-1"
                    />
                  )}
                />
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                    <CustomDatePicker
                      {...field}
                      label="To"
                      isRequired
                      error={errors.endDate}
                      placeholder="Select end date"
                      value={field.value}
                      onChange={(date) => field.onChange(date ?? field.value)}
                      className="col-span-2 md:col-span-1"
                    />
                  )}
                />

                <div className="col-span-2 space-y-3 rounded-2xl border border-dashed border-slate-200 bg-white p-4 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Attachments{" "}
                        {requiresMedicalAttachment ? "(required for sick leave)" : "(optional)"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Upload PDFs or images. Max {MAX_ATTACHMENTS} files, 5 MB each. Files are
                        stored securely in R2.
                      </p>
                    </div>
                    <label className="cursor-pointer rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-600 transition-colors duration-200 hover:border-primary_dark/40 hover:text-primary_dark dark:border-slate-600 dark:text-slate-200 dark:hover:border-sky-500/60 dark:hover:text-sky-300">
                      Browse
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                        multiple
                        onChange={handleAttachmentChange}
                      />
                    </label>
                  </div>
                  {attachmentError && (
                    <p className="text-xs text-rose-500 dark:text-rose-300">{attachmentError}</p>
                  )}
                  {attachmentRequirementError && (
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      {attachmentRequirementError}
                    </p>
                  )}
                  {pendingUploads > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Uploading {pendingUploads} file{pendingUploads === 1 ? "" : "s"} to secure
                      storage...
                    </p>
                  )}
                  {attachments.length > 0 && (
                    <ul className="space-y-2">
                      {attachments.map((attachment) => (
                        <li
                          key={attachment.id}
                          className="flex flex-col gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 transition-colors duration-200 dark:bg-slate-900/70 dark:text-slate-300 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {attachment.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {formatFileSize(attachment.sizeBytes)}
                            </p>
                            {attachment.downloadUrl ? (
                              <a
                                href={attachment.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-primary_dark underline-offset-4 hover:underline dark:text-sky-300"
                              >
                                Open secure copy
                              </a>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="text-xs font-semibold text-rose-500 transition-colors duration-150 hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-200"
                            onClick={() => removeAttachment(attachment.id)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {formMessage && (
                  <div
                    className={`col-span-2 rounded-xl border px-4 py-3 text-sm ${
                      formMessage.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                        : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
                    }`}
                  >
                    {formMessage.text}
                  </div>
                )}

                <div className="col-span-2 flex flex-wrap justify-end gap-3 pt-2">
                  <Button
                    type="submit"
                    theme="aqua"
                    className="w-full sm:w-auto"
                    disabled={submitDisabled}
                  >
                    <Text
                      text={
                        isFormSubmitted
                          ? "Redirecting..."
                          : leaveMutation.isPending
                            ? "Submitting..."
                            : quotaBlocked
                              ? "Adjust request to submit"
                              : "Submit application"
                      }
                      className="text-[15px] font-semibold"
                    />
                  </Button>
                  <Button
                    theme="secondary"
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => router.push("/leave")}
                  >
                    <Text text="Cancel" className="text-[15px] font-semibold" />
                  </Button>
                </div>
              </form>
            </div>

            <aside className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-slate-900/60">
              {isFormSubmitted ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <Text
                        text="Preview & export"
                        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                      />
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Review the generated document before pushing it to HR.
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
                      Ready
                    </span>
                  </div>
                  <div
                    id="application-preview"
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70"
                  >
                    <ApplicationPreview
                      userData={userData}
                      attachments={attachments.map((attachment) => ({
                        id: attachment.id,
                        name: attachment.name,
                        downloadUrl: attachment.downloadUrl,
                      }))}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      theme="aqua"
                      className="flex-1 min-w-[160px]"
                      onClick={generatePDF}
                      type="button"
                    >
                      <Text text="Download PDF" className="text-[15px] font-semibold" />
                    </Button>
                    <Button
                      theme="secondary"
                      className="flex-1 min-w-[160px]"
                      onClick={() => {
                        setIsFormSubmitted(false);
                        setFormMessage(null);
                      }}
                      type="button"
                    >
                      <Text text="Edit details" className="text-[15px] font-semibold" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Text
                      text="Keep it approvable"
                      className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      A short checklist to hand approvers everything they need.
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {helperSteps.map((step) => (
                      <li
                        key={step}
                        className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70"
                      >
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary_dark dark:bg-sky-400" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">{step}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 transition-colors duration-200 dark:border-slate-700/60 dark:text-slate-400">
                    Need support? Ping {" "}
                    <a
                      href="mailto:hr@ndi.hr"
                      className="font-semibold text-primary_dark dark:text-sky-400"
                    >
                      hr@ndi.hr
                    </a>{" "}
                    or talk to your manager before submitting.
                  </div>
                </>
              )}
            </aside>
          </div>
        </Card>
      </div>
    </div>
  );
}
