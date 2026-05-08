# Phase 2: FMV + Engagement - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers: FMV rate card upload with parsed preview and NUCC validation + engagement submission for 5 types with Draft→Submitted→Approved/Rejected→Completed status flow + single-approver review (Compliance or Finance role).

**In scope:** FMV rate card upload (Excel/CSV), NUCC taxonomy validation, rate card versioning with effective dates, FMV rate display at engagement creation, engagement form with 5 types, engagement status state machine, single-approver approve/reject flow

**Out of scope:** FMV enforcement/blocking (v2 — display only in v1), multi-step approval chains (v2), configurable engagement types (v2), DocuSign/e-signature (Phase 3+), contract generation (Phase 3)

</domain>

<decisions>
## Implementation Decisions

### FMV Rate Card Data Shape
- **D-01:** Rate card uses **state-level geography** with national fallback. Rows with `state = null` apply nationwide. When both a state-level and national rate exist for the same specialty + engagement type, the state-level rate wins (most specific wins).
- **D-02:** Excel/CSV layout is **flat rows** — one row per rate. Columns: `specialty_code` (NUCC code), `state` (2-letter abbreviation or blank for national), `engagement_type`, `rate_usd`, `rate_unit`. Parsed with SheetJS server-side.
- **D-03:** Rate unit is stored as a separate `rate_unit` column alongside `rate_usd`. Valid values: `per_hour`, `per_day`, `per_event`, `flat_fee`. This makes the rate card self-describing and the display at engagement creation unambiguous.
- **D-04:** NUCC taxonomy validation uses a **pre-seeded `NuccTaxonomy` table** (same fixture pattern as OIG LEIE and SAM.gov from Phase 1). Upload is rejected if any specialty_code in the file cannot be found in this table. Seeded with fixture data for v1; admin-managed refresh is v2.

### FMV Rate Card Versioning & Activation
- **D-05 (Claude's discretion):** Upload flow is a **page-level wizard**: upload file → server-side SheetJS parse → preview table (all rows, NUCC validation status per row) → explicit "Activate" button. Activation sets the `effectiveFrom` date (current datetime) and marks the prior active card as superseded (sets its `effectiveTo`). There is no automatic activation on upload — the admin must explicitly confirm after reviewing the preview.
- **D-06 (Claude's discretion):** A rate card version is immutable once activated. The raw uploaded file is not stored — only the parsed rows are persisted. Historical versions remain visible (FMV-05) via a version history list on the rate card management page.

### Engagement Form & Fields
- **D-07 (Claude's discretion):** All 5 engagement types share a **common base form**: HCP (lookup by name/NPI), engagement type selector, proposed date, proposed compensation amount, description/scope of work. No type-specific fields in v1 — one unified form for all types. The displayed FMV rate (FMV-04) appears as a read-only reference panel once HCP + engagement type are selected, shown for reference only.
- **D-08 (Claude's discretion):** **Draft = saved but not yet submitted.** A user can create a Draft and come back to edit and submit later. Only the creating user can edit their own Draft. Submitting transitions Draft → Submitted and locks the record.

### Engagement Status & Approval Flow
- **D-09:** V1 uses a **single approver** — any user with Compliance or Finance role can approve or reject a Submitted engagement. This is per ENG-03 (v1 requirement). The two-step Compliance → Finance sequence from Phase 1 D-05 is v2 scope (ENG-V2-01); it does not apply in Phase 2.
- **D-10 (Claude's discretion):** Approval queue: Submitted engagements appear in a shared queue visible to all Compliance and Finance users. No assignment/claiming mechanism in v1. Rejection requires a mandatory reason field (ENG-03).
- **D-11 (Claude's discretion):** The Completed transition is triggered manually by the submitting user after the engagement has occurred. Approved engagements show a "Mark as Completed" action.

### Claude's Discretion Summary
- Rate unit column (D-03): rate_usd + rate_unit is more precise for compliance display
- Activation model (D-05): explicit activate-after-preview matches compliance officer workflow
- Immutable parsed rows, no raw file storage (D-06): keeps storage simple for v1
- Unified engagement form for all 5 types (D-07): avoids per-type form complexity in v1
- Draft behavior (D-08): save-and-return is standard for complex forms
- Approval queue is shared/unassigned (D-10): sufficient for v1 single-approver model
- Completed is manual trigger by submitter (D-11): simple, matches how engagements actually close

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — FMV-01, FMV-02, FMV-03, FMV-04, FMV-05, ENG-01, ENG-02, ENG-03 are the v1 requirements for this phase

### Roadmap & Project Context
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and dependency on Phase 1
- `.planning/PROJECT.md` — project constraints, core value, and key decisions

### Prior Phase Context
- `.planning/phases/01-auth-hcp-management/01-CONTEXT.md` — role definitions (D-01 through D-14), approval flow awareness (D-05), HCP record anchor for engagement links

### Schema
- `prisma/schema.prisma` — Phase 1 schema; Phase 2 must extend it with FmvRateCard, FmvRate, NuccTaxonomy, and Engagement tables

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/table.tsx` — shadcn Table; reuse for rate card row preview, engagement list, approval queue
- `components/ui/badge.tsx` — shadcn Badge; follow HcpStatusBadge pattern for EngagementStatusBadge
- `components/ui/card.tsx` — shadcn Card; use for FMV rate reference panel at engagement creation
- `components/ui/pagination.tsx` — Link-based pagination; reuse for engagement list and rate card version list
- `components/shared/EmptyState.tsx` — reuse for empty engagement list and empty rate card states
- `components/shell/Sidebar.tsx` — add "FMV" and "Engagements" nav items following existing pattern

### Established Patterns
- Server Actions in `actions/` with validation helpers in `lib/` (see `lib/hcp-validation.ts` pattern)
- Server Components by default; client components only where interactivity is required (file input, form state)
- SheetJS (`xlsx`) is in the stack — parse Excel server-side in the Server Action, not client-side
- Role enforcement via `getEffectiveRoles()` from `lib/auth.ts` — apply same guard pattern to engagement write actions and approval actions
- NUCC taxonomy: same fixture seed pattern as `OigLeieRecord` / `SamGovRecord` in `prisma/seed.ts`

### Integration Points
- `Hcp` table (Phase 1) is the anchor — `Engagement` must have a `hcpId` foreign key
- `getEffectiveRoles()` must be used to gate: engagement creation (Business + Compliance), approval actions (Compliance + Finance)
- FMV rate lookup at engagement creation queries the active `FmvRateCard` → `FmvRate` rows filtered by HCP's `nuccCode` + engagement type + HCP's `primaryState` (with national fallback)

</code_context>

<specifics>
## Specific Ideas

- FMV rate lookup at engagement creation should show the rate as a read-only reference card: "FMV rate for [specialty] / [engagement type] / [state]: $350/hour". If no rate found, show "No FMV rate on file for this combination" — do not block submission.
- NUCC validation on upload should show a per-row status in the preview table (valid / unrecognized code) so the admin can see exactly which rows failed before deciding to fix the file or abort.

</specifics>

<deferred>
## Deferred Ideas

- FMV enforcement/blocking (FMV-V2-01) — display only in v1; blocking when proposed compensation exceeds rate is v2
- FMV rate snapshot onto engagement record at creation (FMV-V2-02) — v2; v1 displays rate for reference only
- Multi-step Compliance → Finance sequential approval (ENG-V2-01) — v2; v1 uses single approver
- Approval delegation with expiration (ENG-V2-02) — v2
- Configurable per-type engagement form fields (ENG-V2-03, ENG-V2-05) — v2
- Type-specific engagement form fields — not needed for v1; deferred if client requests
- Raw uploaded rate card file storage — not stored in v1; store parsed rows only

</deferred>

---

*Phase: 2 — FMV + Engagement*
*Context gathered: 2026-05-08*
