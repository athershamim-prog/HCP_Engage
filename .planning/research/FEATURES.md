# Features Research: HCP Engage

**Domain:** Pharma HCP Engagement Management / Sunshine Act Compliance
**Researched:** 2026-05-07
**Confidence:** MEDIUM-HIGH (training data from CMS Open Payments program documentation, OIG guidance, and
established platform patterns across Veeva, IQVIA OCE, Alanda, Medcompli, and Concur Detect; no live
web verification possible in this session — flag for validation against current Alanda/Medcompli RFP
documentation before finalizing roadmap)

---

## Table Stakes (must have or users leave)

### HCP Data

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| NPI lookup and validation | Every licensed prescriber has an NPI; without it you cannot produce a valid Open Payments record | Low | NPI Registry is a free CMS REST API; validation is checking the number format (10-digit Luhn), fetching the record, and confirming the name/specialty match |
| HCP profile: name, credentials, specialty, primary practice address | Minimum fields for Open Payments submission | Low | Address must match NPI registry or have an override justification |
| License state + license number storage | Required for some engagement types; some clients require active license verification | Medium | Storing is easy; verifying currency with state boards is hard — store only in v1 |
| Institutional affiliation (employer hospital/academic center) | Open Payments requires knowing if the HCP is affiliated with a teaching hospital | Low | Store affiliation strings; do NOT build HCO entity resolution in v1 |
| HCP status field (active / inactive / suspended / do-not-engage) | Compliance teams must be able to pull an HCP from circulation immediately | Low | Soft-delete pattern; status change must be logged with reason and actor |
| Debarment / exclusion check result storage | Proving you checked is as important as the check result itself — regulators ask for evidence | Medium | Store: check date, database version queried, result (clean/match), match details if any, cleared-by if overridden |
| Consent record (has the HCP agreed to data processing and engagement terms) | HIPAA-adjacent; some states require explicit consent | Low | Store: consent version, timestamp, collection method (email link, paper, verbal-with-attestation) |

### Engagement Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Engagement request form with required fields | Core workflow entry point — without a structured request you cannot enforce policy | Medium | Fields vary by type; the engine must be configurable per engagement type |
| Engagement types: advisory board, speaker program, investigator, meal/TOV, training | These five cover 90%+ of pharma HCP interactions; a system missing any of them loses deals | Medium | Each type has different required fields, approval rules, and Open Payments category mappings |
| Multi-level approval workflow | No pharma company allows one-click spend approval; manager → compliance → legal is the minimum | High | The hardest part is not routing — it is handling escalations, delegations, out-of-office, and rejections with clear state machine semantics |
| Configurable approval steps per engagement type | Advisory boards and speaker programs have different risk profiles and different approvers | High | Must be per-client configurable without code deploys; workflow config is a first-class data artifact |
| Delegation and out-of-office routing | Compliance teams have vacations; stuck approvals mean delayed HCP payments and angry physicians | Medium | Delegate must inherit same permissions; time-bounded; audit-logged |
| Rejection with required reason and return-to-requester | Approvers must explain rejections; requesters need to revise and resubmit | Low | Reason is free text; rejection triggers a notification; request returns to draft state |
| Engagement status lifecycle (draft → submitted → approved → contracted → executed → paid → reported) | Compliance officers track every stage; finance needs to know when to pay; auditors want full lifecycle | Medium | Status machine must be strict — no skipping states, all transitions logged |
| Engagement cancellation with reason | Engagements get cancelled; the record must persist for audit trail even if no money moved | Low | Cancelled engagements do not disappear from the audit trail |

### FMV & Compliance

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| FMV rate card upload (Excel/CSV by specialty + geography) | Every pharma company has an existing FMV rate card; the platform must accept and enforce it | Medium | The deceptively hard part is column/header normalization across client formats; specialty name spelling inconsistencies break lookups |
| FMV rate lookup at engagement creation | The system must surface the applicable rate so the requester sees it before submitting | Low | Given a specialty and geography from the HCP profile, return min/max hourly rate and max daily rate |
| FMV flag when proposed compensation exceeds rate card | Non-negotiable compliance requirement; payments above FMV without documented justification create regulatory exposure | Low | Flag = block submission OR allow with required justification field; make this configurable per client |
| FMV justification capture when above-rate | Compliance sometimes approves above-FMV with documented rationale (unique expertise, market shortage) | Low | Justification text + approver attestation must be stored; appears in audit trail |
| Debarment check trigger at HCP onboarding | First check must happen before any engagement is ever created | Medium | OIG LEIE and SAM.gov are the two mandatory databases; each has its own API/file format |
| Debarment re-check trigger before payment | Many companies require a re-check at or near the time payment is issued — OIG guidance strongly recommends this | Medium | System needs to track "last checked" date and surface stale checks |
| OIG LEIE integration (or file-based match) | OIG publishes monthly updated exclusion files; direct API or monthly file ingest are both acceptable | Medium | File-based is simpler and more reliable for v1; monthly refresh is sufficient for most compliance programs |
| SAM.gov integration (or file-based match) | Federal contractor debarment; covers a different population than OIG | Medium | SAM.gov has a REST API; file-based is also available |
| Debarment match review workflow | A name match is not always a real match (common names); compliance needs a workflow to review and clear or confirm | Medium | Match requires: reviewer, decision (confirmed hit / false positive), rationale, timestamp |

### Contracts

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Contract template management | Every engagement type has a standard template; templates must be version-controlled | Medium | Store templates with version numbers; know which version was used for each executed contract |
| Variable substitution from HCP and engagement data | Auto-population of name, address, NPI, specialty, scope of work, compensation, dates | Medium | Template engine must handle null-safety gracefully — missing data should surface as validation errors, not empty contract fields |
| Contract generation (PDF output) | Compliance teams expect to produce a PDF contract from the platform | Medium | PDF generation from HTML/template is the common pattern; Word-based generation is fragile |
| Generated contract stored with engagement record | The final executed version must be attached to the engagement for audit trail purposes | Low | Store as immutable blob; never allow overwrite after execution |
| Contract status tracking (draft → sent → executed → expired) | Compliance needs to know if the HCP has signed; legal needs expiry alerts | Low | Execution in v1 = manual attestation (track who said it was signed, when); e-signature is out of scope |
| Contract expiry alerts | Long-running advisory relationships have annual contracts; compliance misses renewals without alerts | Low | Email alert to engagement owner N days before expiry (N configurable) |

### Reporting & Disclosure

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Aggregate spend per HCP per program year | Open Payments is annual; compliance officers need a running total before year-end to anticipate disclosure | Low | Sum of all executed engagements per HCP per calendar year |
| Open Payments field mapping (all required fields present on every reportable record) | Without correct field mapping the submission file is rejected by CMS | High | CMS requires ~30 fields per general payment record; research payment adds more; the mapping must be exact — field names, formats, allowed values |
| Open Payments CSV export in CMS-specified format | Direct submission artifact; compliance teams submit this file to CMS portal annually | High | CMS publishes a data dictionary annually that changes year to year; the export must be validated against current spec before submission |
| Open Payments payment nature/category classification | Each engagement type maps to one of CMS's nature-of-payment categories (consulting fees, speaking fees, food and beverage, travel, etc.) | Medium | Mapping table must be configurable — categories do occasionally change between program years |
| Reportability determination (is this payment Sunshine Act reportable?) | Not all payments are reportable; the threshold is $10.91 per payment or $10.91 aggregate per year (adjusted annually) | Medium | System must track the threshold, apply it per physician per year, and flag records that cross into reportable territory |
| Spend dashboard: total committed vs. paid vs. reported | Compliance officers and finance need real-time visibility into the spend pipeline | Medium | Committed = approved not yet paid; paid = payment confirmed; reported = included in Open Payments submission |
| Duplicate detection (same HCP, same date, overlapping engagements) | CMS flags duplicate records; compliance teams get penalty letters | Medium | Check for overlapping dates / same engagement type / same HCP before allowing approval |

### Audit & Governance

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Immutable audit log (who did what, when, to which record) | This is the core regulatory defensibility artifact; without it compliance cannot respond to a CMS inquiry | High | Every state change, every data edit, every approval decision must produce an append-only log entry with actor, timestamp, before/after values |
| Full engagement history viewable in UI | Compliance officers need to reconstruct the approval chain without digging through raw logs | Medium | Timeline view of all events on a record; not just current state |
| Document evidence attachment per engagement | Supporting docs: speaker training certificate, signed agenda, attendee list, meal receipts | Low | Blob storage with file type restrictions; stored immutably with upload timestamp and uploader identity |
| Attestation capture (requester certifies data is accurate) | Regulatory best practice; some audit frameworks require it | Low | Checkbox + timestamp at submission; stored in audit log |
| Search and filter across all engagements | Auditors arrive with specific HCP names or date ranges; they need results in seconds, not hours | Medium | Filter by: HCP name, NPI, status, date range, engagement type, program, approver |
| Export of engagement records with audit trail for regulator response | When CMS sends an inquiry the compliance team needs to produce a complete package | Medium | Export as PDF report or structured CSV; must include audit log entries for the record |

### Admin & Configuration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| User management with role-based access control | Requester, compliance reviewer, legal reviewer, admin — at minimum | Low | Role definitions must map to what each persona can view, create, approve, and export |
| Engagement type configuration (fields, rules, approval chain) | Every client has slightly different engagement categories and internal naming | High | This is the configuration complexity center of gravity for the whole platform |
| FMV rate card version management | Rate cards are updated annually; old engagements must be evaluated against the rate card in effect at the time | Medium | Each engagement must store a snapshot reference to the rate card version active when it was created |
| Email notification configuration | Approvers and requesters need notifications at every state transition; email templates must be configurable | Low | Template variables: HCP name, engagement type, link to record, requester name |
| Program / cost center taxonomy | Compliance tracks spend by therapeutic area, program, or cost center for internal budgeting | Low | Hierarchical: Company → Therapeutic Area → Program → Cost Center |

---

## Differentiators (competitive advantage)

### HCP Data

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| NPI registry sync with automatic profile update alerts | HCPs change specialties, addresses, and affiliations; the platform can alert when an HCP profile diverges from current NPI registry data | Medium | NPI Registry API is free; polling monthly is low cost; surfacing delta to compliance team is the value |
| Debarment check scheduling and bulk re-verification | Large programs re-verify all HCPs on a quarterly cadence; manual batch checks are error-prone | Medium | Scheduled job; results stored; any new matches surface as compliance tasks |
| HCP tier classification (KOL tier, budget tier, engagement frequency) | Some compliance programs limit how many times per year a given HCP can be engaged | Medium | Engagement frequency caps are a real compliance control that Veeva supports and smaller platforms often skip |

### Engagement Management

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Budget pre-check before engagement creation | Surfacing available budget before the requester submits prevents wasted approval cycles | Medium | Requires cost center budget loaded into the system; shows remaining budget before submit |
| Parallel approval tracks (compliance AND legal can review simultaneously) | Sequential approval is slow; parallel routing where both reviewers can act at once is a meaningful speed improvement | High | Requires careful state machine — both tracks must complete before moving forward; either can block |
| Conditional approval steps (trigger additional review based on spend threshold or HCP tier) | Advisory board at $5,000 goes through legal; the same type at $500 does not | High | Rule engine on workflow config — condition: (amount > X OR specialty = Y) → add step Z |
| Requester dashboard showing all in-flight and historical engagements | Requesters at large pharma companies submit dozens of engagements; they need a home screen | Low | Filtered view of engagements owned by the logged-in user with status indicators |

### FMV & Compliance

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| FMV trend analysis across HCPs by specialty | Compliance officers want to see if their rate card is drifting out of market; aggregate anonymized view helps | High | Requires enough HCP volume to be meaningful; v2 feature, not v1 |
| Rate card gap detection (HCP specialty not covered by current rate card) | When an HCP's specialty doesn't map to a rate card row, the system should surface this at onboarding, not at engagement approval | Low | During onboarding: check whether specialty has a rate card entry; flag missing mapping |
| Automated annual rate card comparison (prior year vs. current) | When a new rate card is uploaded, highlight which specialties had rates increase/decrease and flag in-flight engagements affected | Medium | Diff calculation is straightforward; the valuable output is the "engagements that now exceed new rates" report |

### Contracts

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Contract amendment workflow | Scope changes after execution require a documented amendment, not a re-issue | High | Amendment links to original; creates a version chain; both documents stored |
| Template clause library with per-client overrides | Legal teams maintain approved clause language; compliance officers pull from approved library | High | Clause library with tagging and override permissions per client role |

### Reporting & Disclosure

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pre-submission validation report (flag records that will fail CMS validation before submitting) | CMS validation errors result in delayed disclosure and potential penalties; a pre-check report saves significant compliance team time | High | Must encode CMS validation rules: required fields, allowed values, format constraints, cross-field logic |
| Year-over-year spend comparison per HCP | Compliance flags HCPs whose total received value increased significantly year-over-year as a potential scrutiny indicator | Medium | Simple calculation once per-year spend is tracked |
| State-level aggregate report (for state gift law compliance in addition to federal) | Many states (CA, MA, VT, CT, MN) have their own disclosure laws with different thresholds and fields | High | Out of scope for v1 but a clear v2 expansion; architect the data model to not foreclose this |

### Audit & Governance

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Audit response package generator | When CMS sends an inquiry letter, compliance can generate a complete package (engagement record + approvals + contract + spend + audit log) in one click | High | Extremely high value; dramatically reduces response time from days to minutes |
| Compliance calendar (upcoming debarment re-checks, contract renewals, submission deadlines) | Compliance teams miss deadlines; a calendar view of required actions prevents this | Medium | Dashboard widget showing: re-checks due, contracts expiring, annual submission deadline |
| Engagement volume anomaly alerting (HCP receiving unusually high TOV relative to peers) | Proactive identification of outlier HCPs before CMS flags them | High | Requires statistical baseline; v2 feature |

---

## Anti-Features (deliberately NOT build)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Payment processing / ACH initiation | Financial licensing requirements, banking integrations, reconciliation complexity — adds 12+ months of scope and regulatory overhead entirely separate from compliance | Track payment confirmation events; let the client's ERP or AP system execute the actual payment |
| E-signature integration (DocuSign, Adobe Sign) | API integration complexity, licensing cost pass-through, error handling for signature events, and webhook reliability add significant scope for v1 | Track contract execution via compliance officer attestation in v1; design the contract record to accept a signature blob later |
| HCO (Healthcare Organization) direct engagement management | HCO engagement has different regulatory rules (institutional vs. individual), different FMV frameworks, and a distinct data model — conflating it with HCP engagement in v1 creates architectural debt | Store HCP institutional affiliation as a string field; build HCO as a separate entity type in v2 |
| European regulatory frameworks (EFPIA, ABPI, Loi Bertrand) | Each European framework has different payment categories, thresholds, HCO/HCP distinctions, and submission mechanisms — cannot be retrofitted onto a Sunshine Act data model | v1 data model should use a neutral payment record schema that can be extended; do not bake US-only field names into the core schema |
| CRM / call logging (Veeva CRM territory) | HCP call logs, sample tracking, and promotional material capture are a separate product category with a different user persona (field reps, not compliance officers) | Out of scope entirely; integrate via API if a client insists on linking call data to engagement records |
| Workflow builder UI (drag-and-drop flow editor) | Custom workflow builders have a 10x implementation cost vs. configuration-driven workflows; compliance teams do not self-configure workflows — implementations do | Use JSON/YAML workflow config managed by the implementation team; expose configuration in a structured admin UI, not a drag-and-drop canvas |
| Real-time payment verification / bank account validation | Verification of HCP banking details requires sensitive data handling, financial data vendor integration, and PCI-adjacent security controls | Payment details are out of scope; the system stores "payment confirmed on [date] for $X" as an event, recorded by the finance team |
| HCP patient data or prescribing data | Prescribing data (from IQVIA, Symphony, etc.) is used for targeting, not compliance — brings HIPAA complexity and data licensing cost with no compliance benefit | Never ingest patient or prescribing data; HCP identity is established via NPI and public registry only |
| Peer-to-peer comparison of HCP compensation across companies | Competitive intelligence, not compliance — and sharing cross-company payment data raises anti-trust concerns | Aggregate FMV intelligence comes from approved FMV vendors (Huron, Deloitte); do not attempt to replicate it |
| Mobile app for requesters | Mobile adds a parallel development track; compliance workflows require form-based data entry that works poorly on mobile; compliance officers work at desktops | Responsive web is sufficient; prioritize data quality over device optimization in v1 |

---

## Feature Complexity Notes

### Deceptively Simple Features That Are Actually Hard

**FMV rate card ingestion**
Every client has a different Excel layout. Column headers vary ("Specialty" vs. "HCP Specialty" vs. "Physician Category"), specialty names vary ("Cardiologist" vs. "Cardiology" vs. "CV"), and geographic tiers vary ("Northeast" vs. "Region 1" vs. a list of states). A naive CSV parser will fail on real client data within the first week. The normalization layer — specialty name canonicalization, geography normalization, column mapping configuration — is the actually hard part. Budget 3–4x more time than the upload UI suggests.

**Multi-level approval workflow state machine**
The happy path (submit → review → approve → approve → execute) is straightforward. The edge cases are not: what happens when an approver is delegated and the delegate is also out? What happens when a requester edits a record that is mid-approval — does it restart? What happens when legal approves but compliance rejects — is the whole request rejected or can compliance be re-submitted independently? These questions do not have universal answers; they require explicit design decisions and configurable rules, and the state machine must be exhaustive before any code is written.

**Open Payments field mapping**
CMS publishes a data dictionary with ~30 required fields for general payments and ~40 for research payments. Many fields have allowed-value enumerations that change annually. Key traps: the "Physician Specialty" field uses CMS's own specialty taxonomy, not NPI specialty codes — a translation table is required. "Nature of Payment" is a CMS-defined enumeration that does not map cleanly to pharma engagement type names. "Form of Payment or Transfer of Value" (cash, stock, etc.) must be recorded. "Program Identifier" is a required field that CMS uses to detect duplicates — if you generate it incorrectly, CMS will flag duplicate records. None of this is discoverable from the CMS website description alone; it requires reading the full data dictionary and submission guide.

**Debarment match review**
OIG LEIE and SAM.gov use name + DOB + address matching. Neither database provides a confident unique identifier. A search for "Robert Smith" with a DOB of 1965 may return 3 matches. The compliance officer must review each match and make a determination. This workflow — present matches, allow side-by-side comparison, capture decision with rationale, notify requester of cleared status — is a mini-application inside the platform that most competitors handle poorly (they just show a yes/no result and leave the match documentation to the compliance team's email inbox).

**Immutable audit log**
An audit log that can be modified by an admin or that is stored in the same database with the same delete permissions as application data is not an audit log — it is a compliance liability. The log must be append-only, must capture before/after values (not just "field X changed"), must be queryable by regulators who do not have application UI access, and must be exportable in a human-readable format. PostgreSQL with row-level insert-only permissions, or a separate append-only store, are the two acceptable patterns.

**Aggregate spend threshold logic**
The Open Payments reportability threshold ($10.91 for 2024, adjusted annually) applies per physician per program year. A single payment of $10 is not reportable. Two payments of $6 to the same physician in the same year ($12 aggregate) are both reportable. The system must track aggregate spend in real time, mark individual records as "below threshold / not reportable" or "reportable" dynamically, and recalculate when a new payment pushes the physician over the aggregate threshold retroactively. This retroactive reclassification surprises most implementers.

### Deceptively Hard Features That Platforms Charge Premium For But Often Underdeliver

**Configurable engagement types**
Every platform claims "configurable engagement types." What they typically deliver is a fixed set of fields with some fields made optional or required — not a genuine field-type-and-rule engine. True configurability means: client can define new engagement types with custom field sets, custom validation rules, custom FMV applicability rules, custom approval chains, and custom Open Payments category mapping — all without code. This is a significant configuration data model investment. Do it right in v1 or spend v2 rebuilding it.

**Audit response packages**
Every platform says they support audit response. Few actually let you click "generate audit package for engagement ID 12345" and get a complete, well-formatted PDF with the engagement record, all approval decisions with timestamps and actors, the contract used, the FMV rate in effect, the debarment check results, and the Open Payments submission record — all in one document. Compliance teams at most clients still assemble this by hand from screenshots and exports. This is a high-value differentiator with moderate implementation complexity.

**Pre-submission Open Payments validation**
CMS provides a validation tool, but running records through it requires uploading to CMS's system. A platform that encodes the CMS validation rules locally and surfaces errors before submission — with field-level guidance on how to fix each error — is meaningfully better than one that just produces the CSV and lets the compliance team discover errors at CMS submission time.

---

## Dependency Map

```
NPI Verification
  └── HCP Profile Creation
        ├── Debarment Check (OIG + SAM.gov)
        │     └── Debarment Match Review Workflow
        ├── FMV Rate Lookup (requires specialty from NPI profile)
        │     └── Rate Card Upload + Normalization (must exist before any lookup)
        └── Consent Collection
              └── Engagement Request Creation (HCP must be onboarded + consented)
                    ├── FMV Validation (rate must exist for HCP specialty)
                    ├── Engagement Type Config (type must be defined before request)
                    │     └── Approval Workflow Config (workflow tied to type)
                    └── Approval Workflow Execution
                          ├── Delegation Config (must exist before approvals needed)
                          └── Contract Generation (approval must complete first)
                                ├── Contract Template (must exist for engagement type)
                                ├── Contract Storage (immutable blob)
                                └── Spend Recording (contract execution triggers spend)
                                      ├── Aggregate Spend Tracking (per HCP per year)
                                      │     ├── Reportability Determination (threshold check)
                                      │     └── Open Payments Export (approved records only)
                                      └── Audit Log (every step above produces log entries)
                                            └── Audit Response Package (aggregates log + docs)

FMV Rate Card Upload
  └── Rate Card Version Management
        └── Rate Card Gap Detection (which specialties lack a rate)

User Management / RBAC
  └── (gates access to every feature above)

Program / Cost Center Taxonomy
  └── Engagement Request (cost center selected at request time)
        └── Spend Dashboard (aggregated by cost center)
```

### Critical Path for v1

The minimum viable compliance system requires these in strict dependency order:

1. User management + RBAC
2. FMV rate card upload + normalization
3. HCP onboarding (NPI verification → debarment check → profile creation)
4. Engagement type configuration
5. Approval workflow configuration
6. Engagement request creation + FMV validation
7. Approval workflow execution
8. Spend recording
9. Aggregate spend tracking + reportability logic
10. Open Payments export
11. Audit log (must be present from step 1 — not added later)

Audit log is not step 11 — it is a cross-cutting requirement that must be designed in from day one. Adding it retroactively to an existing application is a rewrite.

---

## Sources

- CMS Open Payments program documentation and data dictionary (training data, program years 2014–2024; annual spec changes well-documented)
- OIG List of Excluded Individuals/Entities (LEIE) — monthly updated file, downloadable from oig.hhs.gov; search API available
- SAM.gov exclusions database — REST API available at api.sam.gov
- NPI Registry — NPPES NPI Registry public API at npiregistry.cms.hhs.gov
- Veeva Vault PromoMats and Veeva CRM feature documentation (training data)
- IQVIA Orchestrated Customer Engagement (OCE) compliance module documentation (training data)
- Alanda platform feature set (training data from RFP comparison documents)
- Medcompli platform feature set (training data)
- PhRMA Code on Interactions with Health Care Professionals (2022 edition) — voluntary industry code that defines what engagements require FMV documentation
- OIG Compliance Program Guidance for Pharmaceutical Manufacturers (training data)

**Confidence note:** All findings are from training data (knowledge cutoff August 2025). The CMS Open Payments data dictionary changes annually — validate the field list and threshold values against the current program year specification before building the export module. The 2024 reporting threshold of $10.91 should be confirmed against the current CMS announcement.
