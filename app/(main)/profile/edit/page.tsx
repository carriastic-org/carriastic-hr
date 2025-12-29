"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import Button from "../../../components/atoms/buttons/Button";
import ImageInput from "../../../components/atoms/inputs/ImageInput";
import TextArea from "../../../components/atoms/inputs/TextArea";
import TextInput from "../../../components/atoms/inputs/TextInput";
import { Card } from "../../../components/atoms/frame/Card";
import Text from "../../../components/atoms/Text/Text";
import SelectBox from "../../../components/atoms/selectBox/SelectBox";
import { trpc } from "@/trpc/client";
import { uploadProfileImage } from "@/lib/upload-profile-image";
import type { UserProfileResponse } from "@/server/modules/user/user.service";
import LoadingSpinner from "@/app/components/LoadingSpinner";

const profileFormSchema = z.object({
  profile: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    preferredName: z.string().optional().nullable(),
    gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "UNDISCLOSED"]).optional().nullable(),
    dateOfBirth: z.string().optional().nullable(),
    nationality: z.string().optional().nullable(),
    workModel: z.enum(["ONSITE", "HYBRID", "REMOTE"]).optional().nullable(),
    bio: z.string().optional().nullable(),
    workEmail: z.string().email("Enter a valid work email"),
    personalEmail: z.string().email().optional().nullable(),
    workPhone: z.string().optional().nullable(),
    personalPhone: z.string().optional().nullable(),
    currentAddress: z.string().optional().nullable(),
    permanentAddress: z.string().optional().nullable(),
  }),
  employment: z.object({
    employeeCode: z.string().min(1, "Employee ID is required"),
    designation: z.string().min(1, "Designation is required"),
    departmentName: z.string().optional().nullable(),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]),
    startDate: z.string().optional().nullable(),
    primaryLocation: z.string().optional().nullable(),
  }),
  emergencyContact: z.object({
    name: z.string().min(1, "Contact name is required"),
    relationship: z.string().min(1, "Relationship is required"),
    phone: z.string().min(1, "Phone is required"),
    alternatePhone: z.string().optional().nullable(),
  }),
  bankAccount: z.object({
    bankName: z.string().min(1, "Bank name is required"),
    accountHolder: z.string().min(1, "Account holder is required"),
    accountNumber: z.string().min(1, "Account number is required"),
    branch: z.string().optional().nullable(),
    swiftCode: z.string().optional().nullable(),
    taxId: z.string().optional().nullable(),
  }),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const genderOptions = [
  { label: "Male", value: "MALE" },
  { label: "Female", value: "FEMALE" },
  { label: "Non-binary", value: "NON_BINARY" },
  { label: "Prefer not to say", value: "UNDISCLOSED" },
];

const workModelOptions = [
  { label: "Onsite", value: "ONSITE" },
  { label: "Hybrid", value: "HYBRID" },
  { label: "Remote", value: "REMOTE" },
];

const employmentTypeOptions = [
  { label: "Full Time", value: "FULL_TIME" },
  { label: "Part Time", value: "PART_TIME" },
  { label: "Contract", value: "CONTRACT" },
  { label: "Intern", value: "INTERN" },
];

const getOptionLabel = (options: { label: string; value: string }[], value?: string | null) =>
  options.find((option) => option.value === value)?.label ?? value ?? "";

const helperChecklist = [
  {
    title: "Upload a recent headshot",
    detail: "Boosts trust across the org chart",
  },
  {
    title: "Keep emergency info fresh",
    detail: "HR depends on accurate contacts during travel",
  },
  {
    title: "Share your working pattern",
    detail: "Helps teammates schedule with empathy",
  },
];

const defaultFormValues: ProfileFormData = {
  profile: {
    firstName: "",
    lastName: "",
    preferredName: "",
    gender: "UNDISCLOSED",
    dateOfBirth: "",
    nationality: "",
    workModel: "ONSITE",
    bio: "",
    workEmail: "",
    personalEmail: "",
    workPhone: "",
    personalPhone: "",
    currentAddress: "",
    permanentAddress: "",
  },
  employment: {
    employeeCode: "",
    designation: "",
    departmentName: "",
    employmentType: "FULL_TIME",
    startDate: "",
    primaryLocation: "",
  },
  emergencyContact: {
    name: "",
    relationship: "",
    phone: "",
    alternatePhone: "",
  },
  bankAccount: {
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    branch: "",
    swiftCode: "",
    taxId: "",
  },
};

const formatInputDate = (value?: Date | string | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
};

type MaybeDate = Date | string | null | undefined;

type ProfileData = Omit<UserProfileResponse, "lastLoginAt" | "profile" | "employment"> & {
  lastLoginAt: MaybeDate;
  profile:
    | null
    | (Omit<NonNullable<UserProfileResponse["profile"]>, "dateOfBirth"> & {
        dateOfBirth: MaybeDate;
      });
  employment:
    | null
    | (Omit<NonNullable<UserProfileResponse["employment"]>, "startDate"> & {
        startDate: MaybeDate;
      });
};

function mapProfileToForm(data: ProfileData): ProfileFormData {
  return {
    profile: {
      firstName: data.profile?.firstName ?? "",
      lastName: data.profile?.lastName ?? "",
      preferredName: data.profile?.preferredName ?? "",
      gender: (data.profile?.gender as ProfileFormData["profile"]["gender"]) ?? "UNDISCLOSED",
      dateOfBirth: formatInputDate(data.profile?.dateOfBirth ?? null),
      nationality: data.profile?.nationality ?? "",
      workModel: (data.profile?.workModel as ProfileFormData["profile"]["workModel"]) ?? "ONSITE",
      bio: data.profile?.bio ?? "",
      workEmail: data.profile?.workEmail ?? data.email,
      personalEmail: data.profile?.personalEmail ?? "",
      workPhone: data.profile?.workPhone ?? "",
      personalPhone: data.profile?.personalPhone ?? "",
      currentAddress: data.profile?.currentAddress ?? "",
      permanentAddress: data.profile?.permanentAddress ?? "",
    },
    employment: {
      employeeCode: data.employment?.employeeCode ?? "",
      designation: data.employment?.designation ?? "",
      departmentName: data.employment?.departmentName ?? "",
      employmentType:
        (data.employment?.employmentType as ProfileFormData["employment"]["employmentType"]) ??
        "FULL_TIME",
      startDate: formatInputDate(data.employment?.startDate ?? null),
      primaryLocation: data.employment?.primaryLocation ?? "",
    },
    emergencyContact: {
      name: data.emergencyContact?.name ?? "",
      relationship: data.emergencyContact?.relationship ?? "",
      phone: data.emergencyContact?.phone ?? "",
      alternatePhone: data.emergencyContact?.alternatePhone ?? "",
    },
    bankAccount: {
      bankName: data.bankAccount?.bankName ?? "",
      accountHolder: data.bankAccount?.accountHolder ?? "",
      accountNumber: data.bankAccount?.accountNumber ?? "",
      branch: data.bankAccount?.branch ?? "",
      swiftCode: data.bankAccount?.swiftCode ?? "",
      taxId: data.bankAccount?.taxId ?? "",
    },
  };
}

function EditProfilePage() {
  const router = useRouter();
  const profileQuery = trpc.user.profile.useQuery();
  const utils = trpc.useUtils();
  const updateProfile = trpc.user.updateProfile.useMutation();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("/dp.png");
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (profileQuery.data) {
      reset(mapProfileToForm(profileQuery.data));
      setPhotoUrl(profileQuery.data.profile?.profilePhotoUrl ?? "/dp.png");
    }
  }, [profileQuery.data, reset]);

  const workModelLabel = useMemo(
    () => getOptionLabel(workModelOptions, profileQuery.data?.profile?.workModel ?? null),
    [profileQuery.data?.profile?.workModel],
  );
  const employmentTypeLabel = useMemo(
    () => getOptionLabel(employmentTypeOptions, profileQuery.data?.employment?.employmentType ?? null),
    [profileQuery.data?.employment?.employmentType],
  );

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
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
      const url = await uploadProfileImage(file);
      setPhotoUrl(url);
      await utils.user.profile.invalidate();
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Failed to upload photo.");
      setPhotoUrl(previousUrl);
    } finally {
      setIsPhotoUploading(false);
      URL.revokeObjectURL(previewUrl);
      event.target.value = "";
    }
  };

  const onSubmit = (values: ProfileFormData) => {
    setServerMessage(null);
    setServerError(null);
    updateProfile.mutate(values, {
      onSuccess: () => {
        setServerMessage("Profile updated successfully.");
        router.push("/profile");
      },
      onError: (error) => {
        setServerError(error.message || "Unable to update profile.");
      },
    });
  };

  const checklistCards = useMemo(
    () =>
      helperChecklist.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/60"
        >
          <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{item.detail}</p>
        </div>
      )),
    [],
  );

  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <LoadingSpinner label="Loading profile..." helper="Fetching your profile..."/>
      </div>
    );
  }

  if (profileQuery.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-slate-500">We couldn&apos;t load your profile right now.</p>
        <Button onClick={() => profileQuery.refetch()}>
          <Text text="Retry" className="font-semibold" />
        </Button>
      </div>
    );
  }

  if (!profileQuery.data) {
    return null;
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit(onSubmit)}>
      <div className="glass-panel items-center justify-between gap-4 text-slate-600 transition-colors duration-200 dark:text-slate-300 md:flex-row">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
            Profile centre
          </p>
          <Text
            text="Keep your profile current and actionable."
            className="text-xl font-semibold text-slate-900 dark:text-slate-100"
          />
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            The more context you share, the easier it is for HR and your squad to support you.
          </p>
        </div>
        <Button theme="secondary" type="button" onClick={() => router.push("/profile")}>
          View Public Profile
        </Button>
      </div>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Personal Basics" isTransparentBackground>
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <ImageInput
                id="profilePic"
                initialImage={photoUrl}
                isUploading={isPhotoUploading}
                error={photoError}
                onChange={handlePhotoUpload}
              />
              <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Profile photo</p>
                <p>JPG or PNG · Max 5 MB · Square crop recommended.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="First Name"
                register={register}
                name="profile.firstName"
                error={errors.profile?.firstName}
                isRequired
              />
              <TextInput
                label="Last Name"
                register={register}
                name="profile.lastName"
                error={errors.profile?.lastName}
                isRequired
              />
              <TextInput
                label="Preferred Name"
                register={register}
                name="profile.preferredName"
                error={errors.profile?.preferredName}
              />
              <SelectBox
                label="Gender"
                options={genderOptions}
                name="profile.gender"
                register={register}
                error={errors.profile?.gender}
                includePlaceholder={false}
              />
              <TextInput
                label="Date of Birth"
                register={register}
                name="profile.dateOfBirth"
                error={errors.profile?.dateOfBirth}
                placeholder="YYYY-MM-DD"
              />
              <TextInput
                label="Nationality"
                register={register}
                name="profile.nationality"
                error={errors.profile?.nationality}
              />
              <input type="hidden" {...register("profile.workModel")} />
              <TextInput label="Preferred Work Model" value={workModelLabel} readOnly />
              <TextArea
                label="About me / Elevator pitch"
                register={register}
                name="profile.bio"
                error={errors.profile?.bio}
                placeholder="Give teammates a quick snapshot of what drives you and how you like to collaborate."
                className="md:col-span-2"
              />
            </div>
          </div>
        </Card>

        <Card title="Profile Checklist" isTransparentBackground>
          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">{checklistCards}</div>
        </Card>
      </section>

      <section className="grid gap-6">
        <Card title="Contact & Address" isTransparentBackground>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Work Email"
              register={register}
              name="profile.workEmail"
              error={errors.profile?.workEmail}
              isRequired
            />
            <TextInput
              label="Personal Email"
              register={register}
              name="profile.personalEmail"
              error={errors.profile?.personalEmail}
            />
            <TextInput
              label="Work Phone"
              register={register}
              name="profile.workPhone"
              error={errors.profile?.workPhone}
            />
            <TextInput
              label="Personal Phone"
              register={register}
              name="profile.personalPhone"
              error={errors.profile?.personalPhone}
            />
            <TextInput
              label="Home Address"
              register={register}
              name="profile.permanentAddress"
              error={errors.profile?.permanentAddress}
            />
            <TextInput
              label="Current Address"
              register={register}
              name="profile.currentAddress"
              error={errors.profile?.currentAddress}
            />
          </div>
        </Card>

        <Card title="Professional Details" isTransparentBackground>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Employee ID"
              register={register}
              name="employment.employeeCode"
              error={errors.employment?.employeeCode}
              isRequired
              readOnly
            />
            <TextInput
              label="Designation"
              register={register}
              name="employment.designation"
              error={errors.employment?.designation}
              isRequired
              readOnly
            />
            <TextInput
              label="Department"
              register={register}
              name="employment.departmentName"
              error={errors.employment?.departmentName}
              readOnly
            />
            <input type="hidden" {...register("employment.employmentType")} />
            <TextInput label="Employment Type" value={employmentTypeLabel} readOnly />
            <TextInput
              label="Joining Date"
              register={register}
              name="employment.startDate"
              error={errors.employment?.startDate}
              placeholder="YYYY-MM-DD"
              readOnly
            />
            <TextInput
              label="Primary Location"
              register={register}
              name="employment.primaryLocation"
              error={errors.employment?.primaryLocation}
              readOnly
            />
          </div>
        </Card>

        <Card title="Emergency & Support" isTransparentBackground>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Emergency Contact Person"
              register={register}
              name="emergencyContact.name"
              error={errors.emergencyContact?.name}
              isRequired
            />
            <TextInput
              label="Relationship"
              register={register}
              name="emergencyContact.relationship"
              error={errors.emergencyContact?.relationship}
              isRequired
            />
            <TextInput
              label="Emergency Phone"
              register={register}
              name="emergencyContact.phone"
              error={errors.emergencyContact?.phone}
              isRequired
            />
            <TextInput
              label="Alternate Phone"
              register={register}
              name="emergencyContact.alternatePhone"
              error={errors.emergencyContact?.alternatePhone}
            />
            <TextArea
              label="Health notes / considerations"
              placeholder="Share allergies or important medical guidance so HR can support you better."
            />
          </div>
        </Card>

        <Card title="Bank & Payroll" isTransparentBackground>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Bank Name"
              register={register}
              name="bankAccount.bankName"
              error={errors.bankAccount?.bankName}
              isRequired
            />
            <TextInput
              label="Account Holder"
              register={register}
              name="bankAccount.accountHolder"
              error={errors.bankAccount?.accountHolder}
              isRequired
            />
            <TextInput
              label="Account Number"
              register={register}
              name="bankAccount.accountNumber"
              error={errors.bankAccount?.accountNumber}
              isRequired
            />
            <TextInput
              label="Branch"
              register={register}
              name="bankAccount.branch"
              error={errors.bankAccount?.branch}
            />
            <TextInput
              label="SWIFT / IFSC"
              register={register}
              name="bankAccount.swiftCode"
              error={errors.bankAccount?.swiftCode}
            />
            <TextInput
              label="Tax ID (TIN)"
              register={register}
              name="bankAccount.taxId"
              error={errors.bankAccount?.taxId}
            />
          </div>
        </Card>
      </section>

      {serverError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {serverError}
        </p>
      ) : null}
      {serverMessage ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
          {serverMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-4">
        <Button theme="secondary" type="button" onClick={() => router.push("/profile")}>Cancel</Button>
        <Button type="submit" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

export default EditProfilePage;
