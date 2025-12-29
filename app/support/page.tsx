"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import z from "zod/v3";

import { FAQ } from "../components/FAQ";
import Text from "../components/atoms/Text/Text";
import Button from "../components/atoms/buttons/Button";
import { Card } from "../components/atoms/frame/Card";
import TextArea from "../components/atoms/inputs/TextArea";
import TextInput from "../components/atoms/inputs/TextInput";
import Header from "../components/navigations/Header";

const schema = z.object({
  subject: z.string().nonempty("Subject is required"),
  email: z
    .string()
    .nonempty("Email is required")
    .email("Please enter a valid email address"),
  message: z.string().nonempty("Message is required"),
});

type FormData = z.infer<typeof schema>;

const heroStats = [
  { value: "21m", label: "Avg first reply", helper: "weighted across 24/7 pods" },
  { value: "7", label: "Regional pods", helper: "Follow-the-sun specialists" },
  { value: "97%", label: "CSAT", helper: "Rolling 90-day satisfaction" },
];

const supportChannels = [
  {
    label: "Email",
    value: "support@ndi.hr",
    helper: "Average response < 2 hours on business days",
  },
  {
    label: "Live chat",
    value: "Mon–Fri · 7 am – 7 pm GMT",
    helper: "Launch from the in-app bubble",
  },
  {
    label: "Emergency pager",
    value: "+1 (855) 555‑0199",
    helper: "Critical HR outages · 24/7 coverage",
  },
  {
    label: "Status page",
    value: "status.ndi.hr",
    helper: "Realtime maintenance + incident notes",
    href: "https://status.ndi.hr",
  },
];

const supportStages = [
  {
    title: "Signal intake",
    summary: "Ticket metadata, logs, and attachments auto-sync to your workspace context.",
    window: "0 – 10 minutes",
    detail: "We tag severity, impacted modules, and compliance scope before handing off to a pod.",
  },
  {
    title: "Diagnosis huddle",
    summary: "A cross-functional pod outlines impact, success criteria, and next checkpoints.",
    window: "10 – 60 minutes",
    detail: "Expect screenshots, Loom clips, or SQL traces so stakeholders understand the fix.",
  },
  {
    title: "Resolution & recap",
    summary: "You receive mitigation steps, rollback plans, and a recap you can forward internally.",
    window: "Same day for P1 · < 2 days for P2",
    detail: "We follow up with post-mortems for critical tickets within 48 hours.",
  },
];

const supportTiers = [
  {
    title: "P0 · Payroll blocking",
    response: "15 min triage",
    resolution: "< 4 hours",
    coverage: "24/7 global",
    helper: "Bridge call opened with payroll + infrastructure on standby.",
  },
  {
    title: "P1 · Employee-impacting",
    response: "30 min triage",
    resolution: "Business day",
    coverage: "Follow-the-sun",
    helper: "Screenshare or async recap once mitigated and verified.",
  },
  {
    title: "P2 · Guidance / requests",
    response: "< 4 business hours",
    resolution: "1 – 2 days",
    coverage: "Regional pods",
    helper: "Templates, best practices, and policy references in every reply.",
  },
];

const resourceLibrary = [
  {
    title: "Admin launchpad",
    description: "Onboarding, payroll approval, and audit checklists you can duplicate.",
    action: "Open handbook",
    href: "/terms",
  },
  {
    title: "Security & privacy center",
    description: "SOC 2, ISO, DPA templates, and a list of active sub-processors.",
    action: "Visit privacy center",
    href: "/privacy",
  },
  {
    title: "Live status page",
    description: "Realtime availability for payroll, leave, integrations, and webhooks.",
    action: "Check status.ndi.hr",
    href: "https://status.ndi.hr",
    external: true,
  },
];

const escalationNotes = [
  "Tag tickets as P0 or P1 in the subject line to auto-page the incident commander.",
  "Attach logs, CSVs, or screenshots—uploads stay encrypted and scoped to your workspace.",
  "Need a joint retro? We schedule them within 2 business days for any critical incident.",
];

const faqs = [
  {
    question: "How do I reset my password?",
    answer:
      "Go to Login → “Forgot password” and enter your work email. Our reset links stay valid for 30 minutes.",
  },
  {
    question: "How do I update my profile information?",
    answer: "Head to Profile → Edit. Save changes to sync with payroll automatically.",
  },
  {
    question: "Who do I contact for technical issues?",
    answer: "Use the form on this page or email support@ndi.hr for assistance.",
  },
  {
    question: "How do I submit a leave request?",
    answer: "From the dashboard, open Leave → New application and follow the guided form.",
  },
  {
    question: "Can I manage multiple departments?",
    answer: "Yes. HR Admins can create and assign departments under Settings → Organization.",
  },
];

function SupportPage() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleOnSubmit = (data: FormData) => {
    console.log("Support inquiry submitted:", data);
    alert("Your inquiry has been submitted. We will get back to you shortly.");
    reset();
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 pb-20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="fixed left-6 right-6 top-12 z-40">
        <Header />
      </div>

      <main className="mx-auto max-w-6xl space-y-12 pt-32">
        <section className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="rounded-[32px] border border-white/60 bg-gradient-to-br from-indigo-600 via-sky-500 to-cyan-400 p-10 text-white shadow-2xl shadow-indigo-500/30">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                support network
              </p>
              <h1 className="text-4xl font-semibold leading-snug">
                HR experts on call, tuned for every timezone
              </h1>
              <p className="text-base text-white/85">
                Every request routes to the pod that owns that workflow—payroll, policy, or platform. You get a clear action plan, the artifacts we reviewed, and timelines you can forward to stakeholders.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/30 bg-white/10 p-4 text-center backdrop-blur"
                >
                  <p className="text-3xl font-semibold">{stat.value}</p>
                  <p className="text-sm font-medium text-white/80">{stat.label}</p>
                  <p className="text-xs text-white/70">{stat.helper}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/80 bg-white/95 p-8 shadow-xl shadow-slate-200/80 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/40">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
                direct channels
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                Choose the lane that matches the moment
              </h2>
            </div>
            <div className="space-y-4">
              {supportChannels.map((channel) => (
                <div
                  key={channel.label}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/70"
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                    {channel.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                    {channel.href ? (
                      <a
                        href={channel.href}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-slate-300 decoration-dashed underline-offset-4"
                      >
                        {channel.value}
                      </a>
                    ) : (
                      channel.value
                    )}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{channel.helper}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-[32px] border border-white/70 bg-white/95 p-8 shadow-xl shadow-slate-200/80 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-slate-950/40">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
                  playbook
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                  How we resolve every ticket
                </h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:bg-slate-800/80 dark:text-slate-300">
                transparent updates
              </span>
            </div>
            <div className="mt-6 space-y-6">
              {supportStages.map((stage, index) => (
                <div key={stage.title} className="relative pl-10">
                  <div className="absolute left-3 top-1 h-full w-px bg-gradient-to-b from-indigo-300 to-transparent dark:from-indigo-700" />
                  <span className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 font-mono text-xs font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        {stage.title}
                      </p>
                      <span className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                        {stage.window}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{stage.summary}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{stage.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-900/50 bg-slate-900 p-8 text-slate-100 shadow-2xl shadow-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              response tiers
            </p>
            <h3 className="mt-2 text-2xl font-semibold">SLA commitments</h3>
            <div className="mt-6 space-y-5">
              {supportTiers.map((tier) => (
                <div key={tier.title} className="rounded-2xl border border-white/10 p-4">
                  <p className="text-base font-semibold text-white">{tier.title}</p>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase text-white/60">Response</p>
                      <p className="text-white">{tier.response}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-white/60">Resolution</p>
                      <p className="text-white">{tier.resolution}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-white/60">Coverage</p>
                      <p className="text-white">{tier.coverage}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-white/80">{tier.helper}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
          <Card
            id="contact"
            className="border border-white/70 bg-white/95 p-8 shadow-xl shadow-indigo-100 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/60"
          >
            <div className="mb-6 space-y-2">
              <Text
                text="Open a support inquiry"
                className="text-3xl font-semibold text-slate-900 dark:text-white"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Provide as much context as you can—screenshots, CSVs, or policy IDs help us reproduce issues faster. Everything stays encrypted and scoped to this ticket.
              </p>
            </div>
            <form onSubmit={handleSubmit(handleOnSubmit)} className="space-y-5">
              <TextInput
                label="Subject"
                isRequired
                placeholder="Brief description of your request"
                register={register}
                name="subject"
                error={errors.subject}
              />
              <TextInput
                label="Work email"
                isRequired
                placeholder="you@ndi.team"
                register={register}
                name="email"
                error={errors.email}
              />
              <TextArea
                label="Message"
                isRequired
                placeholder="Describe the workflow, the users affected, and what you expected to happen."
                register={register}
                name="message"
                error={errors.message}
                height="170px"
              />
              <Button type="submit" theme="primary" isWidthFull disabled={isSubmitting}>
                <Text
                  text={isSubmitting ? "Sending..." : "Send to support"}
                  className="text-[16px] font-semibold"
                />
              </Button>
            </form>
          </Card>

          <div className="space-y-6">
            <Card className="border border-slate-200/60 bg-slate-50/80 p-6 shadow-inner dark:border-slate-800 dark:bg-slate-900/70">
              <div className="mb-4">
                <Text
                  text="Resource library"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Bookmark these docs to share with security, payroll, or department leads.
                </p>
              </div>
              <div className="space-y-4">
                {resourceLibrary.map((resource) => (
                  <div
                    key={resource.title}
                    className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70"
                  >
                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                      {resource.title}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{resource.description}</p>
                    <Link
                      href={resource.href}
                      target={resource.external ? "_blank" : undefined}
                      rel={resource.external ? "noreferrer" : undefined}
                      className="mt-3 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-sky-400 dark:hover:text-sky-300"
                    >
                      {resource.action}
                    </Link>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border border-white/50 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-white shadow-2xl shadow-slate-900/60">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                escalate with confidence
              </p>
              <h4 className="mt-2 text-xl font-semibold">Need to raise the urgency?</h4>
              <ul className="mt-4 space-y-3 text-sm text-white/80">
                {escalationNotes.map((note) => (
                  <li key={note} className="leading-relaxed">
                    {note}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="mailto:support@ndi.hr"
                  className="inline-flex items-center rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Email support desk
                </a>
                <a
                  href="tel:+18555550199"
                  className="inline-flex items-center rounded-xl border border-transparent bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
                >
                  Call the pager
                </a>
              </div>
            </Card>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/20 bg-gradient-to-br from-indigo-600/90 via-sky-600/70 to-cyan-500/70 p-8 text-white shadow-2xl shadow-indigo-500/30">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                quick answers
              </p>
              <h4 className="mt-2 text-2xl font-semibold">Self-serve FAQ</h4>
            </div>
            <a
              href="#contact"
              className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25"
            >
              Still unsure? Open a ticket →
            </a>
          </div>
          <Card className="border border-white/20 bg-white/10 p-4 backdrop-blur">
            <FAQ faqs={faqs} />
          </Card>
        </section>
      </main>
    </div>
  );
}

export default SupportPage;
