# Stack Research: HCP Engage

**Researched:** 2026-05-07
**Overall confidence:** MEDIUM-HIGH (Next.js verified via official docs; pharma-specific choices from domain knowledge; external API details from known public specs)

---

## Recommended Stack

### Frontend

**Recommendation: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui**

Next.js 15 is stable as of October 2024 with React 19 support. The App Router model (file-system routing, Server Components, Server Actions) is the right choice for a compliance SaaS for three specific reasons:

1. **Server Components render sensitive data server-side by default.** Spend figures, FMV rates, and HCP PII never touch the client bundle unless you opt in. This is the correct security posture for regulated data.
2. **Server Actions replace a traditional REST API for most mutation paths.** Approval submissions, engagement status updates, and comment threads are all Server Action calls — less surface area, no separate API layer to secure for internal operations.
3. **Middleware-based RBAC enforcement.** The Next.js Middleware (Proxy) layer runs before any route renders and can enforce role checks from session tokens without a round-trip. The official docs explicitly show this pattern for route-level protection.

React 19 is stable alongside Next.js 15. Use it.

**Why not Angular or Vue?** Compliance SaaS enterprise products have moved strongly toward React as the dominant choice. Angular carries significant framework churn history. Vue's ecosystem is thinner for the specific component libraries and auth integrations needed here.

**Why not a pure SPA (Vite + React)?** You lose SSR-enforced data access control, which matters for audit-readiness. A motivated attacker can inspect what a SPA fetches. Server Components prevent that category of exposure entirely.

**Component layer: shadcn/ui**
shadcn/ui (built on Radix UI primitives + Tailwind) is the correct choice for compliance tooling: accessible by default (WCAG 2.1 AA), unstyled at the primitive level so you control the output, and copy-pasted into your own codebase (no runtime dependency to break). It ships data tables, dialogs, command menus, forms, and badges — the exact components a workflow-heavy app needs. Do not use a pre-packaged component library like MUI or Ant Design for a compliance product; they carry opaque styling and accessibility assumptions that bite during client demos and accessibility audits.

**Form handling: React Hook Form v7 + Zod v3**
Engagement request forms, rate card upload forms, and HCP onboarding forms are complex (50+ fields, conditional sections, file attachments). React Hook Form handles this without re-render storms. Zod provides server-side schema validation that is shared between the Server Action and the client — the same schema validates the form and the database write. This eliminates validation drift between front and back end.

**Data tables: TanStack Table v8**
Spend tracking grids, HCP rosters, engagement queues — all need sorting, filtering, pagination, and export. TanStack Table is headless (works with shadcn/ui cells), TypeScript-native, and handles server-side pagination correctly. Do not use ag-Grid Community Edition for a v1; it adds licensing complexity and bundle weight before you know your table requirements.

---

### Backend

**Recommendation: Next.js 15 Route Handlers + Server Actions for the application layer; Node.js 20 LTS as runtime**

For v1 single-tenant, keep backend logic inside the Next.js application. The App Router's Route Handlers (verified from official docs) support all HTTP verbs with the Web Request/Response API. Server Actions handle mutations. This eliminates a separate backend service, deployment complexity, and the CORS/auth surface area that comes with a split architecture.

**Do not introduce a separate Express/Fastify/NestJS API service in v1.** The common mistake is to architect a distributed system before you have distributed scale. A monolithic Next.js app is the correct starting point; the data access layer (DAL) pattern (verified in official Next.js auth docs) provides clean internal boundaries that can be extracted to a separate service if v2 multi-tenant demands it.

**Language: TypeScript 5.x throughout** — frontend, backend logic, scripts, and migrations. No mixing.

**Validation: Zod v3** — schema-first validation used as the single source of truth. Define your domain schemas once (e.g., `EngagementRequestSchema`, `HcpProfileSchema`) and derive TypeScript types from them. Validate on input (form), on Server Action entry, and on database write.

**Background jobs: BullMQ v5 + Redis (Upstash for managed)**
Compliance checks (NPI verification, OIG/SAM.gov debarment) must not block request/response cycles. They run as background jobs triggered when an HCP record is created or updated. BullMQ is the production-grade Node.js job queue; it runs on Redis and handles retries, delays, and dead-letter queues. Upstash provides serverless Redis with per-request billing — correct for a v1 SaaS that is not yet at Redis-cluster scale.

Do not use Vercel's built-in Cron for compliance checks. Cron runs on a schedule; you need event-triggered, retriable jobs with audit logging of each run.

---

### Database

**Recommendation: PostgreSQL 16 (managed via Supabase or Neon) + Prisma ORM v5 + row-level audit triggers**

**PostgreSQL** is the only correct choice for a pharma compliance application. Reasons:

- JSONB columns for flexible per-client configuration (approval chains, engagement type definitions) without schema migrations for every client onboarding
- Native array types for multi-value fields (specialties, states, engagement categories)
- ACID transactions across multi-table writes (engagement record + spend line + audit log in one atomic operation)
- Audit trigger support: PostgreSQL triggers can write to an `audit_log` table on every INSERT/UPDATE/DELETE with old and new row data — this is the immutable audit trail pattern
- Row-level security (RLS) for the future multi-tenant isolation (v2 ready)

**Managed hosting: Neon (preferred over Supabase for v1)**
Neon is serverless PostgreSQL with per-branch databases — ideal for a dev/staging/production split without provisioning separate RDS instances. Supabase adds a realtime layer, auth, and storage that you will not use (you're using Clerk for auth, S3 for storage). Neon keeps the surface area minimal. Both are AWS-hosted (us-east-1) which covers the majority of pharma clients.

**ORM: Prisma v5**
Prisma's schema-first model generates TypeScript types from your database schema. For a compliance app with ~25-30 tables, Prisma gives you type-safe queries without writing raw SQL for 90% of operations. It supports migrations natively (`prisma migrate`), which produces a versioned migration history — critical for audit trail of schema changes.

Limitation to know: Prisma does not support PostgreSQL audit triggers natively. You must write those triggers in raw SQL migrations. This is the correct approach; triggers run inside the database transaction and cannot be bypassed by application bugs.

**Migrations: Prisma Migrate** — all migrations committed to source control. Never run `prisma db push` in production; always `prisma migrate deploy`.

**Schema design principles for this domain:**
- Every engagement record has a `status` enum with defined valid transitions (state machine, enforced at application layer)
- All financial amounts stored as integer cents (not decimal/float) to avoid floating-point rounding errors in aggregate Sunshine Act totals
- `hcp_id` is always the NPI number (10-digit string), not a surrogate auto-increment — this is the regulatory identity
- Soft deletes on HCP records and engagements (a `deleted_at` timestamp, not `DELETE` statements) — you cannot destroy records that may be subject to audit
- All tables include `created_at`, `updated_at`, `created_by_user_id` columns

---

### Key Libraries and Services

#### NPI Registry Verification

**API: CMS NPI Registry NPPES API v2.1**
- Base URL: `https://npiregistry.cms.hhs.gov/api/`
- Public REST API, no authentication required
- Query by NPI number: `?number=1234567890&version=2.1`
- Returns: provider name, credential, taxonomy (specialty), address, active/inactive status
- No SDK — write a thin typed wrapper in `lib/npi-registry.ts`
- Rate limit: not formally published; treat as best-effort public API, cache results in your database with a `npi_verified_at` timestamp, re-verify on a schedule (monthly)
- Confidence: HIGH (public government API, stable for years)

**Implementation pattern:**
```typescript
// lib/npi-registry.ts
const NPI_API_BASE = 'https://npiregistry.cms.hhs.gov/api/';

export async function verifyNpi(npiNumber: string): Promise<NpiVerificationResult> {
  const url = `${NPI_API_BASE}?number=${npiNumber}&version=2.1`;
  const res = await fetch(url, { next: { revalidate: 0 } }); // never cache compliance checks
  const data = await res.json();
  // data.results[0] contains the provider record
  // data.result_count === 0 means NPI not found
}
```

#### Debarment and Exclusion Checks

**OIG LEIE (List of Excluded Individuals/Entities)**
- Downloadable monthly CSV: `https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv`
- No real-time API — CMS publishes an updated CSV monthly
- Pattern: Download the full CSV via a scheduled job, import into your own `oig_exclusions` table in PostgreSQL, and query locally
- This gives you instant, auditable, reproducible exclusion checks with no external dependency at check time
- Include `exclusion_date`, `reinstatement_date`, `exclusion_type` columns
- Confidence: HIGH (standard approach used by commercial pharma compliance platforms)

**SAM.gov (System for Award Management) Exclusions**
- REST API: `https://api.sam.gov/entity-information/v3/entities`
- Requires free API key (register at SAM.gov)
- Query parameter: `exclusionStatusFlag=Y` combined with name or DUNS/UEI
- For individual HCPs: search by first name + last name + NPI cross-reference
- Also offers bulk extract (monthly ZIP file) — prefer bulk + local table for same reasons as OIG
- Confidence: MEDIUM (API is real and documented; the NPI-to-SAM.gov cross-reference matching requires fuzzy name matching logic, which is non-trivial)

**Combined exclusion check service:**
```typescript
// lib/exclusion-check.ts
export async function runExclusionCheck(hcpId: string): Promise<ExclusionCheckResult> {
  const [oigResult, samResult] = await Promise.all([
    checkOigExclusions(hcpId),
    checkSamExclusions(hcpId),
  ]);
  // Write audit record regardless of outcome
  await logExclusionCheck({ hcpId, oigResult, samResult, checkedAt: new Date() });
  return { excluded: oigResult.excluded || samResult.excluded, details: { oigResult, samResult } };
}
```

#### Approval Workflow Engine

**Recommendation: Custom state machine in PostgreSQL + BullMQ (do NOT use an embedded BPMN engine in v1)**

The approval workflow for HCP Engage is multi-level (manager → compliance → legal) but not arbitrarily complex. It does not require a full BPMN workflow engine (Camunda, Flowable, Conductor). Those tools carry significant operational overhead, XML DSL learning curve, and deployment complexity that is not justified for 3-5 approval steps.

**Implementation: Enum-driven state machine + approval_step table**

```sql
-- Engagement status state machine
CREATE TYPE engagement_status AS ENUM (
  'draft', 'submitted', 'pending_manager', 'pending_compliance',
  'pending_legal', 'approved', 'rejected', 'cancelled'
);

-- Per-client configurable approval chains
CREATE TABLE approval_chains (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL,
  engagement_type varchar NOT NULL,
  steps jsonb NOT NULL  -- [{ role: 'manager', required: true }, ...]
);

-- Approval decisions per engagement
CREATE TABLE approval_decisions (
  id uuid PRIMARY KEY,
  engagement_id uuid NOT NULL,
  step_order int NOT NULL,
  approver_role varchar NOT NULL,
  approver_user_id uuid,
  decision varchar,  -- 'approved' | 'rejected' | 'returned'
  decided_at timestamptz,
  notes text
);
```

A BullMQ job handles the notification side (email to next approver) when an engagement advances. The state transition logic lives in a Server Action, protected by RBAC checks on the user's role.

**If workflow complexity grows in v2:** Temporal.io (TypeScript SDK) is the correct escalation path. It handles long-running workflows, timeouts (engagement approval that expires after 30 days), compensation logic, and audit history natively. Do not start there; extract to Temporal if the state machine becomes unwieldy.

#### Document Generation (Contract Templates to PDF)

**Recommendation: React PDF (pdf-lib or @react-pdf/renderer) for template rendering; Puppeteer/Chromium for complex layouts**

For contract generation from templates with HCP data, FMV rates, and scope of work, there are two viable approaches:

**Option A (preferred): @react-pdf/renderer v3**
- Define contract templates as React components
- Render server-side to a PDF buffer in a Route Handler
- Returns the PDF as a `application/pdf` response for download or storage
- Works in Node.js runtime (not Edge Runtime)
- Limitation: Limited HTML-to-PDF fidelity; you write in a JSX subset (not arbitrary HTML/CSS)
- Best for: Structured, predictable contract layouts with clear sections

**Option B (for complex Word-like layouts): Puppeteer + headless Chromium**
- Render an HTML template in Chromium, export to PDF
- Full CSS support, pixel-perfect output
- Does not work on serverless (too large); requires a dedicated container/microservice or a service like Gotenberg
- Best for: Client-supplied Word template conversion requirements

**Recommendation: Start with @react-pdf/renderer for v1.** If clients bring Word-template requirements, evaluate Gotenberg (open-source Chromium microservice) as an add-on.

**Template storage: S3-compatible object storage (Cloudflare R2 or AWS S3)**
Store generated PDFs in object storage, not in PostgreSQL. Store the S3 object key in the database. Generated contracts are immutable once signed (even without e-signature in v1, treat them as immutable artifacts).

#### File Processing (Excel/CSV Rate Card Imports)

**Recommendation: xlsx (SheetJS) v0.18+ for parsing; Zod for row validation; BullMQ for async processing**

Rate card imports are:
- Client-uploaded Excel files (XLSX)
- Variable structure (client-specific column arrangements)
- Potentially large (thousands of specialty/geography combinations)
- Must fail atomically (all rows valid or none committed)

**Processing pattern:**
1. Client uploads XLSX via a Route Handler form POST
2. File stored in S3 immediately (raw artifact preserved for audit)
3. BullMQ job reads the S3 file, parses with SheetJS
4. Each row validated against `RateCardRowSchema` (Zod)
5. Valid import: atomic `prisma.$transaction()` to replace current rate card
6. Invalid import: detailed error report returned (row number, column, violation)

```typescript
import * as XLSX from 'xlsx';

function parseRateCardFile(buffer: Buffer): RateCardRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}
```

**Do not use Papa Parse (CSV-only) as the primary tool** — clients will inevitably send XLSX files. SheetJS handles both XLSX and CSV.

#### Authentication and Authorization

**Recommendation: Clerk (managed auth) for v1; migrate to self-hosted Auth.js / Keycloak in v2 if enterprise clients demand on-premises SSO**

The Next.js official docs list Clerk as a first-class auth library for Next.js applications. For a compliance SaaS targeting pharma/biotech companies:

**Why Clerk over rolling your own or using NextAuth.js:**
- Built-in SAML/SSO support: pharma clients will require SSO on day one (Okta, Azure AD, Ping Identity). Clerk supports SAML 2.0 and OIDC out of the box with no additional integration work.
- RBAC built in: Clerk's organization-level roles map cleanly to the compliance officer / manager / legal roles in HCP Engage
- MFA enforcement: Compliance environments require MFA. Clerk handles TOTP and SMS MFA without any custom code.
- Session management handled: No need to implement token rotation, session storage, or JWKS endpoints
- Audit logs of auth events: Clerk provides sign-in/sign-out audit logs at no additional work

**RBAC implementation:**
Define roles in Clerk's organization system:
- `compliance_officer` — full read/write, approval authority
- `manager` — submit engagements, approve at manager step
- `legal` — approve at legal step, read-only otherwise
- `finance` — read spend reports, export
- `admin` — system configuration, user management

Enforce roles in Next.js Middleware (verified from official docs): read the session token from the cookie, extract the role, and redirect unauthorized routes. Also enforce at the Server Action level and DAL level.

**What NOT to use for auth:**
- Rolling custom JWT auth: You will get session invalidation, key rotation, and CSRF wrong. These are not theoretical risks in compliance software.
- Supabase Auth: It couples your auth to your database vendor. Separate concerns.
- NextAuth.js v4: The v4 API is legacy. Auth.js (NextAuth v5) is the maintained version but is still in beta for SAML/enterprise SSO. Clerk is production-grade SAML today.

#### Audit Logging and Immutable Records

**Pattern: PostgreSQL audit trigger + append-only audit_log table + S3 archival**

Immutable audit trails are a regulatory requirement, not a feature. Every INSERT, UPDATE, and DELETE on regulated tables (`engagements`, `hcp_profiles`, `approval_decisions`, `spend_records`, `rate_cards`) must produce an audit record that cannot be modified by application code.

**Implementation:**
```sql
-- Audit log table (append-only — no UPDATE or DELETE permissions for app user)
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  table_name varchar NOT NULL,
  record_id uuid NOT NULL,
  operation varchar NOT NULL,  -- INSERT | UPDATE | DELETE
  old_data jsonb,
  new_data jsonb,
  changed_by_user_id uuid,
  changed_at timestamptz DEFAULT now() NOT NULL
);

-- Trigger function (runs inside DB transaction, cannot be bypassed)
CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, operation, old_data, new_data)
  VALUES (TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP,
          to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

The application database role should have no DELETE privilege on `audit_log`. A separate, more privileged role (for archival jobs only) can rotate old audit records to S3 (Parquet files) after 7 years for HIPAA-adjacent retention.

#### Cloud Deployment

**Recommendation: AWS (us-east-1) on ECS Fargate (or Railway for fast v1 launch) + CloudFront + S3**

Pharma compliance SaaS runs on AWS. It is the dominant cloud in regulated industries, holds the most pharma-specific compliance certifications (HIPAA BAA, FedRAMP, SOC 2), and is where clients' IT security teams have approved vendor agreements.

**For v1 fast launch: Railway**
Railway supports Next.js apps natively, connects to Neon PostgreSQL, manages environment variables, and deploys via git push. Zero infrastructure YAML to write. Correct choice to get a single-tenant v1 running quickly.

**For v1 with a real enterprise client: AWS ECS Fargate + ECR**
- Docker-containerized Next.js app (Node.js 20 LTS base image)
- ECS Fargate (no EC2 management, scales to zero between deployments)
- Neon or RDS PostgreSQL (RDS if the client requires data residency guarantees)
- CloudFront in front of the ALB for TLS termination and edge caching of static assets
- S3 for document/contract storage
- Upstash Redis (serverless) or ElastiCache Redis (if a managed Redis cluster is required)
- ACM for TLS certificates
- AWS WAF on the ALB for basic DDoS and SQL injection protection

**Do not deploy to Vercel for pharma clients.** Vercel's serverless model has stateless execution limits (10s-60s function timeouts on non-enterprise plans). BullMQ workers, OIG CSV imports, and PDF generation are all long-running operations that break under Vercel's execution model. More critically, enterprise pharma clients will require a BAA (Business Associate Agreement) for data handling — Vercel's enterprise tier supports this but adds cost and procurement complexity vs. AWS.

---

## What NOT to Use

| Category | Avoid | Reason |
|----------|-------|--------|
| Workflow engine | Camunda, Flowable, Activiti | Massive operational overhead; BPMN XML DSL; overkill for 3-5 step approval chains in v1 |
| ORMs | Drizzle ORM | Younger ecosystem; less mature migration tooling; Prisma is the safer choice for regulated data models |
| ORMs | TypeORM | Active Decorator-based pattern is problematic with Next.js Server Components; known N+1 issues; less TypeScript-friendly than Prisma |
| Database | MySQL / MariaDB | No native JSON column support as mature as PostgreSQL; weaker JSONB indexing; no partial indexes useful for engagement status queries |
| Database | MongoDB | Document stores make multi-table transaction integrity (audit log + engagement + spend in one atomic write) harder; not appropriate for financial compliance records |
| Auth | Rolling custom JWT | Session invalidation, key rotation, CSRF protection are all solved problems; do not re-solve them in a regulated context |
| PDF generation | html-pdf / wkhtmltopdf | Deprecated/unmaintained; security vulnerabilities in older WebKit |
| PDF generation | PDFKit (raw canvas API) | Too low-level for template-driven contract generation; results in unmaintainable layout code |
| Component library | Material UI (MUI) | Heavy bundle, opinionated theming that conflicts with compliance-neutral styling requirements; accessibility bugs in data grid |
| Component library | Ant Design | React 18+ compatibility issues historically; very opinionated styling; license considerations for commercial use |
| Hosting | Vercel (non-enterprise) | Serverless function timeouts incompatible with BullMQ workers, OIG CSV imports, PDF rendering; no HIPAA BAA on standard plans |
| Job queuing | Vercel Cron | Schedule-only, no event-driven triggering; no retry logic; no dead-letter queue; no job history for audit |
| State management | Redux / Zustand | Not needed; Server Components + Server Actions + React's built-in `useActionState` handle server state without a client store; adding a client state library creates a second source of truth |
| Testing | Enzyme | Deprecated; does not support React 18+ |

---

## Confidence Levels

| Recommendation | Confidence | Basis |
|----------------|------------|-------|
| Next.js 15 App Router | HIGH | Verified via official Next.js docs (version 16.2.5 doc index, blog/next-15) |
| React 19 | HIGH | Confirmed stable in Next.js 15 release notes |
| Clerk for auth + SAML | MEDIUM-HIGH | Listed in Next.js official auth docs; SAML capability from known Clerk product; not independently verified via Clerk docs in this session |
| PostgreSQL + Prisma | HIGH | Industry standard for compliance SaaS; Prisma widely documented |
| NPI Registry API | HIGH | Public government API, stable for years, base URL confirmed |
| OIG LEIE monthly CSV | HIGH | Standard industry approach, well-documented |
| SAM.gov exclusions API | MEDIUM | API exists and is documented; NPI-to-SAM matching logic complexity is a known challenge |
| BullMQ + Upstash Redis | MEDIUM-HIGH | BullMQ is widely used in Node.js ecosystems; Upstash specific tier limitations not verified in this session |
| @react-pdf/renderer | MEDIUM | Known library; specific v3 API stability not verified against current docs |
| SheetJS (xlsx) | HIGH | De facto standard for XLSX parsing in Node.js |
| Custom state machine (no BPMN) | HIGH | Domain judgment; BPMN overhead is well-documented in compliance platform post-mortems |
| AWS ECS Fargate for enterprise | HIGH | AWS dominates regulated pharma cloud; ECS Fargate is the serverless compute model without Vercel limitations |
| Railway for v1 launch | MEDIUM | Railway supports Next.js; suitability for single-tenant pharma client is a pragmatic judgment |
| Audit triggers in PostgreSQL | HIGH | Standard database pattern for immutable audit trails in regulated systems |

---

## Installation Reference

```bash
# Core application
npm install next@15 react@19 react-dom@19 typescript

# UI / forms
npm install @radix-ui/react-dialog @radix-ui/react-select tailwindcss
npm install react-hook-form zod @hookform/resolvers
npm install @tanstack/react-table

# ORM and database
npm install prisma @prisma/client
npx prisma init

# Auth
npm install @clerk/nextjs

# Background jobs
npm install bullmq ioredis

# Document generation
npm install @react-pdf/renderer

# Excel/CSV parsing
npm install xlsx

# Validation / utilities
npm install zod date-fns

# Dev dependencies
npm install -D @types/node @types/react @types/react-dom
npm install -D eslint eslint-config-next
npm install -D vitest @testing-library/react @testing-library/user-event
```

---

## Sources

- Next.js 15 official blog post: https://nextjs.org/blog/next-15 (verified: React 19 stable, Turbopack stable, version confirmed)
- Next.js authentication guide: https://nextjs.org/docs/app/guides/authentication (verified: Clerk listed as recommended auth library; DAL pattern; Middleware route protection)
- Next.js Route Handlers reference: https://nextjs.org/docs/app/api-reference/file-conventions/route (verified: full HTTP method support, Web Request/Response API)
- CMS NPI Registry API: https://npiregistry.cms.hhs.gov/api-page (public government API, no auth required)
- OIG LEIE exclusion list: https://oig.hhs.gov/exclusions/ (monthly CSV downloadable)
- SAM.gov entity information API: https://open.gsa.gov/api/sam/ (public GSA API documentation)
- Prisma ORM: https://www.prisma.io/docs (schema-first ORM, PostgreSQL support, migration tooling)
- BullMQ: https://docs.bullmq.io (Node.js job queue on Redis)
- SheetJS: https://sheetjs.com/docs (XLSX parsing)
- Clerk enterprise SSO: https://clerk.com/docs (SAML 2.0, OIDC, organization RBAC)
- Domain knowledge: Standard patterns from commercial pharma compliance platforms (Medidata, Veeva, Alanda equivalents); Sunshine Act (42 U.S.C. § 1320a-7h) reporting requirements
