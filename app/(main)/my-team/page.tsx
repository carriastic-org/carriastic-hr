"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  FiCalendar,
  FiClock,
  FiMail,
  FiMapPin,
  FiSearch,
  FiUsers,
} from "react-icons/fi";

import Text from "@/app/components/atoms/Text/Text";
import Button from "@/app/components/atoms/buttons/Button";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import type {
  MyTeamOverviewResponse,
  TeamMemberSummary,
  TeamPersonSummary,
} from "@/types/team";
import { trpc } from "@/trpc/client";

const statusBadgeByState: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  PROBATION: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  SABBATICAL: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200",
  INACTIVE: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
  TERMINATED: "bg-slate-200 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400",
};

const highlightIcons: Record<string, ReactNode> = {
  headcount: <FiUsers />,
  tenure: <FiClock />,
  locations: <FiMapPin />,
};

const initialsFromName = (name: string) => {
  const parts = name.split(" ").filter(Boolean);
  if (!parts.length) return "—";
  const [first, second] = parts;
  return `${first.charAt(0)}${second ? second.charAt(0) : first.charAt(1) ?? ""}`.toUpperCase();
};

const normalize = (value: string | null | undefined) => value?.toLowerCase() ?? "";

const memberMatchesSearch = (member: TeamMemberSummary, term: string) => {
  const query = term.trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    member.fullName,
    member.preferredName,
    member.designation,
    member.workModelLabel,
    member.location,
    member.statusLabel,
  ]
    .map(normalize)
    .join(" ");
  return haystack.includes(query);
};

const SectionTitle = ({ title, helper }: { title: string; helper?: string }) => (
  <div className="space-y-1">
    <Text text={title} className="text-lg font-semibold text-text_primary" />
    {helper ? <p className="text-sm text-text_secondary">{helper}</p> : null}
  </div>
);

const Avatar = ({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string | null;
}) => (
  <div className="relative h-12 w-12 overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
    {imageUrl ? (
      <Image src={imageUrl} alt={name} fill className="object-cover" sizes="48px" />
    ) : (
      <div className="flex h-full w-full items-center justify-center">
        {initialsFromName(name)}
      </div>
    )}
  </div>
);

const PersonChip = ({
  label,
  person,
}: {
  label: string;
  person: TeamPersonSummary | null;
}) => {
  if (!person) return null;
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/80 px-3 py-2 text-left shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
      <Avatar name={person.fullName} imageUrl={person.avatarUrl} />
      <div className="text-sm">
        <p className="font-semibold text-text_primary">{person.fullName}</p>
        <p className="text-xs text-text_secondary">
          {person.designation ?? label}
        </p>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-300">
        {label}
      </span>
    </div>
  );
};

const MemberCard = ({ member }: { member: TeamMemberSummary }) => {
  const badgeClass =
    statusBadgeByState[member.status] ??
    "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300";
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm transition hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/80">
      <div className="flex items-center gap-4">
        <Avatar name={member.fullName} imageUrl={member.avatarUrl} />
        <div className="flex-1">
          <p className="text-base font-semibold text-text_primary">{member.fullName}</p>
          <p className="text-sm text-text_secondary">{member.designation ?? "—"}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
          {member.statusLabel}
        </span>
      </div>
      {member.isTeamLead ? (
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
          Team Lead
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Tenure
          </p>
          <p className="font-semibold text-text_primary">{member.tenureLabel}</p>
          <p className="text-xs text-text_secondary">
            {member.startDateLabel ? `Since ${member.startDateLabel}` : "Start date TBD"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Work style
          </p>
          <p className="font-semibold text-text_primary">{member.workModelLabel}</p>
          <p className="text-xs text-text_secondary">{member.location ?? "Location TBD"}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs text-text_secondary">
        <div className="flex items-center gap-2">
          <FiMail className="text-base text-slate-400" />
          <span className="truncate">{member.email ?? "No email"}</span>
        </div>
        <div className="flex items-center gap-2">
          <FiMapPin className="text-base text-slate-400" />
          <span className="truncate">{member.location ?? "—"}</span>
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({
  title,
  helper,
  actionLabel,
  href,
}: {
  title: string;
  helper: string;
  actionLabel: string;
  href: string;
}) => (
  <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-10 text-center shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
    <Text text={title} className="text-xl font-semibold text-text_primary" />
    <p className="text-sm text-text_secondary">{helper}</p>
    <Link href={href}>
      <Button theme="primary">
        <Text text={actionLabel} className="px-3 py-1" />
      </Button>
    </Link>
  </div>
);

const StatCard = ({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) => (
  <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
    <div className="rounded-2xl bg-slate-900/5 p-3 text-lg text-indigo-600 dark:bg-slate-100/5 dark:text-indigo-300">
      {icon}
    </div>
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="text-2xl font-semibold text-text_primary">{value}</p>
      <p className="text-sm text-text_secondary">{helper}</p>
    </div>
  </div>
);

const Divider = () => <div className="section-divider" />;

function MyTeamPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const overviewQuery = trpc.team.overview.useQuery();

  if (overviewQuery.isLoading || overviewQuery.isPending) {
    return (
      <LoadingSpinner
        fullscreen
        label="Loading your team"
        helper="Collecting member profiles, work styles, and schedules."
      />
    );
  }

  if (overviewQuery.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <Text
          text="We couldn’t load your team right now."
          className="text-lg text-text_primary"
        />
        <Button onClick={() => overviewQuery.refetch()} disabled={overviewQuery.isFetching}>
          <Text
            text={overviewQuery.isFetching ? "Refreshing..." : "Try again"}
            className="font-semibold"
          />
        </Button>
      </div>
    );
  }

  const data = overviewQuery.data;

  if (!data?.hasTeam || !data.team) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4">
        <EmptyState
          title="You’re not assigned to a team yet."
          helper="Once HR assigns you to a team, you’ll be able to see every teammate’s profile, work style, and schedule here."
          actionLabel="View your profile"
          href="/profile"
        />
      </div>
    );
  }

  const filteredMembers = data.members.filter((member) =>
    memberMatchesSearch(member, searchTerm),
  );

  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-6 pb-16">
        <section className="space-y-6 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Team
              </p>
              <h1 className="text-3xl font-semibold text-text_primary">{data.team.name}</h1>
              <p className="text-sm text-text_secondary">
                {data.team.description ??
                  "Keep everyone aligned with a shared snapshot of roles, locations, and bandwidth."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.highlights.map((stat) => (
                <StatCard
                  key={stat.id}
                  label={stat.label}
                  value={stat.value}
                  helper={stat.helper}
                  icon={highlightIcons[stat.id] ?? <FiUsers />}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {data.team.leads.length ? (
              data.team.leads.map((lead) => (
                <PersonChip key={lead.id} label="Team Lead" person={lead} />
              ))
            ) : (
              <div className="inline-flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-slate-700">
                <span className="font-semibold text-text_secondary">Team lead TBD</span>
              </div>
            )}
            <PersonChip label="Manager" person={data.team.manager} />
            {data.team.locationHint ? (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-text_secondary dark:border-slate-700">
                <FiMapPin className="text-base text-indigo-500" />
                <span className="font-semibold text-text_primary">
                  {data.team.locationHint}
                </span>
                <span className="text-xs uppercase tracking-wide text-slate-500">Primary hub</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {data.workModelStats.map((stat) => (
            <div
              key={stat.id}
              className="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80"
            >
              <p className="text-sm font-semibold text-text_primary">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-text_primary">{stat.count}</p>
              <p className="text-xs text-text_secondary">
                {stat.helper} · {stat.percentage}%
              </p>
              <div className="mt-4 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-2 rounded-full bg-gradient-to-r ${stat.accent}`}
                  style={{ width: `${stat.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <SectionTitle
              title="Member directory"
              helper={`Search ${data.members.length} teammates across roles and locations.`}
            />
              <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-inner shadow-slate-100 focus-within:border-indigo-400 dark:border-slate-700 dark:bg-slate-900">
                <FiSearch className="text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, role, or location..."
                className="w-full bg-transparent text-sm text-text_primary placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
              />
            </div>
          </div>
          <Divider />
          {filteredMembers.length === 0 ? (
            <p className="text-sm text-text_secondary">
              {searchTerm.trim()
                ? `Couldn’t find anyone matching “${searchTerm}”.`
                : "No teammates have been added to this team yet."}
            </p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {filteredMembers.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default MyTeamPage;
