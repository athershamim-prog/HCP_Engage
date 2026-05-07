# Roadmap: HCP Engage

## Overview

Five phases carry HCP Engage from bare infrastructure to a fully compliant HCP engagement platform. Each phase closes a complete, verifiable capability: compliance officers can log in and govern access after Phase 1, onboard and vet HCPs after Phase 2, run engagements through approval workflows after Phase 3, generate and execute binding contracts via DocuSign after Phase 4, and operate the platform reliably day-to-day after Phase 5.

**Milestone:** v1.0 — Core Compliance Platform
**Total Phases:** 5
**Requirements:** 23 v1 requirements

---

## Phases

- [ ] **Phase 1: Foundation** - Secure, auditable infrastructure with RBAC and multi-tenant-ready data model
- [ ] **Phase 2: HCP Management + FMV** - HCP onboarding, verification, debarment checks, and FMV rate card enforcement
- [ ] **Phase 3: Engagement Lifecycle + Approval** - End-to-end engagement submission, state machine, and configurable multi-level approval
- [ ] **Phase 4: Contract Generation + DocuSign** - Template management, immutable PDF generation, and DocuSign e-signature workflow
- [ ] **Phase 5: Operations + Polish** - Background job schedulers, admin configuration UI, audit viewer, and performance hardening

---

## Phase Details

### Phase 1: Foundation
**Goal:** The platform is running with secure role-based access, a complete multi-tenant-ready schema, and an immutable audit trail recording every state change from the first migration.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** AUD-01, AUD-02
**Success Criteria** (what must be TRUE):
  1. A compliance officer can log in and access only the routes and actions permitted by their role; an admin logging in sees admin-only controls that the compliance officer cannot reach.
  2. An attempt to access any route or perform any write action without a valid session returns an authentication error — no data is accessible unauthenticated.
  3. Every state change in the system (login, role assignment, record creation) produces an append-only audit log entry containing entity type, transition name, before/after state, actor name + email + role as strings, server timestamp, and SHA-256 checksum — the entry cannot be updated or deleted even by the application's own database role.
  4. A developer can inspect the database and confirm that every domain table carries a non-nullable `tenant_id` column and that the audit schema is governed by a write-only database role separate from the application role.
**Plans:** TBD

### Phase 2: HCP Management + FMV
**Goal:** Compliance officers can onboard, verify, and manage HCPs with live NPI and debarment data, and admins can upload FMV rate cards that are versioned and enforced across all future engagements.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** HCP-01, HCP-02, HCP-03, HCP-04, FMV-01, FMV-02, FMV-03, FMV-04, FMV-05, FMV-06
**Success Criteria** (what must be TRUE):
  1. A compliance officer can look up an HCP by NPI and see their canonical name, credentials, NUCC specialty code, primary state, and HCO affiliation pulled live from the CMS NPPES API.
  2. After entering an HCP, the system automatically checks OIG LEIE and SAM.gov exclusion lists; the compliance officer can view the match results, record a determination with a written rationale, and that determination is captured in the audit log.
  3. A compliance officer can set an HCP's status to active, inactive, suspended, or do-not-engage, and every status change requires a mandatory reason field — the full status history is visible on the HCP profile.
  4. An admin can upload an FMV rate card as Excel or CSV, see a parsed preview before committing, and the system rejects any upload where specialty values cannot be matched to NUCC taxonomy codes.
  5. When an engagement is created, the system automatically snapshots the applicable FMV rate (by HCP specialty + geography + engagement type) onto the engagement record; if the proposed compensation exceeds the ceiling the system flags it and blocks submission until a written justification is provided.
  6. A user can view all historical rate card versions and see exactly which rate was snapshotted onto any specific engagement — the rate on past engagements never changes when a new rate card is uploaded.
**Plans:** TBD
**UI hint:** yes

### Phase 3: Engagement Lifecycle + Approval
**Goal:** Users can submit engagement requests that move through a fully enforced state machine and a configurable multi-level approval chain, with delegation support and a complete approval audit trail.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06
**Success Criteria** (what must be TRUE):
  1. A user can submit an engagement request for any of the five engagement types (advisory board, speaker program, investigator/research, meal/TOV, training) using a form whose fields are specific to that engagement type.
  2. An engagement can only move between named states (Draft → Submitted → Under Review → Approved → Contracted → Completed, with Cancelled and Rejected as terminal states) — any attempt to jump to an invalid state is rejected by the system.
  3. An approver receives a prompt when their step is active and can approve, reject, or return an engagement for revision; each approval action is recorded in the audit log with the approver's identity and the data they saw at that moment.
  4. An approver can delegate their approval authority to another user with a mandatory expiration date; delegated approvals appear in the audit log attributed to the delegate with the delegation noted separately.
  5. An admin can configure engagement types, their form fields, and their approval chain via the admin UI without any code deployment; each configuration change is versioned and auditable.
**Plans:** TBD
**UI hint:** yes

### Phase 4: Contract Generation + DocuSign
**Goal:** Compliance officers can generate immutable PDF contracts auto-populated from HCP, engagement, and FMV snapshot data, send them to HCPs for electronic signature via DocuSign, and track each contract through its full lifecycle.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** CONT-01, CONT-02, CONT-03, CONT-04, CONT-05
**Success Criteria** (what must be TRUE):
  1. A compliance officer can upload a contract template, assign it to one or more engagement types, and the system versions the template so previous versions remain accessible.
  2. For an approved engagement, the system generates a PDF contract with all HCP profile fields, engagement scope, and the FMV rate snapshot merged in — no field is silently empty; optional fields are explicitly marked as not applicable when absent.
  3. A generated PDF contract is stored as an immutable artifact in cloud storage under the tenant's path prefix and cannot be overwritten or deleted through the application.
  4. A compliance officer can send a generated contract to the HCP via DocuSign; the HCP receives and signs electronically, and the contract status advances to "executed" automatically on the DocuSign completion event.
  5. The signed document returned by DocuSign is stored as an immutable artifact linked to the engagement; a compliance officer can view the contract's current status (draft, sent, executed, or expired) at any time.
**Plans:** TBD
**UI hint:** yes

### Phase 5: Operations + Polish
**Goal:** The platform runs reliably in production with automated compliance job scheduling, a fully functional admin configuration UI, an audit event viewer, and hardened performance under realistic load.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** (no additional v1 requirements — this phase operationalizes and hardens all prior capabilities)
**Success Criteria** (what must be TRUE):
  1. The system automatically re-validates active HCP NPI records on a scheduled cadence and re-checks debarment status monthly; job execution and any resulting status changes are recorded in the audit log.
  2. An admin can edit engagement type definitions, form fields, and approval chain configurations through the admin UI without any code deployment, and each change takes effect for new engagement submissions immediately.
  3. A compliance officer can view a per-entity audit event timeline showing all state changes for any HCP, engagement, or contract — the timeline is filterable and the underlying data is the same append-only audit log written since Phase 1.
  4. The application returns all primary compliance officer workflows (HCP lookup, engagement submission, approval action) within acceptable response times under a realistic concurrent user load without errors.
**Plans:** TBD
**UI hint:** yes

---

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. HCP Management + FMV | 0/TBD | Not started | - |
| 3. Engagement Lifecycle + Approval | 0/TBD | Not started | - |
| 4. Contract Generation + DocuSign | 0/TBD | Not started | - |
| 5. Operations + Polish | 0/TBD | Not started | - |
