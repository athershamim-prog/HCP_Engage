# Requirements: HCP Engage

**Defined:** 2026-05-07
**Revised:** 2026-05-07 — Simplified for fast launch: single-tenant, 3 roles, no audit log, no DocuSign, FMV display only, single approval, manual debarment
**Core Value:** Every dollar paid to an HCP is captured, justified, and traceable — simple enough to ship fast, solid enough to meet compliance basics.

## v1 Requirements

### Auth & Access

- [ ] **AUTH-01**: System enforces role-based access with three roles — Business, Compliance, and Finance — each with defined permissions; access to all routes and write actions is validated against the authenticated user's role before execution

### HCP Data

- [ ] **HCP-01**: User can look up and verify an HCP by NPI via CMS NPPES API (validates NPI exists, pulls canonical name, specialty, and credentials)
- [ ] **HCP-02**: User can view HCP profile with name, credentials, NUCC specialty code, primary state, and HCO affiliation
- [ ] **HCP-03**: Compliance officer can manually trigger a debarment check against OIG LEIE and SAM.gov; view match results and record a determination with rationale
- [ ] **HCP-04**: Compliance officer can set HCP status (active / inactive / suspended / do-not-engage) with a mandatory reason field; status history is visible on the HCP profile

### FMV

- [ ] **FMV-01**: Admin can upload an FMV rate card (Excel/CSV) with a parsed preview before commit — upload is rejected if specialty values cannot be matched to NUCC taxonomy codes
- [ ] **FMV-02**: Rate card upload validates all specialty values against a local NUCC taxonomy reference table before activation
- [ ] **FMV-03**: Rate cards are versioned with effective date ranges; activating a new version supersedes the prior one
- [ ] **FMV-04**: System displays the applicable FMV rate for an HCP at engagement creation time (by NUCC specialty + geography + engagement type) — shown for reference only, does not block submission
- [ ] **FMV-05**: User can view all rate card versions

### Engagement

- [ ] **ENG-01**: User can submit an engagement request for five engagement types: advisory board, speaker program, investigator/research, meal/TOV, and training
- [ ] **ENG-02**: Engagement status tracks four stages: Draft → Submitted → Approved / Rejected → Completed
- [ ] **ENG-03**: A single approver (Compliance or Finance role) reviews, then approves or rejects the engagement; rejection requires a reason

### Contracts

- [ ] **CONT-01**: Compliance officer can upload, version, and manage contract templates assigned to one or more engagement types
- [ ] **CONT-02**: System auto-generates a PDF contract from the applicable template merged with HCP profile data, engagement scope, and the displayed FMV rate — optional fields are explicitly marked as not applicable when absent
- [ ] **CONT-03**: Generated PDF contracts are stored in cloud storage and cannot be overwritten through the application
- [ ] **CONT-04**: Contract status tracks four stages: Draft → Sent → Executed → Expired

---

## v2 Requirements

### Audit & Governance

- **AUD-01**: Append-only audit log with write-only DB role, SHA-256 checksums, before/after state capture
- **AUD-V2-01**: Audit event viewer — per-entity timeline, filterable, exportable for regulatory response

### Multi-Tenancy

- **PLAT-01**: tenant_id on every table; PostgreSQL row-level security enforced per tenant

### Engagement — Advanced

- **ENG-V2-01**: Configurable multi-level approval chain (e.g., manager → compliance → legal) evaluated in sequence
- **ENG-V2-02**: Approver can delegate approval authority to another user with a mandatory expiration date
- **ENG-V2-03**: Engagement form fields are configurable per engagement type by an admin without code deployment
- **ENG-V2-04**: Full state machine: Draft → Submitted → Under Review → Approved → Contracted → Completed, with Cancelled and Rejected terminal states
- **ENG-V2-05**: Admin can configure engagement types, form fields, and approval chains via admin UI without code deploys; changes are versioned

### FMV — Enforcement

- **FMV-V2-01**: System blocks submission when proposed compensation exceeds the FMV rate ceiling; above-rate requires mandatory written justification
- **FMV-V2-02**: FMV rate is snapshotted (immutably) onto the engagement record at creation time

### Contracts — DocuSign

- **CONT-V2-01**: System sends generated contract to HCP via DocuSign; contract status advances to "executed" automatically on DocuSign completion webhook; signed artifact stored as immutable blob

### Debarment — Automated

- **HCP-V2-01**: System automatically re-checks debarment status monthly for all active HCPs; re-check results logged

### Spend & Disclosure

- **DISC-V2-01**: Compliance officer can record Transfers of Value (TOV) linked to engagements with Sunshine Act nature-of-payment category mapping
- **DISC-V2-02**: Aggregate spend per HCP per program year with retroactive reportability reclassification at de minimis threshold
- **DISC-V2-03**: Spend dashboard by HCP, period, and category

### HCP Consent

- **HCP-V2-02**: HCP receives and signs a version-stamped consent form; consent record captures version, timestamp, and collection method

---

## Out of Scope (v1)

| Feature | Reason |
|---------|--------|
| DocuSign e-signature | Deferred to v2 — manual contract execution sufficient for launch |
| Audit log | Deferred to v2 — adds infrastructure complexity before core flows exist |
| Multi-tenant RLS | Single-tenant v1; multi-tenant architecture deferred to v2 |
| FMV enforcement/blocking | Display only in v1; blocking logic added in v2 after client validation |
| Configurable approval chains | Single approver sufficient for v1 clients |
| Automated debarment re-checks | Manual trigger sufficient for v1; scheduling added in v2 |
| Open Payments Export | Requires TOV recording — deferred to v2 |
| Payment processing | Handled in client ERP |
| Mobile application | Web-first, desktop users |
| CRM integration | Deferred after data model stabilizes |

---

## Traceability

| Requirement | Phase | Phase Name | Status |
|-------------|-------|------------|--------|
| AUTH-01 | Phase 1 | Auth + HCP Management | Pending |
| HCP-01 | Phase 1 | Auth + HCP Management | Pending |
| HCP-02 | Phase 1 | Auth + HCP Management | Pending |
| HCP-03 | Phase 1 | Auth + HCP Management | Pending |
| HCP-04 | Phase 1 | Auth + HCP Management | Pending |
| FMV-01 | Phase 2 | FMV + Engagement | Pending |
| FMV-02 | Phase 2 | FMV + Engagement | Pending |
| FMV-03 | Phase 2 | FMV + Engagement | Pending |
| FMV-04 | Phase 2 | FMV + Engagement | Pending |
| FMV-05 | Phase 2 | FMV + Engagement | Pending |
| ENG-01 | Phase 2 | FMV + Engagement | Pending |
| ENG-02 | Phase 2 | FMV + Engagement | Pending |
| ENG-03 | Phase 2 | FMV + Engagement | Pending |
| CONT-01 | Phase 3 | Contracts + Polish | Pending |
| CONT-02 | Phase 3 | Contracts + Polish | Pending |
| CONT-03 | Phase 3 | Contracts + Polish | Pending |
| CONT-04 | Phase 3 | Contracts + Polish | Pending |

**Coverage:**
- v1 requirements: 17 total (down from 23)
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-07*
*Revised: 2026-05-07 — simplified scope for fast launch*
