import Text from "../components/atoms/Text/Text";
import Header from "../components/navigations/Header";

const principles = [
  {
    title: "Transparency",
    description: "We clearly explain how data is collected, processed, and stored across every HR workflow.",
  },
  {
    title: "Security",
    description: "Data is encrypted in transit and at rest. Access is gated by role-based controls and audited hourly.",
  },
  {
    title: "Control",
    description: "Admins can export, amend, or delete employee data at any time through the dashboard or API.",
  },
];

const policySections = [
  {
    title: "1. Information we collect",
    bullets: [
      "Profile data provided by admins and employees (name, email, role, employment information).",
      "Usage data such as login timestamps, device type, and feature interactions.",
      "Support artifacts like attachments or transcripts that you voluntarily share.",
    ],
  },
  {
    title: "2. How we use information",
    bullets: [
      "Operate and improve HR workflows including onboarding, attendance, payroll, and analytics.",
      "Provide support, send notifications, and surface insights that keep teams compliant.",
      "Fulfil legal requirements, including tax reporting and employment regulations.",
    ],
  },
  {
    title: "3. Data protection & retention",
    bullets: [
      "We host in ISO 27001 certified data centers with annual penetration tests.",
      "Backups are encrypted, regionally redundant, and retained for 35 days.",
      "Customer data is retained for the life of the contract plus 90 days unless deletion is requested sooner.",
    ],
  },
  {
    title: "4. Your rights",
    bullets: [
      "Request access, correction, or deletion of personal data through the admin console.",
      "Export data in CSV or JSON at any time without a support ticket.",
      "Object to certain processing or withdraw consent where applicable under GDPR/CCPA.",
    ],
  },
  {
    title: "5. Third-party processors",
    bullets: [
      "We only partner with vetted sub‑processors for infrastructure, communications, and analytics.",
      "A current list of processors, their locations, and purpose of processing is available on request.",
    ],
  },
  {
    title: "6. Changes to this policy",
    bullets: [
      "We’ll post updates here and alert workspace owners at least 14 days before material changes take effect.",
      "Past revisions are archived and accessible through support.",
    ],
  },
];

const lifecyclePhases = [
  {
    title: "Collect",
    description: "Admins import workforces, employees self-serve details, and integrations sync payroll + attendance.",
    bullets: ["Role-based intake, consent tracked", "Secure SFTP & API pipelines"],
  },
  {
    title: "Process",
    description: "Data powers onboarding, pay runs, analytics, and HR workflows. Access is logged per event.",
    bullets: ["Scoped service accounts", "Real-time anomaly detection"],
  },
  {
    title: "Retain",
    description: "Encrypted backups live in geo-redundant storage with strict retention timers.",
    bullets: ["Backups keep 35-day rolling window", "Customer-specific encryption keys"],
  },
  {
    title: "Delete",
    description: "Admins trigger deletions or workspace closure; we confirm purge plus backup destruction.",
    bullets: ["Certificate of destruction", "Backups purged within 30 days"],
  },
];

const assurances = [
  { label: "SOC 2 Type II", helper: "Renewed Jan 2025" },
  { label: "ISO 27001", helper: "Certified through 2026" },
  { label: "GDPR & CCPA ready", helper: "DPA + SCC templates available" },
];

const requestChannels = [
  {
    title: "Access or export",
    description: "Admins can self-serve CSV/JSON exports or request curated extracts for audits.",
    channel: "Console → Settings → Privacy",
    sla: "Instant / < 24h with support",
  },
  {
    title: "Rectification",
    description: "Submit corrections with employee ID + field list. We update and keep an audit trail.",
    channel: "privacy@ndi.hr",
    sla: "< 48h",
  },
  {
    title: "Deletion",
    description: "Request employee-level or workspace-level deletion. Backups purge automatically afterward.",
    channel: "privacy@ndi.hr",
    sla: "< 30 days",
  },
];

function PrivacyPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 pb-20 text-white">
      <div className="fixed left-6 right-6 top-12 z-40">
        <Header />
      </div>

      <main className="mx-auto max-w-6xl space-y-12 pt-32">
        <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-[32px] border border-white/15 bg-white/5 p-10 shadow-xl shadow-slate-900/40 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
              privacy center
            </p>
            <Text text="Privacy Policy" className="mt-3 text-4xl font-semibold text-white" />
            <p className="mt-4 max-w-3xl text-base text-slate-200">
              This policy explains how we govern personal data inside the HR platform—from intake to deletion.
              Every workspace inherits these controls and can request additional documentation at any time.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {principles.map((principle) => (
                <div key={principle.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{principle.title}</p>
                  <p className="mt-2 text-sm text-slate-200">{principle.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-emerald-200/20 bg-gradient-to-br from-emerald-600/40 via-emerald-500/20 to-slate-900 p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100">
              independent assurance
            </p>
            <div className="mt-5 space-y-4">
              {assurances.map((badge) => (
                <div
                  key={badge.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-emerald-50 backdrop-blur"
                >
                  <p className="text-base font-semibold">{badge.label}</p>
                  <p className="text-sm text-emerald-100">{badge.helper}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-emerald-50">
              Daily automated monitoring + quarterly penetration tests keep controls provable. Need a DPA or
              pen-test summary? Email <a className="underline" href="mailto:privacy@ndi.hr">privacy@ndi.hr</a>.
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <h2 className="text-2xl font-semibold text-white">Data lifecycle controls</h2>
            <p className="mt-2 text-sm text-slate-300">
              Every stage is logged, reviewable, and governed by the same RBAC model you use inside the product.
            </p>
            <div className="mt-6 space-y-5">
              {lifecyclePhases.map((phase) => (
                <div key={phase.title} className="rounded-2xl border border-white/10 p-4">
                  <p className="text-base font-semibold text-white">{phase.title}</p>
                  <p className="text-sm text-slate-200">{phase.description}</p>
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-200">
                    {phase.bullets.map((item) => (
                      <li
                        key={item}
                        className="rounded-full border border-emerald-200/40 px-3 py-1 text-emerald-100"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <h3 className="text-2xl font-semibold text-white">Policy at a glance</h3>
            <p className="mt-2 text-sm text-slate-300">
              Reference the exact clause you need for security reviews or procurement checklists.
            </p>
            <div className="mt-5 space-y-5">
              {policySections.slice(0, 3).map((section) => (
                <div key={section.title} className="rounded-2xl border border-white/10 p-4">
                  <p className="text-base font-semibold text-white">{section.title}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-200">
                    {section.bullets.slice(0, 2).map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <a
                href="#policy-details"
                className="inline-flex text-sm font-semibold text-emerald-200 hover:text-white"
              >
                View full policy detail ↓
              </a>
            </div>
          </div>
        </section>

        <section id="policy-details" className="space-y-6">
          {policySections.map((section) => (
            <div
              key={section.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-100 backdrop-blur"
            >
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-200">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <h3 className="text-2xl font-semibold text-white">Need to exercise a right?</h3>
            <p className="mt-2 text-sm text-slate-300">
              Choose the workflow that matches your request. Every submission receives a timestamped acknowledgement.
            </p>
            <div className="mt-6 space-y-5">
              {requestChannels.map((request) => (
                <div key={request.title} className="rounded-2xl border border-white/10 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-base font-semibold text-white">{request.title}</p>
                    <span className="text-xs uppercase tracking-[0.2em] text-emerald-200">
                      {request.sla}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200">{request.description}</p>
                  <p className="mt-2 text-sm text-emerald-200">{request.channel}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-emerald-200/40 bg-emerald-500/15 p-8 text-emerald-50">
            <h3 className="text-2xl font-semibold text-white">Questions, audits, or DPAs?</h3>
            <p className="mt-2 text-sm text-emerald-100">
              Email privacy@ndi.hr for a signed data processing agreement, a list of sub‑processors, or to
              schedule a compliance review. We typically reply same business day.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="mailto:privacy@ndi.hr"
                className="inline-flex items-center rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Contact privacy team
              </a>
              <a
                href="/terms"
                className="inline-flex items-center rounded-xl bg-white/95 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-white"
              >
                Review terms of service
              </a>
            </div>
            <p className="mt-4 text-xs text-emerald-100">
              Need a historical copy? Past revisions are archived and can be shared under NDA.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default PrivacyPage;
