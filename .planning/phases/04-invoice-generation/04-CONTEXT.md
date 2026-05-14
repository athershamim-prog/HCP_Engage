# Phase 4: Invoice Generation — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning
**Source:** Decisions carried forward from Phase 3 CONTEXT.md (D-01 through D-14); user context gathered 2026-05-14

<domain>
## Phase Boundary

Phase 4 delivers: PDF invoice generation for completed engagements with PoP attached; Cloudflare R2 write-once storage for invoice PDFs; engagement form updated to capture agreedRateUsd (per-unit rate agreed with HCP) and noOfActivities (number of sessions/activities) so total compensation is calculated correctly.

**In scope:**
- Rename `compensationUsd` → `agreedRateUsd` on the Engagement model (schema migration) and update all form labels and display references
- Add `noOfActivities` integer field to Engagement model (shown on form for per_hour/per_day rate types only)
- New `Invoice` DB table with unique engagementId constraint
- Server action to generate a fixed-layout PDF invoice using `@react-pdf/renderer v3` and upload to Cloudflare R2
- "Generate Invoice" button for Compliance (gated on status=completed AND popDocumentUrl set); "Download Invoice" for all roles once invoice exists
- PDF content: HCP full name/NPI/specialty, engagement type + proposed date, No of Activities (if applicable), agreed rate, total compensation

**Out of scope (deferred to v2):**
- CONT-01 (template upload/versioning)
- CONT-04 (Draft→Sent→Executed→Expired lifecycle stages)
- DocuSign e-signature (CONT-V2-01)
- In-app "Send to Finance" action — download + out-of-band send is sufficient
- Per-event rate type invoicing — flat_fee and per_event use agreedRateUsd as-is

</domain>

<decisions>
## Implementation Decisions

### Scope Reframe
- **D-01:** Phase 4 delivers an **invoice** (not a multi-party contract). CONT-01 (template upload/versioning) and CONT-04 (Draft→Sent→Executed→Expired lifecycle) are over-engineered for v1.
- **D-02:** CONT-02 is satisfied by a **fixed-layout PDF** generated server-side with `@react-pdf/renderer v3`. No template upload, no merge field syntax, no DOCX parsing.
- **D-03:** CONT-04 is satisfied by **existence tracking** only — the Invoice record either exists or does not. No status stages.

### Compensation Model (Engagement schema migration)
- **D-04:** `compensationUsd` on the `Engagement` model is renamed to `agreedRateUsd`. This is the per-unit rate agreed with the HCP (not the total compensation). Requires a Prisma migration and form/display label updates everywhere `compensationUsd` appears.
- **D-05:** New `noOfActivities` integer field added to the `Engagement` model. Field label on the form: **"No of Activities"**.
- **D-06:** Invoice total calculation:
  - Rate unit `per_hour` or `per_day`: `total = agreedRateUsd × noOfActivities`
  - Rate unit `flat_fee` or `per_event`: `total = agreedRateUsd` (noOfActivities field not shown on form; treated as 1 internally)
- **D-07:** Rate unit is derived from the FMV rate lookup (`FmvRate.rateUnit`). If no FMV rate is on file for the HCP+type combination, show a `rateUnit` selector (per_hour / per_day) defaulting to per_hour so the user can still specify a basis. flat_fee and per_event are excluded from the selector.

### Invoice Generation
- **D-08:** Generation trigger: Compliance can generate an invoice when the engagement is `completed` **and** `popDocumentUrl` is set (PoP is attached). The "Generate Invoice" button is gated on both conditions. Only the `compliance` role can trigger generation.
- **D-09:** Invoice is generated **once** per engagement and stored in Cloudflare R2. The DB record holds the R2 URL. Subsequent visits show "Download Invoice" — no regeneration path.
- **D-10:** "Send to Finance" = Compliance downloads the PDF and sends it externally. No in-app send action needed.

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
- **D-14:** New `Invoice` table: `id`, `engagementId` (unique — one invoice per engagement), `storageUrl`, `agreedRateUsd`, `noOfActivities` (nullable), `totalUsd`, `generatedByClerkId`, `generatedByName`, `generatedAt`. The unique constraint on `engagementId` enforces one-invoice-per-engagement at the DB level.

### Claude's Discretion Summary
- Rate basis fallback when no FMV rate on file (D-07): show a `rateUnit` selector (per_hour / per_day) defaulting to per_hour
- Invoice DB model structure (D-14): `Invoice` table with unique `engagementId` constraint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema
- `prisma/schema.prisma` — Engagement model to migrate (`compensationUsd` → `agreedRateUsd`, add `noOfActivities`); FmvRate model for `rateUnit` field reference; new `Invoice` table to add

### Roadmap & Project Context
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, and dependency on Phase 3
- `.planning/PROJECT.md` — project constraints and key decisions
- `.planning/REQUIREMENTS.md` — CONT-02 and CONT-03 are the v1 requirements for this phase (reframed per D-01 through D-03)

### Prior Phase Context
- `.planning/phases/03-contracts-polish/03-CONTEXT.md` — original decisions source (D-01 through D-14); PoP upload implementation decisions
- `.planning/phases/02-fmv-engagement/02-CONTEXT.md` — Engagement model decisions; FMV rate lookup pattern

### Phase 3 Implementation (understand before extending)
- `actions/engagement.ts` — all engagement Server Actions; follow same `assertRole` + `prisma.$transaction` pattern for the invoice generation action
- `app/(app)/engagements/[id]/page.tsx` — engagement detail page where invoice section is added
- `components/engagement/ActionPanel.tsx` — add "Generate Invoice" / "Download Invoice" buttons here
- `lib/fmv-lookup.ts` — `getFmvRate` returns rate including `rateUnit`; use this to determine whether to show `noOfActivities` field

### Environment Variables Required
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — Cloudflare R2 credentials; must be added to `.env.local` and documented in `.env.example`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@react-pdf/renderer v3` — already in the stack (package.json); use for fixed-layout invoice PDF generation (server-side React component rendered to buffer)
- `@aws-sdk/client-s3` — install for R2 upload (R2 is S3-compatible; use `PutObjectCommand` with `endpoint: https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`)
- `components/ui/card.tsx` — shadcn Card; use for invoice section on engagement detail page
- `components/ui/button.tsx` — reuse for "Generate Invoice" and "Download Invoice" actions
- `components/engagement/ActionPanel.tsx` — existing role+status-gated action panel; add invoice buttons following the established `useTransition` + server action pattern
- `lib/fmv-lookup.ts` — `getFmvRate` already returns rate data including `rateUnit`; call it to drive `noOfActivities` field visibility

### Established Patterns
- Server Actions in `actions/` with `assertRole()` guard and `prisma.$transaction` for writes — invoice generation action follows this pattern
- Server Components by default; client components only where needed
- Role enforcement: Compliance officer generates invoices — `assertRole(["compliance"])` on the generate action
- Prisma migrations: `npx prisma migrate dev` for schema changes

### Integration Points
- `Engagement.popDocumentUrl` (already on model) — invoice generation is gated on this being set
- `Engagement.status === "completed"` — second gate condition for invoice generation
- `FmvRate.rateUnit` — drives form field visibility for `noOfActivities` and invoice total calculation
- New `Invoice` table links to `Engagement` via unique `engagementId` FK
- `compensationUsd` appears in: `actions/engagement.ts`, `app/(app)/engagements/new/page.tsx` (or similar form component), `app/(app)/engagements/[id]/page.tsx`, any display components — all must be updated to `agreedRateUsd`

</code_context>

<specifics>
## Specific Ideas

- The engagement form should conditionally show "No of Activities" based on the FMV rate's `rateUnit`. When the rate panel shows a per_hour or per_day rate, the field appears. When flat_fee, per_event, or no rate, it does not appear.
- The invoice PDF should be clean and minimal — HCP details, engagement summary, financials (rate × activities = total). No branding or logo for v1.
- "Generate Invoice" button visible only to Compliance users when `status === "completed"` AND `popDocumentUrl` is set. Finance and Business users see "Download Invoice" (read-only) once invoice exists.
- The R2 upload should use a pre-signed URL pattern or direct SDK upload from the server action — never expose R2 credentials to the client.
- The `Invoice` record's `storageUrl` should be the public R2 URL that can be used to serve the PDF directly (or a path that the app proxies).

</specifics>

<deferred>
## Deferred Ideas

- Contract template upload/versioning (CONT-01) — fixed invoice format sufficient for v1
- 4-stage contract status lifecycle (CONT-04) — over-engineered for v1 invoice workflow
- DocuSign e-signature integration (CONT-V2-01) — already deferred to v2
- In-app "Send to Finance" action — download + out-of-band send is sufficient for v1
- Per-event rate type invoicing — excluded from v1; only per_hour and per_day support noOfActivities multiplier
- Invoice regeneration — write-once in v1; v2 can add a re-generate path if needed

</deferred>

---

*Phase: 4 — Invoice Generation*
*Context gathered: 2026-05-14*
