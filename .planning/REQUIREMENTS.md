# Requirements: HCP Engage

**Defined:** 2026-05-07
**Core Value:** Every dollar paid to an HCP is captured, justified, and audit-ready — with zero compliance exposure from missing or invalid engagements.

## v1 Requirements

### HCP Data

- [ ] **HCP-01**: User can look up and verify an HCP by NPI via CMS NPPES API (validates NPI exists, pulls canonical name, specialty, and credentials)
- [ ] **HCP-02**: User can view HCP profile with name, credentials, NUCC specialty code, primary state, and HCO affiliation
- [ ] **HCP-03**: System checks HCP against OIG LEIE and SAM.gov exclusion lists; compliance officer can review match results and record determination with rationale
- [ ] **HCP-04**: Compliance officer can set HCP status (active / inactive / suspended / do-not-engage) with a mandatory reason field; all status changes are logged in the audit trail

### FMV

- [ ] **FMV-01**: Admin can upload an FMV rate card (Excel/CSV) with a parsed preview before commit — upload is rejected if specialty values cannot be matched to NUCC taxonomy codes
- [ ] **FMV-02**: Rate card upload validates all specialty values against a local NUCC taxonomy reference table before activation
- [ ] **FMV-03**: Rate cards are immutably versioned — rows are never overwritten; each version carries effective date ranges and supersedes the prior version on activation
- [ ] **FMV-04**: System looks up the applicable FMV rate by HCP NUCC specialty + geography + engagement type at engagement request creation time and snapshots the rate onto the engagement record
- [ ] **FMV-05**: System flags engagements where proposed compensation exceeds the applicable FMV rate ceiling; above-rate engagements require a mandatory written justification from the requestor
- [ ] **FMV-06**: User can view all rate card versions and see the rate that was snapshotted onto any specific engagement

### Engagement

- [ ] **ENG-01**: User can submit an engagement request for five engagement types: advisory board, speaker program, investigator/research, meal/TOV, and training
- [ ] **ENG-02**: Engagement request form fields are configurable per engagement type by an admin without code deployment
- [ ] **ENG-03**: Engagement lifecycle is enforced as a named state machine: Draft → Submitted → Under Review → Approved → Contracted → Completed, with Cancelled and Rejected as terminal states; only named transitions are permitted
- [ ] **ENG-04**: Each engagement type supports a configurable multi-level approval chain (e.g., manager → compliance officer → legal) evaluated in sequence
- [ ] **ENG-05**: Approver can delegate approval authority to another user with a mandatory expiration date; delegation is attributed separately in the audit log
- [ ] **ENG-06**: Admin can configure engagement types, their form fields, and their approval chain via admin UI without code deploys; configuration changes are versioned and auditable

### Contracts

- [ ] **CONT-01**: Compliance officer can upload, version, and manage contract templates, with each template assigned to one or more engagement types
- [ ] **CONT-02**: System auto-generates a PDF contract from the applicable template, merged with HCP profile data, engagement scope, and FMV rate snapshot; optional field handling is explicit (no silent nulls)
- [ ] **CONT-03**: Generated PDF contracts are stored as immutable rendered artifacts in cloud storage under a per-tenant path prefix
- [ ] **CONT-04**: Contract status is tracked through named stages: draft → sent → executed → expired

### Disclosure

- [ ] **DISC-01**: System produces an audit-ready Open Payments (Sunshine Act) export with all CMS-required fields for the selected reporting period; export includes pre-submission validation that replicates CMS rules locally and flags errors before file generation

### Audit & Governance

- [ ] **AUD-01**: All system state changes are captured in an append-only audit log; each entry stores: entity type + ID, transition name, before/after state, actor name + email + role as strings (not FK only), server-side timestamp, and SHA-256 checksum — the audit schema uses a write-only database role that the application cannot UPDATE or DELETE
- [ ] **AUD-02**: System enforces role-based access control with five roles: admin, compliance officer, manager, legal, finance — each with defined permissions; access to all routes and actions is validated against the authenticated user's role before execution

## v2 Requirements

### HCP Data

- **HCP-V2-01**: User receives and signs a version-stamped consent form; consent record captures version, timestamp, and collection method (digital self-service vs. compliance officer entry)

### Spend & Disclosure

- **DISC-V2-01**: Compliance officer can record Transfers of Value (TOV) linked to engagements with Sunshine Act nature-of-payment category mapping
- **DISC-V2-02**: System aggregates spend per HCP per program year with retroactive reportability reclassification when the de minimis threshold is crossed
- **DISC-V2-03**: Spend dashboard shows running totals by HCP, period, and category for compliance officers and finance

### Audit & Governance

- **AUD-V2-01**: Compliance officer can view a per-entity event timeline (audit viewer) and export filtered audit data formatted for regulatory response
- **AUD-V2-02**: Admin can configure approval chains via admin UI without code deploys; configuration changes are versioned and auditable

### Platform

- **PLAT-V2-01**: Platform supports multi-tenant isolation with PostgreSQL row-level security enforced per tenant
- **PLAT-V2-02**: HCO (Healthcare Organization) can be directly engaged and paid; HCO engagement tracked with same compliance controls as HCP engagement

## Out of Scope

| Feature | Reason |
|---------|--------|
| E-signature / DocuSign integration | Complexity; contract execution is compliance officer attestation in v1 |
| Payment processing (ACH/check initiation) | Avoids financial licensing complexity; payments processed in existing client ERP |
| European regulatory frameworks (EFPIA, ABPI) | US Sunshine Act is the initial market; international scope added in a future milestone |
| Mobile application | Web-first for v1; compliance officers and finance teams are desktop users |
| CRM integration (Salesforce, Veeva) | Out of scope for v1; integration layer planned after core data model stabilizes |
| State-level gift law reporting (CA, MA, VT, MN) | Data model must not foreclose this, but reporting module is deferred |
| Drag-and-drop workflow builder | Admin UI with predefined approval chain config is sufficient for v1 clients |
| AI/ML FMV benchmarking or anomaly detection | Deferred; requires training data that only exists after platform has history |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUD-01 | Phase 1 | Pending |
| AUD-02 | Phase 1 | Pending |
| HCP-01 | Phase 2 | Pending |
| HCP-02 | Phase 2 | Pending |
| HCP-03 | Phase 2 | Pending |
| HCP-04 | Phase 2 | Pending |
| FMV-01 | Phase 2 | Pending |
| FMV-02 | Phase 2 | Pending |
| FMV-03 | Phase 2 | Pending |
| FMV-04 | Phase 2 | Pending |
| FMV-05 | Phase 2 | Pending |
| FMV-06 | Phase 2 | Pending |
| ENG-01 | Phase 3 | Pending |
| ENG-02 | Phase 3 | Pending |
| ENG-03 | Phase 3 | Pending |
| ENG-04 | Phase 3 | Pending |
| ENG-05 | Phase 3 | Pending |
| ENG-06 | Phase 3 | Pending |
| CONT-01 | Phase 4 | Pending |
| CONT-02 | Phase 4 | Pending |
| CONT-03 | Phase 4 | Pending |
| CONT-04 | Phase 4 | Pending |
| DISC-01 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-07*
*Last updated: 2026-05-07 after initial definition*
