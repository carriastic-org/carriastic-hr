# NDI HR Management

NDI HR Management is a **single-tenant** workforce operations portal built with Next.js 16, React 19, tRPC, and Prisma. A single deployment powers one organization’s HR team and employees, covering onboarding, attendance, time-off, invoices, projects, and internal comms. The system relies on PostgreSQL for state, S3-compatible storage for documents, and Socket.IO for live updates.

---

## Application Surfaces

| Surface | Location | Highlights |
| --- | --- | --- |
| **Authentication** | `app/(auth)` | Email + password login, invite acceptance, password reset flows, and status messaging. |
| **HR Admin workspace** | `app/(hr-admin)/hr-admin` | Dashboards, organization configuration, employee records, attendance & leave approvals, invoices, projects, org/team/department admin, and announcements. |
| **Employee workspace** | `app/(main)` | Self-service attendance, leave requests, invoices, team directory, messaging, notifications, reports, and profile management. |

---

## Feature Highlights

- **Role-based workspace (single tenant)** — RBAC spanning `SUPER_ADMIN` through `EMPLOYEE` is modeled in `prisma/schema.prisma` and enforced across admin vs. employee routes.
- **Attendance automation** — Check-ins, onsite/remote tracking, shift adherence, and anomaly detection handled in `server/modules/hr/attendance` with UIs in `app/(hr-admin)/hr-admin/attendance` and `app/(main)/attendance`.
- **Leave & PTO lifecycle** — Employees submit requests with attachments, HR reviews/approves, and PDFs are guarded by signed download tokens (`server/modules/leave`, `app/(hr-admin)/hr-admin/leave-approvals`, `app/(main)/leave`).
- **Employee records & onboarding** — Invitation tokens, profile data, emergency contacts, banking, and lifecycle updates live in `server/modules/hr/employees` and `app/(hr-admin)/hr-admin/employees`.
- **Organization configuration** — HR admins curate org info, departments, teams, work arrangements, and announcements via `app/components/hr-admin` modules backed by `server/modules/hr/organization`, `department`, and `team`.
- **Projects & work management** — Admins and managers assign initiatives, roles, and deliverables (`app/(hr-admin)/hr-admin/project-management`, `server/modules/hr/project`, `work`).
- **Invoices & payroll review** — Employees unlock invoices with short-lived tokens (`app/(main)/invoice`), while finance/HR audit via `app/(hr-admin)/hr-admin/invoices` and `server/modules/invoice`.
- **Reporting & analytics** — Daily/monthly snapshots plus exports through `server/modules/hr/reports`, `server/modules/report`, and UI tables/charts in `app/(hr-admin)/hr-admin/reports`.
- **Messaging & notifications** — Threaded conversations, presence, and alert delivery using Socket.IO (`pages/api/socket.ts`, `app/components/realtime`, `server/modules/messages`, `notification`).
- **Document storage** — Policies, proofs, and avatars stream to Cloudflare R2/AWS S3 via `server/storage/r2.ts` with signed URL access control.

---

## Technology Stack

- **Frontend** — Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 3 + DaisyUI, next/font (Geist), TanStack Query, React Hook Form, React Datepicker, React Icons.
- **APIs & Services** — Next.js route handlers, tRPC 11, Prisma 6, NextAuth credentials provider, Socket.IO, Zod, JSON Web Tokens, bcryptjs.
- **Data & Infra** — PostgreSQL, S3-compatible object storage (Cloudflare R2 or AWS S3), Nodemailer (Gmail by default) for transactional email.
- **DX Tooling** — ESLint 9 (`eslint-config-next`), Tailwind/PostCSS, `tsx` scripts, Prisma Migrate/Studio, npm scripts (`dev`, `build`, `start`, `lint`).

---

## Getting Started

1. **Clone & install**
   ```bash
   git clone <repo-url>
   cd ndi-hr-mgt
   npm install
   ```
2. **Configure environment variables** — Create `.env` with the values listed below.
3. **Provision PostgreSQL & storage**
   - Start PostgreSQL (Docker or managed) and create a database.
   - Create an S3-compatible bucket (Cloudflare R2, AWS S3, etc.) for uploads.
4. **Run database migrations**
   ```bash
   npx prisma migrate dev
   ```
5. **Seed reference data (optional)**
   ```bash
   npx prisma db seed
   ```
6. **Start the dev server**
   ```bash
   npm run dev
   # open http://localhost:3000
   ```

---

## Environment Setup

### Required services

- **PostgreSQL** for relational data (`DATABASE_URL`).
- **S3-compatible storage** for avatars, documents, policies, etc. (`server/storage/r2.ts`).
- **SMTP** credentials for invites/password resets (Nodemailer uses Gmail out of the box).

### Core variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string for Prisma. |
| `NEXTAUTH_URL` | Yes (prod) | Absolute base URL used by NextAuth callbacks. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public origin used in emails/password reset links. |
| `NEXT_PUBLIC_BASE_URL` | No | Override for invite links when marketing + app domains differ. |
| `PORT` | No | Dev server port (defaults to `3000`). |
| `NODE_ENV` | No | `development` or `production`. |
| `VERCEL_URL` | Auto | Provided by Vercel when deployed there. |

### Auth & security

| Variable | Required | Description |
| --- | --- | --- |
| `NEXTAUTH_SECRET` | Yes | Secret for NextAuth sessions/JWTs (shared with Socket.IO auth). |
| `JWT_SECRET` | Yes | Base secret for invites, password reset, and attachment tokens (falls back to `AUTH_SECRET`/`NEXTAUTH_SECRET` if unset). |
| `AUTH_SECRET` | No | Legacy fallback. |
| `INVOICE_UNLOCK_SECRET` | No | Overrides invoice unlock token secret. |
| `LEAVE_ATTACHMENT_TOKEN_SECRET` | No | Secret for leave attachment downloads; TTL configurable via `LEAVE_ATTACHMENT_TOKEN_TTL`. |
| `NEXT_PUBLIC_INVITE_TOKEN_TTL_HOURS` / `INVITE_TOKEN_TTL_HOURS` | No | Invitation expiry in hours (default `72`). |
| `NEXT_PUBLIC_TRIAL_DURATION_DAYS` | No | Trial gating for dormant orgs (default `10`). |
| `NEXT_PUBLIC_ACCOUNT_VISIBILITY` | No | `PRIVATE` blocks expired trials from signing in. |

### Email

| Variable | Required | Description |
| --- | --- | --- |
| `EMAIL_USER` or `SMTP_USER` | Yes | SMTP username (Gmail address recommended). |
| `EMAIL_PASS` or `SMTP_PASS` | Yes | App password/SMTP password. |

### Storage

| Variable | Required | Description |
| --- | --- | --- |
| `S3_ENDPOINT` | Yes | HTTPS endpoint for your bucket (Cloudflare R2, AWS S3, etc.). |
| `S3_REGION` | No | Bucket region (`auto` for R2). |
| `S3_ACCESS_KEY_ID` | Yes | Access key. |
| `S3_SECRET_ACCESS_KEY` | Yes | Secret key. |
| `S3_BUCKET` | Yes | Bucket name. |
| `S3_PUBLIC_BASE_URL` | Yes | Public CDN/base URL (also used in `next.config.ts`). |

> Keep `NEXTAUTH_SECRET`, `JWT_SECRET`, and `AUTH_SECRET` aligned. Never ship secrets with a `NEXT_PUBLIC_` prefix.

---

## Deployment Notes

1. **Provision infra** — Managed PostgreSQL, S3/R2 bucket, and SMTP provider reachable from your hosting environment.
2. **Mirror environment variables** — Add every `.env` entry to your platform’s secret store (Vercel, Docker, Kubernetes, etc.) and ensure `NEXTAUTH_URL` is HTTPS.
3. **Build & verify**
   ```bash
   npm run lint
   npm run build
   ```
   `prisma generate` runs during `npm install`, so production builds need dependencies installed.
4. **Seed (optional)**
   ```bash
   npx prisma db seed
   ```
   Useful for demo/QA environments.
5. **Launch**
   ```bash
   npm run start
   ```
   Use a process manager (PM2/systemd) when deploying to VMs/containers. On Vercel or similar, Socket.IO lives under `pages/api/socket.ts`, so choose a hosting plan that supports WebSockets.

---

## Useful Commands

- `npm run dev` — Start the Next.js dev server with hot reload.
- `npm run lint` — Run ESLint against the repo.
- `npm run build` — Create the production bundle (`next build`).
- `npm run start` — Serve the production build (`next start`).
- `npx prisma studio` — Inspect PostgreSQL data.
- `npx prisma migrate dev` / `npx prisma migrate deploy` — Apply schema changes locally or in production.

This README now reflects the actual single-tenant nature of the app, highlights the concrete modules in this repository, and documents how to configure, run, and deploy the platform end-to-end.
