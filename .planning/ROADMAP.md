# Roadmap: HCP Engage

## Overview

Three phases carry HCP Engage from zero to a working compliance platform. Each phase closes a complete, usable capability: users can log in and manage HCPs after Phase 1, run engagements through a simple approval workflow after Phase 2, and generate PDF contracts after Phase 3.

**Milestone:** v1.0 — Core Compliance Platform (Simplified)
**Total Phases:** 3
**Requirements:** 17 v1 requirements

---

## Phases

- [x] **Phase 1: Auth + HCP Management** - Role-based access (3 roles) and full HCP onboarding with NPI lookup and manual debarment check
- [ ] **Phase 2: FMV + Engagement** - Rate card upload and display, engagement submission with simple status flow and single approval
- [ ] **Phase 3: Contracts + Polish** - PDF contract generation from templates, cloud storage, contract status tracking

---

## Phase Details

### Phase 1: Auth + HCP Management
**Goal:** Users can log in with one of three roles, and compliance officers can onboard and manage HCPs with NPI verification and manual debarment checks.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** AUTH-01, HCP-01, HCP-02, HCP-03, HCP-04
**Success Criteria** (what must be TRUE):
  1. A Business user, Compliance officer, and Finance user can each log in and see only the routes and actions permitted by their role — cross-role access is blocked.
  2. A compliance officer can look up an HCP by NPI and see their canonical name, credentials, NUCC specialty, primary state, and HCO affiliation pulled from NPPES.
  3. A compliance officer can manually trigger a debarment check against OIG LEIE and SAM.gov, view the results, and record a determination with a written rationale.
  4. A compliance officer can set an HCP's status (active / inactive / suspended / do-not-engage) with a mandatory reason; the full status history is visible on the HCP profile.
**Plans:** 4 plans

Plans:

**Wave 1**
- [x] 01-PLAN-skeleton.md — Walking skeleton: Next.js scaffold + Clerk auth + Prisma schema (all 7 tables) + role-gated app shell

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-PLAN-hcp-directory.md — HCP Directory + NPI Lookup: NPPES API client, addHcp Server Action, filterable HCP table

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-PLAN-hcp-profile.md — HCP Profile + Debarment Check: full profile page, debarment logic against local tables, determination recording

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-PLAN-hcp-status.md — HCP Status Management: Set Status panel, setHcpStatus Server Action, status history wired into profile

**Cross-cutting constraints:**
- All plans: Prisma models from `prisma/schema.prisma` (Wave 1) must exist before any DB operations
- All plans: `lib/auth.ts` role definitions and `getEffectiveRoles()` established in Wave 1
- hcp-profile and hcp-status: Both operate within `app/(app)/hcps/[id]/page.tsx`; hcp-profile creates it, hcp-status extends it

### Phase 2: FMV + Engagement
**Goal:** Admins can upload and version FMV rate cards, and users can submit engagement requests that route to a single approver for approval or rejection.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** FMV-01, FMV-02, FMV-03, FMV-04, FMV-05, ENG-01, ENG-02, ENG-03
**Success Criteria** (what must be TRUE):
  1. An admin can upload an FMV rate card (Excel/CSV), see a parsed preview, and the system rejects any upload where specialty values cannot be matched to NUCC taxonomy codes.
  2. When a new rate card is activated it supersedes the prior version; a user can view all historical versions.
  3. At engagement creation, the system displays the applicable FMV rate for the HCP by specialty + geography + engagement type — shown for reference, submission is not blocked.
  4. A user can submit an engagement request for any of the five engagement types (advisory board, speaker program, investigator/research, meal/TOV, training).
  5. An engagement moves through four stages: Draft → Submitted → Approved/Rejected → Completed; a Compliance or Finance user can approve or reject a submitted engagement, with rejection requiring a reason.
**Plans:** 5 plans

Plans:

**Wave 1**
- [ ] 02-01-PLAN.md — Foundation: schema extensions (NuccTaxonomy, FmvRateCard, FmvRate, Engagement, EngagementStatusHistory) + npx prisma db push + SheetJS install + shadcn Skeleton/AlertDialog + route permissions + sidebar nav + Wave 0 test stubs

**Wave 2** *(blocked on Wave 1 completion — Plans 02 and 03 run in parallel)*
- [ ] 02-02-PLAN.md — FMV upload vertical slice: lib/fmv-parser.ts + parseRateCardAction + activateRateCardAction + /fmv/page.tsx list + /fmv/upload wizard with NUCC validation preview
- [ ] 02-03-PLAN.md — FMV detail + lookup APIs: lib/fmv-lookup.ts + /fmv/[id] detail page + /api/fmv/rate + /api/hcps/search

**Wave 3** *(blocked on Wave 2 completion — Plans 04 and 05 are sequential)*
- [ ] 02-04-PLAN.md — Engagement form vertical slice: lib/engagement-validation.ts + createEngagement + submitEngagement + HcpSearchInput + FmvRatePanel + EngagementForm + /engagements/page.tsx list + /engagements/new
- [ ] 02-05-PLAN.md — Engagement lifecycle: approve + reject + complete + delete actions + /engagements/[id] detail + ActionPanel + /engagements/queue + human verification checkpoint

**Cross-cutting constraints:**
- Plans 02–05: All depend on Wave 1 schema push completing (Engagement, FmvRateCard tables must exist)
- Plans 04–05: Depend on /api/fmv/rate and /api/hcps/search from Plan 03
- Plan 05: Depends on createEngagement + submitEngagement from Plan 04
- All plans: assertRole() from lib/auth.ts enforces role gates on every write action

### Phase 3: Contracts + Polish
**Goal:** Compliance officers can generate PDF contracts from templates, store them immutably, and track each contract through its lifecycle.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** CONT-01, CONT-02, CONT-03, CONT-04
**Success Criteria** (what must be TRUE):
  1. A compliance officer can upload a contract template, assign it to one or more engagement types, and the system versions templates so previous versions remain accessible.
  2. For an approved engagement, the system generates a PDF contract with HCP profile fields, engagement scope, and the displayed FMV rate merged in — optional fields are explicitly marked as not applicable when absent.
  3. A generated PDF is stored in cloud storage and cannot be overwritten through the application.
  4. A compliance officer can track contract status through four stages: Draft → Sent → Executed → Expired.
**Plans:** TBD

---

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth + HCP Management | 4/4 | Complete | 2026-05-08 |
| 2. FMV + Engagement | 0/5 | Not started | - |
| 3. Contracts + Polish | 0/TBD | Not started | - |
