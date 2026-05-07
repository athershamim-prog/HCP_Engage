# Roadmap: HCP Engage

## Overview

Three phases carry HCP Engage from zero to a working compliance platform. Each phase closes a complete, usable capability: users can log in and manage HCPs after Phase 1, run engagements through a simple approval workflow after Phase 2, and generate PDF contracts after Phase 3.

**Milestone:** v1.0 — Core Compliance Platform (Simplified)
**Total Phases:** 3
**Requirements:** 17 v1 requirements

---

## Phases

- [ ] **Phase 1: Auth + HCP Management** - Role-based access (3 roles) and full HCP onboarding with NPI lookup and manual debarment check
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
**Plans:** TBD

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
**Plans:** TBD

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
| 1. Auth + HCP Management | 0/TBD | Not started | - |
| 2. FMV + Engagement | 0/TBD | Not started | - |
| 3. Contracts + Polish | 0/TBD | Not started | - |
