"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";

import Text from "@/app/components/atoms/Text/Text";
import Button from "@/app/components/atoms/buttons/Button";
import { EmployeeHeader } from "@/app/components/layouts/EmployeeHeader";
import { employeeStatusStyles } from "@/app/utils/statusStyles";
import { trpc } from "@/trpc/client";
import type { HrEmployeeProfile } from "@/types/hr-admin";

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatValue = (value?: string | null, fallback = "—") =>
  value && value.trim().length > 0 ? value : fallback;

const extractEmployeeId = (pathname: string | null) => {
  if (!pathname) return null;
  const segments = pathname.split("/").filter(Boolean);
  const last = segments.at(-1);
  if (!last || last === "view") {
    return null;
  }
  return decodeURIComponent(last);
};

const documentStatusColor: Record<string, string> = {
  Signed:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  Pending:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  Missing: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
};

const EmptyState = ({ message }: { message: string }) => (
  <section className="rounded-[32px] border border-dashed border-slate-200 bg-white/95 p-10 text-center shadow-xl shadow-indigo-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-200">
      Employee management
    </p>
    <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
      Nothing to show yet
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

export default function EmployeeProfilePage() {
  const pathname = usePathname();
  const employeeId = useMemo(() => extractEmployeeId(pathname), [pathname]);
  const profileQuery = trpc.hrEmployees.profile.useQuery(
    { employeeId: employeeId ?? "" },
    { enabled: Boolean(employeeId) }
  );

  if (!employeeId) {
    return (
      <EmptyState message="Pick an employee from the directory to view their profile." />
    );
  }

  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        Loading employee profile...
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data?.profile) {
    return (
      <EmptyState message="We couldn’t load the employee profile. Try opening it from the directory again." />
    );
  }

  const employee = profileQuery.data.profile;
  return <EmployeeProfileContent employee={employee} />;
}

const EmployeeProfileContent = ({
  employee,
}: {
  employee: HrEmployeeProfile;
}) => {
  const personaTags = [
    employee.department,
    employee.squad,
    employee.workArrangement,
    employee.status,
    ...employee.tags,
  ].filter(Boolean) as string[];

  const quickStats = [
    {
      label: "Experience",
      value: formatValue(employee.experience),
      helper: `Since ${formatDate(employee.startDate)}`,
    },
    {
      label: "Employment type",
      value: employee.employmentType,
      helper: employee.workArrangement ?? "—",
    },
    {
      label: "Manager",
      value: formatValue(employee.manager),
      helper: employee.department ?? "—",
    },
    {
      label: "Work location",
      value: formatValue(employee.location),
      helper: employee.address ?? "—",
    },
  ];

  const infoSections = [
    {
      title: "Contact & Basics",
      items: [
        { label: "Email", value: employee.email },
        { label: "Phone", value: formatValue(employee.phone) },
        { label: "Location", value: formatValue(employee.location) },
        {
          label: "Work arrangement",
          value: formatValue(employee.workArrangement),
        },
      ],
    },
    {
      title: "Employment Snapshot",
      items: [
        { label: "Employee ID", value: employee.employeeCode ?? employee.id },
        { label: "Department", value: formatValue(employee.department) },
        { label: "Squad", value: formatValue(employee.squad) },
        { label: "Manager", value: formatValue(employee.manager) },
        { label: "Start date", value: formatDate(employee.startDate) },
        { label: "Next review", value: formatDate(employee.nextReview) },
      ],
    },
    {
      title: "Emergency contact",
      items: employee.emergencyContact
        ? [
            { label: "Name", value: employee.emergencyContact.name },
            { label: "Phone", value: employee.emergencyContact.phone },
            { label: "Relation", value: employee.emergencyContact.relation },
          ]
        : [{ label: "Contact", value: "Not provided" }],
    },
    {
      title: "Addresses",
      items: [
        { label: "Residential", value: formatValue(employee.address) },
        { label: "Work location", value: formatValue(employee.location) },
      ],
    },
  ];

  const leaveEntries = [
    { label: "Annual leave", value: `${employee.leaveBalances.annual} days` },
    { label: "Sick leave", value: `${employee.leaveBalances.sick} days` },
    { label: "Casual leave", value: `${employee.leaveBalances.casual} days` },
    { label: "Parental leave", value: `${employee.leaveBalances.parental} days` },
  ];

  const statusStyle =
    employeeStatusStyles[employee.status] ?? employeeStatusStyles.Active;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <EmployeeHeader />
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/hr-admin/employees/edit/${encodeURIComponent(employee.id)}`}
            className="inline-flex items-center rounded-xl border border-transparent bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-600 hover:via-sky-600 hover:to-cyan-500"
          >
            Edit Profile
          </Link>
          <Button theme="secondary">Export Record</Button>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-[32px] border border-white/60 bg-white/95 p-6 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border border-white/60 shadow-lg shadow-indigo-100 dark:border-slate-700/70 dark:shadow-slate-900/60">
              {employee.profilePhotoUrl ? (
                <Image
                  src={employee.profilePhotoUrl}
                  alt={employee.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 text-3xl font-semibold text-white dark:from-slate-800 dark:to-slate-700">
                  {employee.avatarInitials}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Text
                text={employee.role}
                className="text-xl font-semibold text-slate-900 dark:text-white"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {formatValue(employee.department)} ·{" "}
                {formatValue(employee.workArrangement)}
              </p>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.bg}`}
                >
                  {employee.status}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800/70 dark:text-slate-200">
                  {employee.employmentType}
                </span>
              </div>
              {personaTags.length > 0 ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {personaTags.map((tag, index) => (
                    <span
                      key={`${tag}-${index}`}
                      className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600 dark:bg-slate-800/60 dark:text-slate-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-white/60 bg-white/95 p-6 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
            <div className="grid gap-4 sm:grid-cols-2">
              {quickStats.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-slate-400">
                    {stat.label}
                  </p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {stat.helper}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/60 bg-white/95 p-6 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-300">
              Time off balance
            </p>
            <div className="mt-4 space-y-3">
              {leaveEntries.map((entry) => (
                <div
                  key={entry.label}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60"
                >
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {entry.label}
                  </span>
                  <span className="text-base font-semibold text-slate-900 dark:text-white">
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {infoSections.map((section) => (
          <div
            key={section.title}
            className="rounded-[32px] border border-white/60 bg-white/95 p-6 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {section.title}
            </h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {section.items.map((item) => (
                <div key={item.label} className="grid grid-cols-2 gap-2">
                  <p className="text-xs uppercase tracking-wider text-slate-400">
                    {item.label}
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[32px] border border-white/60 bg-white/95 p-6 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Skills & tags
          </h3>
          {employee.skills.length === 0 && employee.tags.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              No skills or tags captured yet.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {employee.skills.map((skill, index) => (
                  <span
                    key={`${skill}-${index}`}
                    className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 dark:bg-slate-800/60 dark:text-slate-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {employee.tags.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-[32px] border border-white/60 bg-white/95 p-6 shadow-xl shadow-indigo-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-none">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Compliance & documents
          </h3>
          {employee.documents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              No compliance documents uploaded yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {employee.documents.map((document) => (
                <li
                  key={document.name}
                  className="flex items-center justify-between"
                >
                  <span className="text-slate-600 dark:text-slate-300">
                    {document.name}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      documentStatusColor[document.status]
                    }`}
                  >
                    {document.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
