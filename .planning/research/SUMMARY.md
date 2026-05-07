# Research Summary: HCP Engage

**Project:** HCP Engage — Pharma Commercial Compliance Platform
**Domain:** HCP Engagement Management / Sunshine Act (Open Payments) Compliance
**Researched:** 2026-05-07
**Confidence:** MEDIUM-HIGH

---

## Executive Summary

HCP Engage is a regulated compliance SaaS in the pharma HCP engagement management category, replacing Alanda/Medcompli for a single US-market client. The domain is well-specified: CMS Open Payments (Sunshine Act) defines the disclosure data model precisely, OIG and SAM.gov define the exclusion check requirements, and NUCC taxonomy codes define the canonical specialty vocabulary. Research across stack, features, architecture, and pitfalls converges on a clear build approach. This is not a product where you experiment — the regulatory requirements are published and auditors expect specific artifacts.

The recommended architecture is a monolithic Next.js 15 application (App Router, Server Components, Server Actions) backed by PostgreSQL on Neon, with BullMQ for background compliance jobs and Clerk for auth with SAML/SSO included. The data model must be tenant-aware from day one even in single-tenant v1. The audit trail must be append-only from the first database migration — it cannot be retrofitted. FMV rate cards must be immutably versioned from the first upload. These three decisions are non-negotiable Phase 1 investments; every other architectural choice flows from them.

The highest-risk phase is HCP onboarding and FMV data model, because errors there compound across every downstream feature. The second-highest risk is the Open Payments export, because CMS validation rules are detailed and change annually. The happy paths are straightforward; the edge cases — debarment false negatives, approval routing loops, aggregate spend threshold retroactive reclassification, NPI taxonomy drift — are where competitors underdeliver and where this platform must be correct.

---

## 1. Recommended Stack

| Technology | Role | Why This Choice |
|---|---|---|
| Next.js 15 (App Router) | Full-stack framework | Server Components prevent PII from reaching client bundles; Middleware-RBAC before any route renders |
| React 19 + TypeScript 5 | UI + type safety | Stable with Next.js 15; TypeScript throughout |
| Tailwind CSS v4 + shadcn/ui | Component layer | WCAG 2.1 AA accessible primitives; ships data tables, dialogs, forms |
| React Hook Form v7 + Zod v3 | Forms + validation | Shared schema validates form and DB write — eliminates validation drift |
| TanStack Table v8 | Data grids | Headless, server-side pagination, TypeScript-native |
| PostgreSQL 16 on Neon | Primary database | ACID across audit + domain writes; JSONB for config; native RLS for v2 multi-tenancy |
| Prisma v5 | ORM | Schema-first, typed queries, versioned migrations committed to source control |
| PostgreSQL audit triggers (raw SQL) | Immutable audit trail | Fire inside DB transaction — cannot be bypassed by application bugs |
| Clerk | Auth + RBAC + SSO | SAML 2.0/OIDC out of the box (pharma clients require Okta/Azure AD); MFA enforcement |
| BullMQ v5 + Upstash Redis | Background jobs | NPI re-validation, OIG CSV import, debarment scheduling — retriable with dead-letter queue |
| SheetJS (xlsx) | Rate card parsing | Handles XLSX and CSV; de facto standard for Node.js Excel parsing |
| @react-pdf/renderer v3 | Contract PDF generation | Server-side; no Chromium binary required for v1 structured layouts |
| AWS ECS Fargate (Railway for early launch) | Hosting | AWS dominates regulated pharma; ECS avoids Vercel serverless timeouts that break BullMQ workers |
| AWS S3 / Cloudflare R2 | Artifact storage | Generated contracts, rate card uploads, OIG CSV archives — immutable blobs, per-tenant path prefix |

**Do not use:** Vercel standard plans (serverless timeouts break BullMQ), MongoDB (no cross-table ACID for audit writes), Camunda/BPMN engines (overkill for 3-5 step chains), MUI/Ant Design (accessibility debt), TypeORM (N+1 issues), Redux/Zustand (Server Actions replace client state stores).

---

## 2. Table Stakes Features

Must ship in v1 or the platform is unusable and non-compliant.

**HCP Data**
- NPI lookup + validation via CMS NPPES API
- HCP profile: name, credentials, specialty (NUCC taxonomy code), primary state, HCO affiliation
- HCP status (active / inactive / suspended / do-not-engage) with logged transitions
- Debarment check result: OIG LEIE + SAM.gov, check date, database version, result, match details
- Consent record: version, timestamp, collection method

**FMV**
- Rate card upload (Excel/CSV) with parsed preview before commit
- Immutable rate card versioning: `effective_from` / `effective_to` on each version — rows never overwritten
- Rate snapshot onto every engagement at creation time (`rate_card_version_id` + `rate_amount`)
- FMV rate lookup by HCP specialty + geography + engagement type
- FMV ceiling flag when proposed compensation exceeds rate; mandatory justification when above-rate

**Engagement Lifecycle**
- Engagement request form with fields configurable per engagement type
- Five engagement types: advisory board, speaker program, investigator, meal/TOV, training
- Configurable multi-level approval workflow driven by per-tenant config
- Full status state machine as named transitions: Draft → Submitted → Under Review → Approved → Contracted → Completed → (Cancelled / Rejected)
- Delegation with mandatory expiration date, attributed separately in audit log

**Contracts**
- Contract template management with version tracking
- Variable substitution from HCP + engagement + FMV snapshot; optional field handling explicit
- PDF generation stored as immutable rendered artifact
- Contract status tracking (draft → sent → executed → expired)

**Spend and Disclosure**
- TOV recording linked to engagement: category, amount, date, Sunshine Act nature-of-payment mapping
- Aggregate spend per HCP per program year with retroactive reportability reclassification when threshold crossed
- Open Payments export with all CMS required fields, pre-submission validation replicating CMS rules locally
- De minimis threshold configurable by reporting year (not hardcoded)

**Audit and Admin**
- Append-only audit log from migration 1: before/after state, actor as strings + FK, server timestamps, SHA-256 checksum; separate DB schema with write-only role
- Five roles: admin, compliance officer, manager, legal, finance
- Engagement type and approval chain configuration editable from admin UI without code deploys

**Deferred to v2+:** E-signature, HCO direct engagement, European frameworks, mobile app, payment processing, state-level gift law reporting.

---

## 3. Critical Architecture Decisions

Six decisions that, if wrong, require painful rewrites. All are Phase 1 decisions.

**Decision 1 — tenant_id on every table from day one**
Every table gets a non-nullable `tenant_id` column populated with a single constant in v1. PostgreSQL RLS policies enabled with trivially-true policy in v1; real enforcement in v2 without application code changes. File storage paths use `/{tenant_id}/` prefix. Cost now: near zero. Retrofit cost: platform-level rewrite.

**Decision 2 — Append-only audit log in a separate schema with a write-only DB role**
Application's main DB role has no UPDATE or DELETE on `audit.event`. Triggers in raw SQL migrations fire inside DB transactions and cannot be bypassed. Every row stores a SHA-256 checksum. Actor identity stored as strings (name, title, email) alongside the FK — self-contained after user deactivation. Auditors expect specific artifacts; this is non-negotiable.

**Decision 3 — FMV rate card immutable versioning**
Rate rows are never overwritten. Uploads create new `FMV_RATE_CARD` records with `effective_from` / `effective_to`. Rate snapshotted onto engagement at creation. Contract generation reads from snapshot only — never from "current" rate card.

**Decision 4 — Configuration as versioned database records, not environment variables**
Approval chain configs, engagement type definitions, and policy settings live in the database scoped by `tenant_id` with `config_version` history. Admin UI changes create new config versions; old versions retained. Config changes are auditable. Safe for v2 multi-tenancy without migrating constants out of deployment configs.

**Decision 5 — Engagement state machine fully specified before any code is written**
All states and valid transitions defined in a state transition diagram before implementation. Transitions are named operations (not direct field updates) so each carries an audit entry. Any substantive edit to an in-flight engagement resets the approval chain with an audit entry.

**Decision 6 — Specialty stored as NUCC taxonomy code throughout**
FMV rate card, NPPES registry, and CMS Open Payments submission must all agree on specialty. NUCC codes are the canonical identifier at every layer. Display names derived at render time. Rate card upload validates specialty values against a local NUCC taxonomy reference table.

---

## 4. Top 5 Pitfalls

**Pitfall 1 (CRITICAL) — Audit trail incompleteness**
Logging `status_changed_to: approved` is not enough. Auditors ask: what data was the approver shown? What was the FMV rate? A user FK becomes unresolvable when the user is deactivated.
Prevention: Audit entries are self-contained — store actor name/title/email as strings alongside FK; snapshot approval-context data at each step; mandatory written justification for all FMV overrides. Design in Phase 1, wire through every phase.

**Pitfall 2 (CRITICAL) — FMV rate card versioning failure**
Replacing rate cards without versioning means historical engagements cannot be audited against the rate in effect at contract time.
Prevention: Immutable rate rows with effective dates; snapshot rate at engagement creation; contract generation reads from snapshot only. Phase 1 data model — cannot be retrofitted.

**Pitfall 3 (CRITICAL) — Open Payments submission structural errors**
CMS rejects for: covered recipient type mismatch, wrong nature-of-payment category, de minimis threshold misapplied (especially retroactive annual aggregate), and NPPES drift causing NPI + name mismatches.
Prevention: Map the full CMS data dictionary before building the export. Pre-submission validation replicates CMS rules locally. De minimis thresholds are system config by year. Validate current-year spec before Phase 5 starts.

**Pitfall 4 (HIGH) — Debarment false negatives from name matching**
OIG LEIE and SAM.gov name matching produces false negatives. Debarment is not a one-time gate — OIG can add an individual mid-engagement.
Prevention: NPI as primary match key. Multi-signal match: NPI + name soundex + DOB — require 2-of-3 to flag. Store check timestamp, database version, and match signals. Monthly re-check for all active HCPs; mandatory re-check before each contract generation.

**Pitfall 5 (HIGH) — Approval workflow routing failures**
Circular delegation, missing approver (deactivated with no fallback), self-approval ambiguity, and config changes mid-flight all occur in production.
Prevention: Cycle detection at delegation save time. Every step requires a fallback role or escalation path. Delegations require mandatory expiration dates. Lock workflow config snapshot onto engagement at submission. Build admin emergency-advance tool requiring a reason field with permanent audit entry.

---

## 5. Build Order

**Phase 1 — Foundation**
DB schema with `tenant_id` on every table + audit schema with write-only DB role + PostgreSQL audit triggers. Clerk auth with five roles. Config schema + loader with version history. NUCC taxonomy reference table. File storage with per-tenant path prefix convention.

**Phase 2 — HCP Management + FMV**
HCP onboarding state machine, NPI verification (NPPES API), OIG LEIE (monthly CSV → local table, NPI-first matching), SAM.gov (API check + cache). Debarment match review workflow. FMV rate card upload (SheetJS), preview, NUCC validation, immutable versioning. NPI re-validation job (90-day). Debarment re-check scheduler (monthly).

**Phase 3 — Engagement Lifecycle + Approval**
Engagement submission, FMV ceiling enforcement, debarment TTL gate. Approval Engine: read chain config, instantiate steps, conditional step evaluation, advance/reject/cancel/delegate. Notification service (email on step activation). Admin emergency-advance tool.

**Phase 4 — Contract Generation**
Template management with version tracking. Contract Service: select template, merge HCP + engagement + FMV snapshot fields, generate PDF, store as immutable blob in S3, link CONTRACT record with merge data snapshot.

**Phase 5 — Spend Tracking + Open Payments Export**
TOV recording with Sunshine Act nature-of-payment mapping. Aggregate spend with retroactive reportability reclassification. Pre-submission validation against CMS rules. Open Payments CSV in current CMS format. Spend dashboard and HCP-level running totals.

**Phase 6 — Operations + Polish**
Background job infrastructure (BullMQ workers with retry + dead-letter). Admin UI for config editing without code deploys. Audit viewer (per-entity event timeline, filtered export built from audit log). Performance hardening. RLS policy enforcement for v2 readiness.

---

## 6. Open Questions

| Question | Resolve Before | Impact If Deferred |
|---|---|---|
| Current CMS Open Payments de minimis threshold and data dictionary for current reporting year? | Phase 5 starts | Export built against wrong spec; CMS rejection at submission |
| What rate card format(s) does the first client use — column headers, specialty naming, geography tier definitions? | Phase 2 starts | Normalization layer under-engineered; breaks on first real file |
| Does the first client require SAML SSO on day one, or is email/password + MFA acceptable for v1? | Phase 1 starts | Clerk org configuration differs; late SAML integration is disruptive |
| What approval chain configurations does the first client run — how many levels, what threshold conditions? | Phase 3 starts | Config schema designed around wrong assumptions |
| Are contract templates built fresh in JSX, or converted from existing Word/DOCX templates? | Phase 4 starts | @react-pdf/renderer vs. Gotenberg/Chromium decision depends on this |
| Does the first client require physical DB isolation or is logical RLS isolation contractually acceptable? | Phase 1 starts | DB-per-tenant requires different deployment architecture |
| Does the first client use a third-party debarment screening vendor or expect in-house OIG/SAM matching? | Phase 2 starts | Third-party API vs. building name-matching logic — very different complexity |
| What is the target go-live date? | Immediately | Phase sequencing and scope decisions depend on this |

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Next.js 15 and core libraries verified against official docs |
| Features | MEDIUM-HIGH | CMS Open Payments data model publicly documented; de minimis threshold changes annually — validate against current program year |
| Architecture | HIGH | RLS and audit trigger patterns are established compliance SaaS |
| Pitfalls | MEDIUM-HIGH | Open Payments and OIG pitfalls are documented regulatory requirements; competitor failure modes are pattern-based |

**Overall: MEDIUM-HIGH.** The domain is well-specified; uncertainty is in current-year CMS details and first-client-specific configuration, not in the approach.

---

*Research completed: 2026-05-07*
*Ready for roadmap: yes*
