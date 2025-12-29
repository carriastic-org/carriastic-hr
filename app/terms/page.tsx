import Header from "../components/navigations/Header";
import Text from "../components/atoms/Text/Text";

const sections = [
  {
    title: "1. Introduction",
    body: [
      "By accessing HR, you agree to the Terms detailed below. If you’re accepting on behalf of an organization, you represent that you have authority to bind that organization to these Terms.",
    ],
  },
  {
    title: "2. Services Provided",
    body: [
      "We provide a suite of HR tools including onboarding, leave, performance and payroll automation.",
      "Beta features may change or be discontinued at any time without notice.",
    ],
  },
  {
    title: "3. Account Registration",
    body: [
      "Provide accurate information when creating an account and keep credentials confidential.",
      "Admins are responsible for permissions granted to teammates and contractors.",
    ],
  },
  {
    title: "4. Responsible Use",
    body: [
      "Do not use the platform to store unlawful content or disrupt other tenants.",
      "Security testing or scraping without prior written approval is prohibited.",
    ],
  },
  {
    title: "5. Fees & Billing",
    body: [
      "Invoices are due Net 30 unless a different order form is executed.",
      "Late payments may result in service suspension after a 7‑day grace period.",
    ],
  },
  {
    title: "6. Termination",
    body: [
      "You may export data and close the workspace at any time by contacting support.",
      "We may suspend or terminate access for material breach or unpaid invoices.",
    ],
  },
  {
    title: "7. Limitation of Liability",
    body: [
      "HR is provided “as is”. Our total liability is limited to fees paid in the preceding 12 months.",
      "We are not liable for indirect, incidental, or consequential damages.",
    ],
  },
  {
    title: "8. Governing Law",
    body: [
      "These Terms are governed by the laws of England & Wales, unless a different jurisdiction is listed in your order form.",
      "Disputes will be handled exclusively in the competent courts of the governing jurisdiction.",
    ],
  },
  {
    title: "9. Updates",
    body: [
      "We may update these Terms to reflect product changes or legal requirements.",
      "Material changes will be announced in-product or via email at least 14 days before taking effect.",
    ],
  },
];

const keyFacts = [
  { label: "Effective date", value: "05 Jan 2025" },
  { label: "Last update", value: "05 Jan 2025" },
  { label: "Governing law", value: "England & Wales" },
  { label: "Contact", value: "legal@ndi.hr" },
];

const procurementChecklist = [
  {
    title: "Commercials",
    description: "Standard subscriptions renew annually with Net 30 invoices. Custom billing cadences are available via order form.",
  },
  {
    title: "Security",
    description: "SOC 2 Type II + ISO 27001 controls, SSO/SAML, SCIM, audit logging, and regional data residency.",
  },
  {
    title: "Service scope",
    description: "Covers onboarding, time/leave, performance integrations, payroll workflows, and analytics APIs.",
  },
  {
    title: "Escalations",
    description: "Named Customer Success Manager for premium plans plus 24/7 critical incident hotline.",
  },
];

const terminationNotes = [
  "Export or delete data at any time via console or API before a workspace is closed.",
  "Suspended workspaces keep read-only access for 14 days so you can download artifacts.",
  "A deletion certificate is delivered within 30 days of written confirmation.",
];

function TermsPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white via-slate-50 to-slate-100 px-6 pb-20 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 dark:text-slate-100">
      <div className="fixed left-6 right-6 top-12 z-40">
        <Header />
      </div>

      <main className="mx-auto max-w-6xl space-y-12 pt-32">
        <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-[32px] border border-white/60 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 p-10 text-white shadow-2xl shadow-indigo-300/30">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200">
              legal center
            </p>
            <Text text="Terms & Conditions" className="mt-3 text-4xl font-semibold text-white" />
            <p className="mt-4 text-base text-indigo-100/90">
              These Terms describe how you may use the HR platform. They outline your responsibilities,
              payment obligations, limits of liability, and where disputes are resolved.
            </p>
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-5 text-sm text-indigo-50">
              Share this summary with procurement: it links back to the canonical agreement and references the
              privacy policy + DPAs available on request.
            </div>
          </div>

          <div className="rounded-[32px] border border-white/70 bg-white/95 p-8 shadow-xl shadow-indigo-100 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-slate-900/60">
            <div className="grid gap-4 sm:grid-cols-2">
              {keyFacts.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              Need an executed copy, DPA, or SCCs? Email <a className="font-semibold" href="mailto:legal@ndi.hr">legal@ndi.hr</a> and we’ll respond within one business day.
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/70 bg-white/95 p-8 shadow-lg shadow-slate-200 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-slate-900/50">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500 dark:text-slate-400">
            Core clauses
          </p>
          <div className="mt-6 space-y-4">
            {sections.map((section, index) => (
              <details
                key={section.title}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition dark:border-slate-800 dark:bg-slate-900/70"
                open={index === 0}
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-left text-base font-semibold text-slate-900 dark:text-white">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 font-mono text-sm text-indigo-700 dark:bg-slate-800 dark:text-slate-100">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">{section.title}</span>
                </summary>
                <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  {section.body.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex} className="leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[28px] border border-white/70 bg-white/95 p-8 shadow-lg shadow-slate-200 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-slate-900/40">
            <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">Procurement snapshot</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Hand this to security, legal, or finance so they can move quickly through review.
            </p>
            <div className="mt-6 space-y-5">
              {procurementChecklist.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-700">
                  <p className="text-base font-semibold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-indigo-100 bg-indigo-50/70 p-8 text-slate-900 shadow-inner dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-white">
            <h3 className="text-2xl font-semibold">Termination & data handling</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {terminationNotes.map((note) => (
                <li key={note} className="leading-relaxed">
                  {note}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-2xl border border-white/60 bg-white/90 p-4 text-sm text-slate-700 dark:border-white/20 dark:bg-transparent dark:text-white">
              Need help planning an exit, audit, or M&A event? Our support team shares runbooks for safe exports and legal confirmations.
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="mailto:support@ndi.hr"
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Coordinate with support
              </a>
              <a
                href="/privacy"
                className="inline-flex items-center rounded-xl border border-transparent bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
              >
                Review privacy policy
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white/95 p-8 text-slate-900 shadow-lg shadow-slate-200 dark:border-slate-800 dark:bg-slate-900/85 dark:text-white dark:shadow-slate-900/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-2xl font-semibold">Need a bespoke amendment?</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                We routinely work with enterprise legal teams on DPAs, security addenda, and custom billing clauses.
              </p>
            </div>
            <a
              href="mailto:legal@ndi.hr?subject=NDI%20HR%20Terms%20Amendment"
              className="inline-flex items-center rounded-xl border border-transparent bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              Start a legal review
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

export default TermsPage;
