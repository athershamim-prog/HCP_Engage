# Pitfalls Research: HCP Engage

**Domain:** Pharma commercial compliance / HCP engagement management
**Researched:** 2026-05-07
**Confidence:** MEDIUM-HIGH (training data on CMS Open Payments documentation, OIG guidance, pharma compliance industry post-mortems; web lookups unavailable during this session — flag for validation against current CMS Open Payments Program Instructions)

---

## Critical Pitfalls (will kill the project or cause regulatory exposure)

---

### C1: Covered Recipient Matching Failures in Open Payments Submissions

**What goes wrong:**
CMS rejects or flags records when the submitted physician identity cannot be matched to a covered recipient in the CMS reference dataset. The matching logic CMS uses requires exact alignment of: NPI number, covered recipient type (physician vs. teaching hospital), specialty taxonomy code, state license number, and name as it appears in NPPES. Systems that store HCP data at onboarding time and never re-validate drift out of sync with the authoritative CMS data, producing submissions that fail matching at the time of filing — often discovered only during the annual submission window.

The two most common failure modes:
1. **NPI + name mismatch**: HCP legally changed their name (marriage, etc.) but the system stored the old name. CMS matches on the name associated with the NPI in NPPES at submission time, not at onboarding time.
2. **Specialty taxonomy drift**: The HCP's primary taxonomy code in NPPES changed (e.g., reclassification, new specialization, or they updated it themselves). The FMV rate card and the Open Payments record reference different taxonomy codes and CMS flags the inconsistency.

**Warning signs:**
- More than 2% of submission records require manual review or correction before CMS acceptance
- Onboarding data is treated as write-once (no refresh cycle after initial verification)
- The data model stores specialty as a free-text string rather than the NUCC taxonomy code
- No process exists to re-query NPPES for active HCPs on a schedule

**Prevention:**
- Store the NPPES taxonomy code (`taxonomyCode`, 10-character NUCC code) as the canonical specialty identifier, not a display string
- Build a background job from day one that re-queries NPPES for all active HCPs on a rolling 90-day cycle and flags discrepancies for compliance review — do not treat onboarding as a one-time event
- At submission time, run a pre-flight comparison of each record's NPI + name + taxonomy against a fresh NPPES snapshot before generating the submission file
- Retain the NPPES data snapshot used at onboarding (with timestamp) separately from the currently live data, so disputes about what was known when can be resolved

**Which phase:** Data model must be correct in Phase 1 (HCP onboarding). The re-validation job is Phase 2. Pre-flight submission check is the Open Payments export phase.

---

### C2: FMV Rate Card Versioning — Rates Applied to Wrong Period

**What goes wrong:**
Clients update FMV rate cards periodically (typically annually, sometimes mid-year after a new compensation study). If the system replaces the current rate card without preserving the prior version, all historical engagements that were valid under the old rates now appear to have been approved under incorrect rates. This is catastrophic for audit: auditors will ask "what rate was in effect when this contract was signed?" and the system cannot answer.

A secondary failure: an engagement is initiated under Rate Card v1, approval is slow, the card is updated to v2 mid-approval, and the contract is generated using v2 rates — but the approval was granted under v1 assumptions. The system has now executed an engagement at a rate that was never actually approved.

**Warning signs:**
- Rate card upload flow overwrites rather than versions (no `effective_date` / `superseded_date` on rate records)
- FMV rate references in the engagement record are stored as a copied dollar value rather than a foreign key to a specific rate card version record
- No logic locks the rate at engagement initiation time

**Prevention:**
- Data model: rate card rows must have `rate_card_version_id`, `effective_from`, `effective_to` (nullable for current). Never delete or overwrite a rate row — only close it.
- At engagement creation, snapshot the applicable rate (store `rate_card_version_id` + `rate_amount` on the engagement record). This rate cannot change even if a new card is uploaded.
- Contract generation must pull from the engagement's snapshotted rate, never from "current" rate card.
- When a new rate card is uploaded, require an effective date. Validate that no in-flight engagements fall in the gap between old card expiry and new card effective date (or explicitly carry the old rate for those engagements).

**Which phase:** Phase 1 data model. Must be correct before any rate card upload feature ships. Extremely painful to retrofit.

---

### C3: Debarment Check False Negatives from Name Matching

**What goes wrong:**
OIG LEIE (List of Excluded Individuals/Entities) and SAM.gov exclusions are matched against HCP records by name. Name matching is treacherous:
- HCP submits "William Smith" but the exclusion record is "Bill Smith" or "William J. Smith"
- Name has non-ASCII characters stripped differently in each system
- Maiden name / married name divergence
- Two physicians with identical names (more common than expected in large databases)

Systems that use exact-match or simple fuzzy-match logic will produce false negatives (excluded HCPs pass the check) or false positives (legitimate HCPs blocked). False negatives are the regulatory exposure. False positives are the operational nightmare that causes compliance teams to "trust override" every check — at which point the check provides zero value.

Additionally: debarment checks are not a one-time gate. OIG can add an individual to the exclusion list at any time. An HCP who was clean at onboarding can be excluded six months later. Any engagement with an excluded individual after the exclusion date is potentially a False Claims Act violation.

**Warning signs:**
- Debarment check is only performed at onboarding, with no recurring re-check
- Match logic is pure exact-match on name fields
- Override rate is above 5% (sign that false positives are causing bypass culture)
- No audit record of which exclusion database version was used at check time

**Prevention:**
- Use NPI as the primary deduplication key where possible, not name (OIG LEIE does contain NPI for physician records since 2013)
- Implement a multi-signal match: NPI (if available in the exclusion record) + name soundex/phonetic + DOB (if available) — require at least 2 of 3 signals to flag
- Store the check result with: timestamp, database version/date downloaded, match signals used, outcome — not just pass/fail
- Schedule re-checks: at minimum before each new engagement contract is generated, and on a periodic basis (monthly) for all active HCPs
- Integrate with a commercial screening service (e.g., Veeva Vault, Medigy, or a dedicated screening API) rather than building name-matching logic from scratch — this is a solved problem with significant legal liability if done wrong

**Which phase:** Phase 1 for initial check and data model. Re-check scheduling is Phase 2. Third-party API integration should be decided in Phase 1 even if not implemented until Phase 2.

---

### C4: Audit Trail Incompleteness — Missing "Who Approved What and Why"

**What goes wrong:**
Regulatory auditors (OIG, DOJ, state AG) and internal audit teams do not care that the system has an audit log — they care that the audit log answers specific questions:
1. Who approved this engagement, and what was their role and authority at that moment?
2. What information was presented to the approver at the time of approval (rate, HCP details, scope)?
3. Was there any FMV override, and who authorized it and on what grounds?
4. If the workflow changed mid-flight (approver reassigned, step added), what triggered the change and who authorized it?

Systems commonly log events (`status_changed_to: approved`) without capturing the decision context. A log that says "approved by jsmith@pharma.com on 2025-03-15" is not enough if jsmith has since left the company and the approval authority delegation cannot be reconstructed.

**Warning signs:**
- Audit log captures state transitions but not the data snapshot at time of transition
- Approver is stored as a user FK — if user is deleted/deactivated, the log becomes orphaned
- FMV override path exists in the UI but the override reason is optional or not logged
- Delegation and out-of-office approvals are not separately marked in the log

**Prevention:**
- Audit log entries must be append-only, immutable, and self-contained: store the approver's name, title, and email as strings (not FK references) alongside the FK, so the record is human-readable even after user deactivation
- At each approval step, snapshot the key data the approver saw: HCP name/NPI, engagement type, proposed fee, rate card version, FMV threshold, debarment status at time of approval
- All FMV overrides must require a mandatory written justification field and a secondary approver — override without documented justification is audit-failing
- Workflow mutations (step added, approver changed, delegation activated) must create their own audit entries explaining the before/after and who made the change

**Which phase:** Phase 1 data model (audit table schema). Audit capture logic is woven through every phase. Non-negotiable to get right early.

---

### C5: Open Payments Submission File Structural Errors

**What goes wrong:**
CMS Open Payments has a specific XML/CSV file format with strict validation rules. Common structural failures:
- **Nature of payment category mismatch**: The payment category (e.g., "Consulting Fee" vs. "Education" vs. "Food and Beverage") is mapped incorrectly, and CMS's validation rejects the combination of category + payment form + covered recipient type
- **Physician vs. non-physician covered recipient type**: Teaching hospitals are reported differently from physicians — systems that conflate these produce malformed records
- **Aggregate threshold misapplication**: Payments below the annual de minimis threshold ($10.82 in recent years, adjusted annually) to a single recipient in a single category should be excluded. Systems that apply this threshold incorrectly either over-report (wasted work, confuses CMS) or under-report (creates a gap)
- **Missing required fields for specific payment categories**: Certain categories (research payments, ownership interest) have additional required fields. A generic submission generator that doesn't branch on category will produce incomplete records

**Warning signs:**
- Submission generator is a single generic template without category-specific branching
- De minimis threshold is hardcoded rather than configurable by year
- No pre-submission validation run against CMS published validation rules before file generation
- System does not distinguish teaching hospital vs. physician in the data model

**Prevention:**
- Map the full CMS Open Payments data dictionary and validation rules before building the submission generator — not after
- Build the de minimis threshold as a system configuration value with a year dimension, not a hardcoded constant
- Implement a pre-submission validation step that replicates CMS's published validation rules locally, so errors are caught before uploading
- Test against CMS's provided test data files and submission portal sandbox before go-live

**Which phase:** Open Payments export phase. But the data model implications (payment category enum, covered recipient type distinction) must be addressed in Phase 1.

---

## Major Pitfalls (significant rework if hit)

---

### M1: Approval Workflow Routing Loops and Dead Ends

**What goes wrong:**
Configurable approval workflows — especially multi-level ones (manager → compliance → legal) — create routing edge cases that only surface in production:
- **Circular delegation**: User A delegates to User B who has delegated to User A. Approval request enters an infinite loop.
- **Missing approver**: The designated approver for a step has been deactivated (left the company) and no fallback is configured. Engagement is stuck permanently in pending state with no way to advance.
- **Self-approval**: Requester is also the designated approver for one of the steps. Whether this is allowed or not, the system must have an explicit policy and enforce it — ambiguity here is an audit finding.
- **Approval granted after workflow config change**: Workflow is reconfigured mid-approval. Does the in-flight engagement use the old config or the new one? Either answer can be right, but it must be an explicit choice.

**Warning signs:**
- Workflow engine is written as simple sequential state machine without cycle detection
- Approver assignment is a direct user reference with no fallback/escalation path
- No admin-accessible "force advance" or "reassign approver" tool that creates an audit record when used
- Workflow configuration UI lets users save any configuration without validation

**Prevention:**
- At workflow configuration save time, validate for cycles in the delegation graph
- Every approval step must have an escalation path: if primary approver is inactive or has not acted within N days, the request escalates to their manager or a configured fallback role
- Build an admin "emergency advance" tool that requires a reason field and creates a permanent audit log entry — do not build a hidden backdoor
- Lock the workflow configuration snapshot onto the engagement at initiation time. In-flight engagements use the config that was in effect when they were created.

**Which phase:** Workflow engine design — Phase 2 (approval workflows). Escalation logic must not be deferred to a later phase.

---

### M2: NPI Deactivation Not Propagated

**What goes wrong:**
CMS deactivates NPIs for physicians who have retired, died, surrendered their license, or had the NPI revoked. A system that onboards an HCP with a valid NPI and never re-checks will continue to allow new engagements with a deactivated NPI holder. This is both a compliance exposure (paying an unlicensed practitioner) and an Open Payments submission problem (CMS may reject records referencing a deactivated NPI).

Less dramatically: an HCP may have multiple NPIs (individual vs. organizational, or a historical duplicate). The system may have linked to the wrong one or to both, creating duplicate engagement records.

**Warning signs:**
- NPPES lookup is performed only at onboarding
- HCP profile has no `npi_status` field that tracks active/inactive
- No process for handling an HCP whose NPI becomes inactive while they have in-flight engagements

**Prevention:**
- The rolling 90-day NPPES re-validation job (see C1) must also check NPI status and flag deactivated NPIs for immediate compliance review
- When an NPI is flagged inactive: freeze new engagement creation for that HCP, do not retroactively void historical completed engagements, notify the compliance team
- Data model: store `npi_status` and `npi_status_last_checked_at` on the HCP record

**Which phase:** Phase 1 data model, Phase 2 background job.

---

### M3: FMV Rate Enforcement Edge Cases

**What goes wrong:**

**Blended specialties**: An HCP who is both an MD and a PharmD, or has dual board certification, may span multiple rows in the FMV rate card. The system must define a single applicable rate — picking the highest (most permissive) is an audit risk; picking the lowest may be operationally impractical; picking by primary taxonomy is defensible but requires clean primary taxonomy data.

**Geography mismatches**: Rate cards often have regional tiers (e.g., Northeast/Southeast/Midwest/West or by state). An HCP licensed in multiple states or practicing in a border area may not map cleanly to one tier. If the system defaults to the most favorable rate without explicit configuration of how to handle multi-state HCPs, this becomes an audit finding.

**Rate for the engagement type vs. rate for the HCP's specialty**: Some clients differentiate rates by engagement type (advisory board vs. speaker vs. investigator). If the rate card has both dimensions (specialty × engagement type), the intersection may not always be populated. The system must handle sparse rate cards without silently defaulting to zero or an incorrect rate.

**Prevention:**
- Rate card upload validation must check for gaps and ambiguities relative to the HCP population — surface them to the compliance user at upload time, not at engagement creation time
- Rate selection logic must be explicit and auditable: log which rate row was selected and why for every engagement
- For multi-specialty HCPs, require an explicit "primary specialty for rate purposes" designation on the HCP record — do not infer it from rate card coverage

**Which phase:** Phase 1 (data model and rate card upload validation). Rate selection logic is Phase 2 (engagement creation).

---

### M4: Configuration Complexity Becoming Unmaintainable

**What goes wrong:**
"Configurable without code changes" is the right goal but the wrong implementation target for v1. The trap: every client exception gets added as a new configuration option. After 3 clients, the configuration schema has 40 fields, many of which interact in non-obvious ways. Compliance officers cannot understand what their own configuration does. Support burden is high. Bugs appear at configuration intersections that were never tested together.

A specific form of this in workflow configuration: boolean flags that interact multiplicatively. "Require dual approval when FMV exceeds threshold AND engagement type is advisory AND HCP is tier 1" — implemented as three separate boolean fields — produces 8 combinations, not all of which are validated. A misconfiguration silently disables a required approval step.

**Warning signs:**
- Every new client onboarding requires adding new configuration fields to accommodate their requirements
- Configuration is stored as a JSON blob with no schema validation
- No automated test suite covers configuration combinations
- Support requests disproportionately involve "the system didn't do what we configured it to do"

**Prevention:**
- Define the configuration schema before the first client onboards, based on the known variation across initial clients — not organically during onboarding
- Validate configuration at save time against a published schema, not at runtime
- Build a configuration preview/simulation tool: "with this configuration, here is what the approval chain would look like for a consulting engagement at $X with HCP of specialty Y" — this prevents misconfiguration and reduces support burden
- Treat configuration explosion as a product design failure, not a feature request fulfillment success

**Which phase:** Phase 1 (configuration schema design). This cannot be an afterthought.

---

### M5: Multi-Tenancy Migration Pitfalls

**What goes wrong:**
Single-tenant to multi-tenant migration is routinely underestimated. The most common failures:

**Implicit tenant assumption baked into queries**: Queries written without `tenant_id` filter work correctly in single-tenant but silently return cross-tenant data in multi-tenant. In a compliance platform, cross-tenant data leakage is a catastrophic privacy violation.

**Configuration that lives in code vs. configuration that lives in data**: In single-tenant, some "configuration" ends up as environment variables or deployment-time constants. When moving to multi-tenant, these must all be migrated to per-tenant configuration records. Systems that don't track which constants are actually configuration often miss some during migration.

**File storage with flat namespacing**: Contract PDFs, rate card uploads, and audit exports stored without per-tenant path prefixes. In single-tenant these are fine. In multi-tenant, they either clash (if naming isn't unique) or require a large migration to restructure storage paths.

**User authentication assuming one tenant**: Auth tables without `tenant_id` — users that exist in the system without a tenant context. Multi-tenant requires tenant-scoped user records (a user may exist in multiple tenants with different roles).

**Warning signs:**
- Any database query that doesn't include a `tenant_id` filter
- File storage paths based on `engagement_id` alone without a tenant prefix
- User table has no `tenant_id` column
- Configuration values are in environment variables or `config.yaml` rather than database rows

**Prevention:**
- Even in v1 single-tenant: add `tenant_id` as a non-nullable column on every significant table, populated with a constant value for the single tenant. This costs almost nothing now and makes v2 migration mechanical.
- Use row-level security (RLS) in PostgreSQL from day one — in v1, enable it but set a policy that passes all rows (trivially satisfied by tenant_id match). In v2, RLS becomes the actual enforcement layer without application code changes.
- Store all file uploads under a `/{tenant_id}/` prefix from day one
- Auth: one user record can have many tenant memberships (separate join table from day one)

**Which phase:** Phase 1 data model design. Non-negotiable. Multi-tenancy retrofit is a platform-level rewrite.

---

### M6: Contract Template Variable Edge Cases

**What goes wrong:**

**Null variable substitution**: A template has `{{hcp_middle_name}}` but many HCPs have no middle name. If the substitution logic inserts nothing, the output has double spaces or broken punctuation. If it inserts `null` or `undefined`, the contract is legally embarrassing. Template systems must handle optional variables explicitly.

**Rate card values in executed contracts not frozen**: The contract says "compensation shall be at the HCP's approved rate." If the rate is expressed as a reference rather than a specific dollar amount in the generated contract, and the rate card is later updated, the "current" rate changes but the executed contract is ambiguous. Contracts must contain specific dollar amounts, not pointers to rate cards.

**Version control of templates vs. executed contracts**: The template is updated (new legal language added). Previously generated contracts used the old template. If the system stores only a template reference (not the rendered output), it cannot reproduce the exact contract that was executed. This becomes a problem when the same template has been used to generate 200 contracts under different legal language versions.

**Character encoding in PDF generation**: HCP names with non-ASCII characters (accent marks, etc.) render incorrectly or break PDF generation entirely if the template engine or PDF renderer is not configured for UTF-8.

**Warning signs:**
- Contract generation uses template references rather than storing rendered output
- Template variables are not listed or validated at template upload time
- No test generation for HCPs with edge-case data (empty middle name, non-ASCII characters, maximum-length specialties)

**Prevention:**
- Store the fully rendered contract (PDF bytes or equivalent) as an immutable artifact at generation time, alongside metadata (template version used, HCP snapshot, rate snapshot)
- Template system must define required vs. optional variables explicitly, with default/formatting rules for optional fields
- Generate preview contracts during template upload that exercise all optional variable paths
- All string handling in template engine must be UTF-8 throughout

**Which phase:** Contract generation phase. Data model (immutable storage of rendered output) is critical from that phase's start.

---

## Common Gotchas (annoying but recoverable)

---

### G1: De Minimis Threshold Applied Wrong

**What goes wrong:**
The Sunshine Act's de minimis threshold (currently ~$10.82 per payment, ~$217 annually per recipient — verify current CMS figures) applies at the individual transfer-of-value level and at the annual aggregate level. Systems commonly:
- Apply the threshold at the transaction level only, missing the annual aggregate rule
- Hardcode the dollar amount, which CMS adjusts annually for inflation
- Apply it universally, not recognizing that the threshold does not apply to research payments or ownership/investment interests (those are always reportable)

**Warning signs:**
- De minimis threshold is a constant in source code
- System does not have a concept of "annual aggregate per covered recipient"
- Research payments are filtered through the same threshold logic as general payments

**Prevention:**
- Store the threshold amounts as system configuration keyed by reporting year
- Implement annual aggregate calculation as a first-class feature, not a filter
- Payment category determines threshold applicability — wire this logic to the payment category enum, not to a global threshold

**Which phase:** Open Payments export phase.

---

### G2: Scope Creep — "Just Add a Notes Field"

**What goes wrong:**
Compliance platforms accumulate free-text notes fields because every edge case feels like it needs a narrative. Within six months, the notes fields have become the actual compliance record while the structured fields are under-populated. Auditors will ask for a structured data export; exporting notes fields is not a structured export.

A related pattern: "just track this one more thing for us" — clients ask to track information that is out of scope of the regulatory requirement (e.g., internal cost center codes, conference registration numbers, catering vendor names). Each addition seems trivial. Collectively they create a data model that is difficult to maintain and confusing to query.

**Warning signs:**
- Multiple `notes TEXT` columns on the same table
- Fields that have no corresponding Open Payments disclosure field
- Data being entered in notes that should be in structured fields ("HCP rate agreed at $450, see rate card v3")

**Prevention:**
- Every new field requires a documented regulatory or operational justification tying it to a reportable or auditable requirement
- Notes fields are acceptable for genuinely unstructured narrative (e.g., approval rationale) but not as a substitute for structured data
- Regular data model reviews at the end of each phase to identify fields that are not being used as designed

**Which phase:** Ongoing — establish the governance rule in Phase 1, apply it throughout.

---

### G3: Approval Delegation Without Time Bounds

**What goes wrong:**
A compliance officer sets up a delegation ("while I'm on parental leave, approvals go to my deputy"). The leave ends but the delegation is not revoked. Six months later, the deputy has been approving things that should have gone to the compliance officer, and no one noticed because the system allowed it silently.

**Warning signs:**
- Delegation is configured as a permanent setting with no expiration date field
- No notification when a delegation expires or when a delegated approval occurs

**Prevention:**
- Delegations must have a mandatory expiration date
- When a delegation expires, the system must notify both parties and revert to the original routing
- Delegated approvals must be marked as such in the audit log (not attributed to the delegatee as if they were the designated approver)

**Which phase:** Workflow engine phase.

---

### G4: FMV Rate Card Upload Without Validation

**What goes wrong:**
A compliance officer uploads a new rate card Excel file. The system accepts it. The file had a formatting issue in one row (extra merged cell, leading space in the specialty name). The affected specialty's rate is silently set to zero or omitted. Engagements for that specialty proceed with no rate limit enforced.

**Warning signs:**
- Rate card upload is "fire and forget" — no confirmation screen showing what was parsed
- Upload errors are shown as counts ("2 rows skipped") without identifying which rows or why
- No check that the new rate card covers the same set of specialties as the previous one

**Prevention:**
- Rate card upload must display a full parsed preview before commit — showing every specialty/tier/geography combination that was parsed
- Flag rows that were skipped and require the user to acknowledge them
- Warn when the new card has fewer specialty rows than the previous card (regressions are likely mistakes)
- Validate that required specialty taxonomy codes are valid NUCC codes, not free-text strings

**Which phase:** Phase 1 (rate card upload feature).

---

### G5: Audit Export Is Not Actually Audit-Ready

**What goes wrong:**
The system generates an "audit report" that is a flat export of engagement records. Auditors need more than a spreadsheet of engagements. They will ask:
- Show me every change to this engagement record, who made it, and when
- Show me the approval chain with timestamps for each step
- Show me the FMV rate card version that was in effect when this contract was signed
- Show me the debarment check result for this HCP at the time of this engagement

If the export is just current-state data, it cannot answer any of these questions. The system becomes a compliance liability rather than a compliance asset.

**Warning signs:**
- "Audit export" is a database dump of current state
- Historical versions of records are not retained
- The export format is not the format auditors ask for (they often want structured Excel or a specific agency-requested format, not a developer-friendly JSON)

**Prevention:**
- Audit export must be built from the audit log (immutable event history), not from current state
- Export must support filtering by HCP, by engagement, by date range, by approval step — not just "everything"
- Include a format that matches what a real OIG audit information request looks like — build this against a real-world audit request letter if one can be obtained from a client

**Which phase:** Audit/reporting phase, but the audit log schema enabling this is Phase 1.

---

### G6: Specialty Taxonomy — Using Display Names Instead of Codes

**What goes wrong:**
NUCC taxonomy codes are the standard for specialty identification in NPPES and Open Payments. Using specialty display names ("Internal Medicine" vs. "Internal Medicine - General" vs. "General Internal Medicine") creates matching ambiguities. The FMV rate card, the NPPES record, and the Open Payments submission all need to agree on specialty. If the rate card uses informal names and NPPES uses NUCC codes, every specialty match requires a fuzzy lookup that will occasionally fail or produce wrong matches.

**Warning signs:**
- Specialty stored as `VARCHAR` with no validation against a reference list
- Rate card upload accepts any specialty string without validating against NUCC taxonomy
- Multiple rows in the HCP table with slightly different spellings of the same specialty

**Prevention:**
- Use NUCC taxonomy codes as the primary specialty identifier throughout the entire data model
- Display names are derived from the NUCC code at render time, not stored independently
- Rate card upload validates specialty values against the NUCC taxonomy list
- Maintain a local copy of the NUCC taxonomy table in the database (it updates infrequently)

**Which phase:** Phase 1 data model.

---

### G7: Engagement State Machine Underspecification

**What goes wrong:**
Engagement lifecycle states are defined loosely (Draft → Pending → Approved → Contracted → Completed) without specifying all valid transitions. In production, edge cases arise:
- Can a Completed engagement be re-opened? (A client will ask.)
- Can an Approved engagement be withdrawn before contract generation? (An HCP declines.)
- What happens if a contract is generated but the HCP never signs? Is it Contracted or still Approved?
- Can a Pending engagement be edited? If yes, does it reset the approval chain?

If these transitions are not specified upfront, the codebase accumulates ad-hoc state mutations that are hard to audit.

**Warning signs:**
- State transitions are implicit (just setting a status field) rather than explicit (named transition events)
- Edit behavior on in-progress engagements is undefined or left to the UI layer to prevent
- No state transition diagram exists in the design documents

**Prevention:**
- Define the complete state machine with every state and every valid transition before implementation
- Implement transitions as named operations (not direct field updates) so each transition can carry an audit log entry
- Specifically decide and document: what happens to approval state when an engagement is edited? (Recommended: any substantive edit resets the approval chain and creates an audit entry)

**Which phase:** Phase 2 (engagement workflow), but the state enum must be in Phase 1 schema.

---

## Phase-Specific Warning Matrix

| Phase Topic | Most Likely Pitfall | Key Mitigation |
|-------------|---------------------|----------------|
| HCP onboarding / NPI | C1 (NPPES drift), M2 (NPI deactivation), G6 (taxonomy codes) | Use NUCC codes as PK, schedule NPPES re-validation from day one |
| FMV rate cards | C2 (versioning), M3 (edge cases), G4 (upload validation) | Immutable rate rows with effective dates; preview-before-commit upload |
| Debarment checks | C3 (false negatives) | NPI-first matching, recurring re-check, third-party screening API |
| Approval workflows | M1 (loops/dead ends), G3 (delegation) | Cycle detection at config save; mandatory expiration on delegations |
| Contract generation | M6 (template variables), G5 (audit gaps) | Immutable rendered output storage; explicit optional variable handling |
| Open Payments export | C5 (structural errors), G1 (de minimis) | Pre-flight validation against CMS rules; configurable threshold by year |
| Configuration system | M4 (complexity explosion) | Schema-validated config; simulation/preview tool for compliance officers |
| Multi-tenant v2 | M5 (migration pitfalls) | tenant_id on every table from Phase 1; RLS from day one |
| Audit/reporting | C4 (audit trail gaps), G5 (export not audit-ready) | Append-only event log from Phase 1; export built from log not current state |
| Data model (ongoing) | G2 (scope creep), G7 (state machine) | Explicit state machine spec; documented justification for every new field |

---

## Confidence Notes

- **HIGH confidence**: Open Payments covered recipient matching, NUCC taxonomy requirements, OIG LEIE/SAM.gov debarment mechanics, audit trail requirements for OIG scrutiny, state machine design patterns — these are well-documented regulatory requirements
- **MEDIUM confidence**: Specific CMS validation rules, current de minimis threshold dollar amounts, NPI re-check frequency requirements — directionally correct from training data but should be validated against current CMS Open Payments Program Instructions at submission time
- **LOW confidence**: Specific behavior of competitor platforms (Alanda, Medcompli) and their known failure modes — this assessment is based on general pharma compliance platform patterns, not firsthand knowledge of those platforms' architectures

**Recommended validation steps before building:**
1. Download current CMS Open Payments Program Instructions from cms.gov/OpenPayments — validate de minimis thresholds, submission file format, and covered recipient matching rules against current year's instructions
2. Obtain a real OIG audit information request letter from a client — build the audit export format against it
3. Consult current NUCC taxonomy list (nucc.org) for specialty code validation
