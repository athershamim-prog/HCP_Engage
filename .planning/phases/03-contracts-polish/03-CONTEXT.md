# Phase 3: Contracts + Polish - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers: an invoice PDF generated from approved+completed engagements (with PoP attached) stored immutably in Cloudflare R2 + a schema change to the Engagement model renaming `compensationUsd` to `agreedRateUsd` and adding `noOfActivities` + a "No of Activities" field on the engagement form.

**In scope:** Invoice PDF generation (fixed layout, no template upload), Cloudflare R2 storage for generated PDFs, Engagement model migration (agreedRateUsd + noOfActivities), invoice generation trigger on the engagement detail page, invoice download action

**Out of scope:** Contract template upload/versioning (CONT-01 — eliminated in favour of fixed layout), merge field template system, 4-stage contract status lifecycle (CONT-04 — simplified to invoice exists/not exists), DocuSign e-signature (v2), email/send action within the app (Finance receives PDF out-of-band)

</domain>

<decisions>
## Implementation Decisions

### Scope Reframe vs. ROADMAP
- **D-01:** Phase 3 delivers an **invoice** (not a multi-party contract). CONT-01 (template upload/versioning) and CONT-04 (Draft→Sent→Executed→Expired lifecycle) are over-engineered for v1. The user confirmed: "I just need an invoice when compliance sends this to Finance for payment."
- **D-02:** CONT-02 is satisfied by a **fixed-layout PDF** generated server-side with `@react-pdf/renderer v3`. No template upload, no merge field syntax, no DOCX parsing.
- **D-03:** CONT-04 is satisfied by **existence tracking** only — the Invoice record either exists or does not. No status stages.

### Compensation Model (Engagement schema migration)
- **D-04:** `compensationUsd` on the `Engagement` model is renamed to `agreedRateUsd`. This is the per-unit rate agreed with the HCP (not the total compensation). Requires a Prisma migration and form label update.
- **D-05:** New `noOfActivities` integer field added to the `Engagement` model. Field label on the form: **"No of Activities"**.
- **D-06:** Invoice total calculation:
  - Rate unit `per_hour` or `per_day`: `total = agreedRateUsd × noOfActivities`
  - Rate unit `flat_fee` or `per_event`: `total = agreedRateUsd` (noOfActivities field not shown on form)
- **D-07:** Rate unit is derived from the FMV rate lookup (`FmvRate.rateUnit`). If no FMV rate is on file for the HCP+type combination, Claude decides the fallback (likely show a rate basis selector defaulting to `per_hour`).

### Invoice Generation
- **D-08:** Generation trigger: Compliance can generate an invoice when the engagement is `completed` **and** `popDocumentUrl` is set (PoP is attached). The "Generate Invoice" button is gated on both conditions.
- **D-09:** Invoice is generated **once** per engagement and stored in Cloudflare R2. The DB record holds the R2 URL. Subsequent visits to the engagement detail page show a "Download Invoice" button pointing to the stored PDF — no regeneration.
- **D-10:** "Send to Finance" = Compliance downloads the PDF and sends it externally (email, etc.). No in-app send action is needed.

### Invoice PDF Content (fixed layout)
- **D-11:** Fixed fields on the invoice PDF:
  - HCP: full name, NPI, NUCC specialty
  - Engagement: type, proposed date
  - Financials: No of Activities (if applicable), agreed rate (per hour/day), total compensation
  - No submitter/approver names, no PoP reference, no company logo in v1

### Cloud Storage
- **D-12:** Cloud storage provider: **Cloudflare R2** (S3-compatible API, no egress fees). PDF objects are write-once — no overwrite path exposed through the application (CONT-03 satisfied).
- **D-13:** R2 bucket path: `invoices/{engagementId}/{timestamp}.pdf` — one PDF per engagement, timestamp makes the key unique if a re-generation path is added in v2.

### Invoice DB Model
- **D-14 (Claude's discretion):** New `Invoice` table: `id`, `engagementId` (unique — one invoice per engagement), `storageUrl`, `agreedRateUsd`, `noOfActivities` (nullable), `totalUsd`, `generatedByClerkId`, `generatedByName`, `generatedAt`. The unique constraint on `engagementId` enforces one-invoice-per-engagement at the DB level.

### Claude's Discretion Summary
- Rate basis fallback when no FMV rate on file (D-07): show a `rateUnit` selector (per_hour / per_day) defaulting to per_hour
- Invoice DB model structure (D-14): `Invoice` table with unique `engagementId` constraint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — CONT-01, CONT-02, CONT-03, CONT-04 are the v1 requirements for this phase (note: scope is reframed per D-01 through D-03 above — read decisions before interpreting requirements literally)

### Roadmap & Project Context
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, and dependency on Phase 2
- `.planning/PROJECT.md` — project constraints, core value, and key decisions

### Prior Phase Context
- `.planning/phases/02-fmv-engagement/02-CONTEXT.md` — Engagement model decisions (D-07 common form fields, D-08 draft/submit behaviour, D-11 completed trigger); FMV rate lookup pattern (D-01 state-level + national fallback)

### Schema
- `prisma/schema.prisma` — Engagement model to migrate (`compensationUsd` → `agreedRateUsd`, add `noOfActivities`); FmvRate model for `rateUnit` field reference

### Phase 2 Implementation (understand before extending)
- `actions/engagement.ts` — all 6 engagement Server Actions; follow same `assertRole` + `prisma.$transaction` pattern for the invoice generation action
- `app/(app)/engagements/[id]/page.tsx` — engagement detail page where invoice section is added
- `components/engagement/ActionPanel.tsx` — add "Generate Invoice" / "Download Invoice" buttons here
- `lib/fmv-lookup.ts` — `getFmvRate` returns rate including `rateUnit`; use this to determine whether to show `noOfActivities` field

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@react-pdf/renderer v3` — already in the stack; use for fixed-layout invoice PDF generation (server-side React component)
- `components/ui/card.tsx` — shadcn Card; use for invoice preview/download section on engagement detail page
- `components/ui/button.tsx` — reuse for "Generate Invoice" and "Download Invoice" actions
- `components/engagement/ActionPanel.tsx` — existing role+status-gated action panel; add invoice buttons here following the established `useTransition` + server action pattern
- `lib/fmv-lookup.ts` — `getFmvRate` already returns rate data including `rateUnit`; call it to drive `noOfActivities` field visibility

### Established Patterns
- Server Actions in `actions/` with `assertRole()` guard and `prisma.$transaction` for writes — invoice generation action follows this pattern
- Server Components by default; client components only where needed (invoice download button may need `onClick` handler)
- Role enforcement: Compliance officer generates invoices — `assertRole(["compliance"])` on the generate action
- Prisma migrations: `npx prisma migrate dev` for schema changes (rename `compensationUsd`, add `noOfActivities`, add `Invoice` table)

### Integration Points
- `Engagement.popDocumentUrl` (already on model) — invoice generation is gated on this being set
- `Engagement.status === "completed"` — second gate condition for invoice generation
- `FmvRate.rateUnit` — drives form field visibility for `noOfActivities`
- New `Invoice` table links to `Engagement` via unique `engagementId` FK
- Cloudflare R2: needs `@aws-sdk/client-s3` (R2 is S3-compatible) + R2 env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`)

</code_context>

<specifics>
## Specific Ideas

- The engagement form should conditionally show "No of Activities" based on the FMV rate's `rateUnit`. When the rate panel shows a per_hour or per_day rate, the field appears. When flat_fee or no rate, it does not.
- The invoice PDF should be clean and minimal — HCP details, engagement summary, financials (rate × activities = total). No branding or logo for v1.
- "Generate Invoice" button should only be visible to Compliance users and only when `status === "completed"` and `popDocumentUrl` is set. Finance and Business users see "Download Invoice" (read-only) once it exists.

</specifics>

<deferred>
## Deferred Ideas

- Contract template upload/versioning (CONT-01) — fixed invoice format is sufficient for v1; uploadable templates are v2 scope if clients require customisation
- 4-stage contract status lifecycle (CONT-04: Draft → Sent → Executed → Expired) — over-engineered for v1 invoice workflow; add in v2 if Finance requires formal lifecycle tracking
- DocuSign e-signature integration (CONT-V2-01) — already deferred to v2 in REQUIREMENTS.md
- In-app "Send to Finance" action (email notification, in-app queue) — download + out-of-band send is sufficient for v1
- Per-event rate type invoicing — excluded from v1 scope; only per_hour and per_day support noOfActivities multiplier

</deferred>

---

*Phase: 3 — Contracts + Polish*
*Context gathered: 2026-05-14*
