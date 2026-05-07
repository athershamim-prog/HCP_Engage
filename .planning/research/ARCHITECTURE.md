# Architecture Research: HCP Engage

**Domain:** Pharma compliance / HCP engagement management
**Researched:** 2026-05-07
**Confidence:** HIGH (well-established compliance SaaS patterns; NPI/OIG/SAM.gov integrations are public and stable)

---

## Core Domain Model

### Entities and Relationships

```
TENANT (v2 concept — scoped to single client row in v1)
  └─ has many: ENGAGEMENT_TYPE_CONFIG
  └─ has many: APPROVAL_CHAIN_CONFIG
  └─ has many: FMV_RATE_CARD (versioned)
  └─ has many: HCP
  └─ has many: ENGAGEMENT

HCP (Healthcare Professional)
  ├─ identity: npi (10-digit, unique per HCP), first/last name, credentials
  ├─ classification: specialty (CMS taxonomy code), sub_specialty, primary_state, hco_affiliation
  ├─ status: onboarding_status (PENDING | VERIFIED | ACTIVE | DEBARRED | INACTIVE)
  ├─ verification:
  │    └─ NPI_VERIFICATION (timestamp, npi_registry_response_snapshot, verified_at)
  │    └─ DEBARMENT_CHECK (oig_status, sam_status, checked_at, result, raw_response_snapshot)
  ├─ fmv_assignment: tier, applicable_rate_card_id, assigned_at
  └─ consent: consent_type, consented_at, consent_doc_ref

FMV_RATE_CARD
  ├─ version, effective_date, expiry_date, status (DRAFT | ACTIVE | SUPERSEDED)
  ├─ source_file_ref (original uploaded Excel/CSV)
  └─ has many: FMV_RATE_LINE
       └─ specialty, tier, geography_scope, engagement_type, rate_per_hour (or flat), currency

ENGAGEMENT
  ├─ identity: engagement_id, engagement_type (foreign key to ENGAGEMENT_TYPE_CONFIG)
  ├─ lifecycle: status (DRAFT | SUBMITTED | UNDER_REVIEW | APPROVED | CONTRACTED |
  │              IN_PROGRESS | COMPLETED | CANCELLED | REJECTED)
  ├─ parties: hcp_id, requestor_user_id, owning_business_unit
  ├─ scope: description, objectives, activity_date_start, activity_date_end, location
  ├─ fmv_snapshot: rate_card_version, rate_at_approval, total_fmv_ceiling
  ├─ spend: actual_spend (recorded post-completion, not processed)
  └─ disclosure: reporting_period, sunshine_act_category, disclosed_at

APPROVAL_STEP
  ├─ engagement_id, chain_position (ordinal)
  ├─ approver_role (e.g. MANAGER | COMPLIANCE | LEGAL) or approver_user_id
  ├─ status (PENDING | APPROVED | REJECTED | SKIPPED)
  ├─ decided_at, decided_by, comments
  └─ is_immutable (set to true once decided — never updated, only superceded by new step)

CONTRACT
  ├─ engagement_id (1-to-1 in v1, 1-to-many for amendments in v2)
  ├─ template_id, template_version
  ├─ merge_data_snapshot (JSON — all field values at generation time)
  ├─ generated_at, generated_by
  ├─ document_ref (S3/blob key for generated PDF)
  └─ status (DRAFT | EXECUTED | SUPERSEDED)

TRANSFER_OF_VALUE (TOV)
  ├─ engagement_id (nullable — some TOVs are standalone meals/travel)
  ├─ hcp_id
  ├─ tov_category (CONSULTING_FEE | FOOD_BEVERAGE | TRAVEL | EDUCATION | RESEARCH | OTHER)
  ├─ sunshine_act_nature_of_payment (maps to CMS Open Payments taxonomy)
  ├─ amount, currency, payment_date (recorded, not processed)
  ├─ payer_ein, payer_name (for disclosure)
  └─ disclosure_status (UNREPORTED | INCLUDED_IN_EXPORT | SUBMITTED_TO_CMS)

AUDIT_EVENT (append-only)
  ├─ event_id (UUID), occurred_at (server timestamp, UTC)
  ├─ actor_type (USER | SYSTEM | INTEGRATION), actor_id
  ├─ entity_type, entity_id
  ├─ event_type (e.g. HCP_CREATED, DEBARMENT_CHECK_RUN, APPROVAL_GRANTED, TOV_RECORDED)
  ├─ before_state (JSON snapshot), after_state (JSON snapshot)
  └─ source_ip, session_id, checksum (SHA-256 of row fields for tamper detection)
```

### Key Invariants

- An ENGAGEMENT cannot advance to APPROVED without all required APPROVAL_STEPs resolved.
- An ENGAGEMENT cannot proceed to CONTRACTED if the HCP's debarment check is older than `client.debarment_check_ttl_days` (configurable, default 365).
- Every TOV must reference a valid HCP with NPI. No NPI = not disclosable = blocked.
- The FMV rate at approval is snapshotted onto the ENGAGEMENT — subsequent rate card changes do not retroactively alter approved engagements.
- AUDIT_EVENT rows are INSERT-only. No UPDATE or DELETE is ever issued against this table. Enforced at the database permission level (separate write-only role for audit inserts).

---

## System Components

### Component Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            HCP Engage Platform                              │
│                                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────────────────────┐  │
│  │   Web UI     │    │                  API Layer                       │  │
│  │  (Next.js)   │◄──►│  (Next.js API Routes / tRPC)                    │  │
│  │              │    │  - Auth middleware (session + RBAC)              │  │
│  │  Compliance  │    │  - Request validation (Zod)                     │  │
│  │  Officer     │    │  - Audit event emission                         │  │
│  │  Finance     │    └────────────┬─────────────────────────────────────┘  │
│  │  Admin       │                 │                                         │
│  └──────────────┘    ┌────────────▼─────────────────────────────────────┐  │
│                       │           Domain Services                        │  │
│                       │                                                  │  │
│  ┌────────────────┐   │  ┌─────────────┐  ┌────────────────────────┐   │  │
│  │ Background     │   │  │  HCP        │  │  Engagement            │   │  │
│  │ Workers        │   │  │  Service    │  │  Service               │   │  │
│  │ (BullMQ /      │   │  │             │  │                        │   │  │
│  │  pg-boss)      │   │  │ - Onboard   │  │ - Submit request       │   │  │
│  │                │   │  │ - Verify    │  │ - Advance workflow     │   │  │
│  │ - Debarment    │   │  │   NPI       │  │ - Enforce FMV ceiling  │   │  │
│  │   refresh job  │   │  │ - Check     │  │ - Gate on debarment    │   │  │
│  │ - Disclosure   │   │  │   OIG/SAM   │  │   check TTL            │   │  │
│  │   export job   │   │  └─────────────┘  └────────────────────────┘   │  │
│  │ - Rate card    │   │                                                  │  │
│  │   activation   │   │  ┌─────────────┐  ┌────────────────────────┐   │  │
│  └────────────────┘   │  │  Approval   │  │  Contract              │   │  │
│                       │  │  Engine     │  │  Service               │   │  │
│                       │  │             │  │                        │   │  │
│                       │  │ - State     │  │ - Select template      │   │  │
│                       │  │   machine   │  │ - Merge fields         │   │  │
│                       │  │ - Route to  │  │ - Generate PDF         │   │  │
│                       │  │   approver  │  │ - Store & link         │   │  │
│                       │  │ - Notify    │  └────────────────────────┘   │  │
│                       │  └─────────────┘                               │  │
│                       │                                                  │  │
│                       │  ┌─────────────┐  ┌────────────────────────┐   │  │
│                       │  │  FMV        │  │  Disclosure            │   │  │
│                       │  │  Service    │  │  Service               │   │  │
│                       │  │             │  │                        │   │  │
│                       │  │ - Parse     │  │ - Aggregate TOVs       │   │  │
│                       │  │   upload    │  │ - Map to CMS taxonomy  │   │  │
│                       │  │ - Validate  │  │ - Generate export      │   │  │
│                       │  │ - Activate  │  │ - Mark as disclosed    │   │  │
│                       │  │ - Look up   │  └────────────────────────┘   │  │
│                       │  └─────────────┘                               │  │
│                       │                                                  │  │
│                       │  ┌──────────────────────────────────────────┐   │  │
│                       │  │  Audit Service (cross-cutting)           │   │  │
│                       │  │  - Emit AUDIT_EVENT on every mutation    │   │  │
│                       │  │  - Checksum each row                     │   │  │
│                       │  │  - Never update/delete                   │   │  │
│                       │  └──────────────────────────────────────────┘   │  │
│                       └──────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Data Layer                                    │   │
│  │  PostgreSQL (primary)     │  File Store (S3 / local in dev)        │   │
│  │  - app schema (RLS in v2) │  - uploaded rate cards                 │   │
│  │  - audit schema (WO role) │  - generated contracts (PDF)           │   │
│  │  - config schema          │  - uploaded templates                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    External Integration Layer                       │   │
│  │  NPI Registry (CMS) │ OIG LEIE (HHS) │ SAM.gov (GSA)             │   │
│  │  REST/JSON           │  CSV download   │  REST API                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Owns | Does Not Own |
|---|---|---|
| HCP Service | NPI verification, debarment check, onboarding state, FMV tier assignment | Engagement scheduling, approval routing |
| Engagement Service | Lifecycle state, FMV ceiling enforcement, TOV recording | Approval routing logic, document generation |
| Approval Engine | Workflow state machine, step routing, approver notification | Business rules (FMV, debarment) — those are enforced by Engagement Service pre-submission |
| Contract Service | Template selection, field merge, PDF generation, file storage | Approval decisions, spend tracking |
| FMV Service | Rate card parsing, validation, versioning, activation, lookups | HCP tier assignment (calls back to HCP Service) |
| Disclosure Service | TOV aggregation, CMS taxonomy mapping, export file generation, disclosure status marking | TOV creation (Engagement Service creates TOVs) |
| Audit Service | AUDIT_EVENT emission and integrity | Any domain logic — it only observes and records |
| Background Workers | Scheduled debarment refreshes, disclosure export runs, rate card activation | UI, synchronous request handling |
| Config Layer | Approval chain shapes, engagement type definitions, client-level policy settings | Executing the workflow (that's Approval Engine's job) |

---

## Data Flow

### 1. HCP Onboarding Flow

```
Admin uploads HCP data (CSV or manual entry)
  → HCP Service creates HCP record (status: PENDING)
  → Audit: HCP_CREATED
  → HCP Service calls NPI Registry API (HTTPS, synchronous or queued)
      ├─ Match found → update npi_verified_at, save response snapshot
      ├─ No match → flag for manual review
      └─ Audit: NPI_VERIFICATION_COMPLETED
  → HCP Service calls OIG LEIE (check local DB copy refreshed weekly)
  → HCP Service calls SAM.gov API
      ├─ Clear → debarment_status: CLEAR, checked_at: now
      ├─ Hit → debarment_status: DEBARRED, flag, block engagements
      └─ Audit: DEBARMENT_CHECK_COMPLETED
  → FMV Service looks up applicable rate (specialty + tier + geography → rate_card)
  → HCP record moves to ACTIVE
  → Audit: HCP_ACTIVATED
```

### 2. FMV Rate Card Upload Flow

```
Compliance admin uploads Excel/CSV
  → FMV Service receives file → stores raw file in blob store
  → Parser extracts rows → validates:
      - Required columns present (specialty, tier, geography, rate)
      - No missing values
      - Rates are positive numbers
      - Specialties map to known CMS taxonomy codes
      - No duplicate (specialty, tier, geography, engagement_type) keys
  → On validation pass: creates FMV_RATE_CARD (status: DRAFT) + all FMV_RATE_LINEs
  → Admin previews card in UI
  → Admin activates → FMV Service:
      - Sets new card status: ACTIVE, effective_date: today
      - Sets previous ACTIVE card status: SUPERSEDED, expiry_date: today-1
      - Audit: RATE_CARD_ACTIVATED
  → All future FMV lookups use new ACTIVE card
  → Existing approved engagements retain their snapshotted rate (not retroactively changed)
```

### 3. Engagement Request Flow

```
Requestor submits engagement request
  → Engagement Service validates:
      - HCP status = ACTIVE
      - HCP debarment check age < TTL (configurable)
      - Engagement type is allowed (from ENGAGEMENT_TYPE_CONFIG)
      - Requested rate ≤ FMV ceiling for HCP specialty/tier/geography/type
  → If valid: ENGAGEMENT created (status: SUBMITTED)
  → Audit: ENGAGEMENT_SUBMITTED
  → Approval Engine reads APPROVAL_CHAIN_CONFIG for this engagement_type
  → Approval Engine creates APPROVAL_STEPs for each position in chain
  → Step 1 approver notified (email / in-app)
  → Audit: APPROVAL_STEP_CREATED (for each step)

Approver reviews and approves Step N
  → APPROVAL_STEP.status = APPROVED, decided_at = now, decided_by = user_id
  → Audit: APPROVAL_STEP_DECIDED
  → If N < total steps: notify next approver
  → If N = total steps: Engagement Service moves engagement to APPROVED
  → Audit: ENGAGEMENT_APPROVED
  → Contract Service triggered (auto or manual):
      - Selects template for engagement_type
      - Merges fields from HCP, ENGAGEMENT, FMV snapshot
      - Generates PDF
      - Stores PDF → CONTRACT record linked to ENGAGEMENT
      → Audit: CONTRACT_GENERATED
```

### 4. Spend Recording and Disclosure Flow

```
Post-engagement: Finance records actual spend
  → Engagement Service records actual_spend on ENGAGEMENT
  → TOV created: hcp_id, engagement_id, tov_category, amount, payment_date
  → Audit: TOV_RECORDED

Disclosure export (annual, triggered by compliance officer or background job):
  → Disclosure Service queries all TOVs for reporting_period where
      disclosure_status = UNREPORTED and hcp has valid NPI
  → Aggregates by: hcp (NPI), tov_category, sunshine_act_nature_of_payment
      (per CMS Open Payments rules: some categories aggregate, some are itemized)
  → Validates: all required disclosure fields present (NPI, physician name, payer EIN, etc.)
  → Generates export file (CSV matching CMS Open Payments submission format)
  → Stores export file
  → Marks all included TOVs: disclosure_status = INCLUDED_IN_EXPORT
  → Audit: DISCLOSURE_EXPORT_GENERATED
```

---

## Multi-Tenancy Strategy

### V1: Single-Tenant with Tenant Row

**Approach:** Every table includes a `tenant_id` column even in v1, pointing to a single row in the `tenant` table. No physical isolation in v1, but the data model is tenant-aware from day one.

**Why this matters:** When v2 multi-tenancy arrives, the migration is to add Row-Level Security policies and a middleware injection of `tenant_id`, not a schema redesign. The data is already partitioned logically.

```sql
-- Every application table has:
tenant_id UUID NOT NULL REFERENCES tenant(id)

-- Index on every tenant_id column for query performance
CREATE INDEX ON engagement(tenant_id);
CREATE INDEX ON hcp(tenant_id);
-- etc.
```

**V1 config:** Single `tenant_id` constant in environment variables. All queries automatically scope to it. Application code is written to always include `tenant_id` in inserts and filters — no exceptions.

### V2: Row-Level Security (RLS) Path

The recommended multi-tenant strategy for v2 is **row-level security in PostgreSQL** (not schema-per-tenant, not DB-per-tenant).

**Rationale:**

| Strategy | Tenant isolation | Migration cost from v1 | Operational cost | Compliance suitability |
|---|---|---|---|---|
| Row-Level Security (RLS) | Logical (enforced at DB) | Low — add policies | Low — single DB | HIGH — sufficient for SaaS compliance; simpler audit |
| Schema-per-tenant | Physical (separate schema) | High — schema migration per tenant | Medium — schema management tooling | MEDIUM — overkill for this use case |
| DB-per-tenant | Physical (separate database) | Very high — data migration | High — multiple DB instances | LOW value — reserved for clients who contractually require it |

**RLS implementation pattern:**

```sql
-- Postgres session variable injected by application middleware
SET app.current_tenant_id = '<uuid>';

-- Policy on each table
CREATE POLICY tenant_isolation ON hcp
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE hcp ENABLE ROW LEVEL SECURITY;
```

**Audit schema exception:** The `audit_event` table uses a separate write-only DB role and is NOT covered by RLS for tenant data isolation — instead it has its own `tenant_id` column scoped by a different policy pattern. Audit reads require an elevated admin role, never exposed to tenant users.

**Schema-per-tenant escape hatch:** If a client contractually requires physical isolation (e.g. a large pharma requiring dedicated infrastructure), the architecture accommodates this via a connection-routing layer that points to a separate database. This is a deployment configuration change, not an application code change.

---

## Configuration Architecture

### Per-Client Configuration Without Code Changes

The configuration layer is a structured JSON/database config set per `tenant_id`. It covers three areas:

#### 1. Engagement Type Config

```json
{
  "engagement_types": [
    {
      "id": "advisory-board",
      "label": "Advisory Board",
      "sunshine_act_category": "CONSULTING_FEE",
      "requires_contract": true,
      "max_duration_hours": 8,
      "allowed_tov_categories": ["CONSULTING_FEE", "TRAVEL", "FOOD_BEVERAGE"],
      "approval_chain_id": "standard-three-level"
    },
    {
      "id": "speaker-program",
      "label": "Speaker Program",
      "sunshine_act_category": "SPEAKER_BUREAU",
      "requires_contract": true,
      "max_duration_hours": 4,
      "allowed_tov_categories": ["SPEAKER_FEE", "FOOD_BEVERAGE"],
      "approval_chain_id": "compliance-only"
    }
  ]
}
```

#### 2. Approval Chain Config

```json
{
  "approval_chains": [
    {
      "id": "standard-three-level",
      "label": "Standard 3-Level",
      "steps": [
        { "position": 1, "role": "MANAGER", "label": "Line Manager Approval" },
        { "position": 2, "role": "COMPLIANCE", "label": "Compliance Review" },
        { "position": 3, "role": "LEGAL", "label": "Legal Sign-off",
          "condition": "engagement.total_fmv_ceiling > 5000" }
      ]
    },
    {
      "id": "compliance-only",
      "label": "Compliance-Only",
      "steps": [
        { "position": 1, "role": "COMPLIANCE", "label": "Compliance Review" }
      ]
    }
  ]
}
```

Note the `condition` field: steps can be conditionally included based on engagement properties (e.g. spend threshold triggers legal review). The Approval Engine evaluates conditions when instantiating steps — a step with a false condition is skipped and recorded as `SKIPPED` (not deleted — the audit log shows it was considered and skipped).

#### 3. Client Policy Config

```json
{
  "policy": {
    "debarment_check_ttl_days": 365,
    "require_npi_for_all_hcps": true,
    "fmv_overage_allowed_pct": 0,
    "disclosure_reporting_period": "CALENDAR_YEAR",
    "contract_template_set_id": "standard-v2"
  }
}
```

#### Config Storage Pattern

Config is stored in the database (not flat files or environment variables) so it is:
- Versioned (each config change logged in AUDIT_EVENT)
- Tenant-scoped (safe for v2 multi-tenancy)
- Changeable by admin UI without deployments

A `config_version` table tracks history. The application always reads the `ACTIVE` config version for the current tenant. Admin changes create a new config version and activate it — the old version is retained for audit purposes.

---

## Audit Trail Design

### Design Principles

1. **Append-only table** — No UPDATE or DELETE ever issued. Enforced by database permission (application DB role does not have UPDATE/DELETE on `audit_event`).
2. **Row-level checksum** — SHA-256 of `(event_id, occurred_at, actor_id, entity_type, entity_id, event_type, before_state, after_state)` stored in the row. Periodic integrity job verifies checksums.
3. **Before/after state snapshots** — Every mutation records full JSON snapshots of the entity before and after. This enables point-in-time reconstruction without log replay.
4. **Server-side timestamps** — `occurred_at` is always set server-side (`NOW()` in the DB transaction, UTC). Client-supplied timestamps are never trusted for audit purposes.
5. **Separation from application schema** — Audit table lives in a separate `audit` schema with a dedicated write-only DB role. Application services call `INSERT` only via an audit helper. The application's main DB role has no privileges on `audit.*` except via a stored function.
6. **Immutable references** — `entity_id` always references the stable UUID of the entity. Even if an entity is soft-deleted, the audit record is never orphaned (no FK constraint that cascades delete to audit rows).

### Audit Event Schema

```sql
CREATE TABLE audit.event (
  event_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type     TEXT        NOT NULL CHECK (actor_type IN ('USER','SYSTEM','INTEGRATION')),
  actor_id       TEXT        NOT NULL,  -- user UUID, system name, or integration key
  entity_type    TEXT        NOT NULL,  -- 'HCP', 'ENGAGEMENT', 'TOV', 'APPROVAL_STEP', etc.
  entity_id      UUID        NOT NULL,
  event_type     TEXT        NOT NULL,  -- 'HCP_CREATED', 'APPROVAL_GRANTED', etc.
  before_state   JSONB,
  after_state    JSONB,
  source_ip      INET,
  session_id     TEXT,
  checksum       TEXT        NOT NULL   -- SHA-256 of canonical fields
);

-- Partitioned by occurred_at (monthly) for query performance at scale
-- Partition pruning makes annual disclosure queries fast
```

### Events That Must Be Audited

Every audit-worthy action in the domain:

| Category | Events |
|---|---|
| HCP | HCP_CREATED, NPI_VERIFIED, DEBARMENT_CHECK_RUN, HCP_ACTIVATED, HCP_DEACTIVATED |
| Engagement | ENGAGEMENT_SUBMITTED, ENGAGEMENT_APPROVED, ENGAGEMENT_REJECTED, ENGAGEMENT_CANCELLED, ENGAGEMENT_COMPLETED |
| Approval | APPROVAL_STEP_CREATED, APPROVAL_STEP_DECIDED (approved/rejected/skipped), APPROVAL_CHAIN_CHANGED |
| Contract | CONTRACT_GENERATED, CONTRACT_SUPERSEDED |
| FMV | RATE_CARD_UPLOADED, RATE_CARD_VALIDATED, RATE_CARD_ACTIVATED, RATE_CARD_SUPERSEDED |
| TOV | TOV_RECORDED, TOV_AMENDED, TOV_VOIDED |
| Disclosure | DISCLOSURE_EXPORT_GENERATED, TOV_MARKED_DISCLOSED |
| Config | CONFIG_VERSION_ACTIVATED, APPROVAL_CHAIN_MODIFIED |
| Auth | USER_LOGIN, USER_LOGOUT, PERMISSION_DENIED |

### Regulatory Retention

Sunshine Act regulations require records to be maintained for a minimum of 5 years post-reporting. The audit schema must enforce retention policies — no row may be deleted within the retention window. A background job flags any attempt to delete within the window.

---

## Integration Architecture

### NPI Registry (CMS NPPES)

**Source:** `https://npiregistry.cms.hhs.gov/api/`
**Method:** REST/JSON, no auth required, free public API
**Pattern:** Synchronous pull at HCP onboarding time; periodic re-verification (annual or on-demand)

```
HCP Service → GET /api/?number={npi}&version=2.1
  → Parse: provider name, taxonomy codes (specialty), primary practice state, credential
  → Store: full response as npi_registry_snapshot (JSONB), verified_at timestamp
  → Cross-reference: name must match submitted HCP name (fuzzy match acceptable; flag mismatches)
```

**Rate limits:** CMS does not publish hard rate limits but recommends avoiding bulk hammering. For bulk initial imports, use a queued worker with 100ms delay between calls or use the NPI NPPES bulk download (monthly) and load locally.

**NPPES Bulk Download:** CMS publishes monthly full NPI database extracts at `https://download.cms.gov/nppes/NPI_Files.html`. For large client imports (>500 HCPs), load the bulk file locally and verify against local copy. For single onboardings, use the live API.

### OIG List of Excluded Individuals/Entities (LEIE)

**Source:** `https://oig.hhs.gov/exclusions/exclusions_lists.asp`
**Method:** Monthly CSV download (not a real-time API)
**Pattern:** Scheduled batch — download monthly CSV, load into local `oig_exclusion` table, verify all active HCPs against it

```
Background Worker (monthly scheduled job):
  → Download LEIE CSV from OIG website
  → Parse: first_name, last_name, npi, exclusion_type, exclusion_date, reinstatement_date
  → Upsert into local oig_exclusion table
  → For each active HCP: run local match (NPI primary match; name fallback)
  → If newly excluded: flag HCP, emit DEBARMENT_CHECK_RUN (result: EXCLUDED), notify compliance
```

**Matching strategy:** NPI is the primary key for matching. Name-only matching has false positive risk (common names). Always prefer NPI match; only fall back to name match with manual review flag.

### SAM.gov (GSA System for Award Management)

**Source:** `https://api.sam.gov/`
**Method:** REST API, requires SAM.gov API key (free registration)
**Pattern:** Synchronous check at onboarding; scheduled re-check (quarterly recommended)

```
HCP Service → GET /entity-information/v3/entities?
    ueiSAM={uei} OR registrationCountry=US&legalBusinessName={name}
    (for individuals: search by name and SSN is not available — use NPI crosswalk)
  → Check exclusion_flag, exclusionStatusFlag in response
  → Store result + timestamp
```

**Note:** SAM.gov individual exclusions overlap significantly with OIG LEIE but include additional federal exclusion categories (e.g., procurement fraud). Both checks are required for full compliance.

**Practical approach for v1:** Run SAM.gov via name + NPI crosswalk lookup. SAM.gov does not index individuals the same way it indexes entities. Document the matching methodology in the audit record — regulators ask how you verified.

### Integration Failure Handling

| Integration | Failure Mode | Action |
|---|---|---|
| NPI Registry down | Transient API failure | Retry 3x with backoff; queue for later; do not block onboarding if retry exhausted — flag for manual review |
| OIG download fails | Monthly job fails | Alert compliance team; retain previous month's data; do not mark HCPs as clear on failure |
| SAM.gov API fails | Transient or auth | Retry 3x; if persistent, block engagement approval (fail safe: debarment unknown = cannot approve) |

**Fail-safe principle:** On integration failure, the system must fail toward compliance caution, not permissiveness. Unknown debarment status = engagement cannot advance.

---

## Build Order

### Dependency Analysis

The build order is driven by two constraints:
1. **Data dependencies** — entity A must exist before entity B can reference it
2. **Risk mitigation** — the most complex/uncertain components are built first when the codebase is small and easy to change

### Recommended Build Sequence

#### Layer 0 — Foundation (no dependencies)
Everything that must exist before any domain logic can run.

1. **Database schema + migrations** — tenant, hcp, engagement, approval_step, contract, tov, audit_event tables; `tenant_id` on every table; audit schema with write-only role
2. **Auth + RBAC** — session management, role definitions (ADMIN, COMPLIANCE_OFFICER, MANAGER, LEGAL, FINANCE), permission guards on all routes
3. **Audit service** — cross-cutting, no domain dependencies; must be ready before any entity is created
4. **Config schema + loader** — engagement_type_config, approval_chain_config, policy_config; admin UI to edit; config versioning

*Why first:* Every component downstream emits audit events and reads config. These must be stable before anything else is built on top.

#### Layer 1 — HCP Management (depends on: Layer 0)

5. **HCP Service** — create, onboard, verify NPI (live API), debarment check (OIG + SAM.gov), status transitions, FMV tier assignment
6. **FMV Service** — rate card upload, parse (Excel/CSV), validate, activate, supersede, lookup by specialty/tier/geography/type
7. **NPI Registry integration** — live API call + local NPPES bulk load path
8. **OIG LEIE integration** — monthly CSV download worker, local exclusion table, HCP re-check
9. **SAM.gov integration** — API check, local cache, scheduled re-check

*Why before engagements:* An engagement cannot exist without a verified HCP and an active FMV rate card. Both must be functional and tested before engagement submission opens.

#### Layer 2 — Engagement Lifecycle (depends on: Layer 0, Layer 1)

10. **Engagement Service** — create, submit, validate (HCP active, FMV ceiling check, debarment TTL check), status machine
11. **Approval Engine** — read chain config, instantiate steps, route to approver, evaluate conditions (e.g. spend threshold), advance on approval, handle rejection/cancellation
12. **Notification service** (thin) — email notification to approver on step activation; no external dependencies beyond SMTP

*Why in this order:* The Approval Engine is the most complex component (conditional chains, step routing, state machine). Build it on a stable HCP and FMV foundation so test cases are realistic.

#### Layer 3 — Contract Generation (depends on: Layer 0, Layer 1, Layer 2)

13. **Template management** — upload DOCX/HTML templates, tag merge fields, version templates, assign per engagement_type
14. **Contract Service** — select template, merge HCP + engagement + FMV data, generate PDF (using Puppeteer/HTML-to-PDF or a server-side library), store PDF, link CONTRACT record to ENGAGEMENT
15. **File store integration** — S3-compatible blob store (or local filesystem in dev), signed URL generation for contract download

*Why after approval:* Contracts are only generated post-approval. Building contracts before the approval engine is verified creates unreliable test data.

#### Layer 4 — Spend Tracking + Disclosure (depends on: Layer 0, Layer 1, Layer 2)

16. **TOV recording** — link to engagement, record amount, date, category, sunshine_act mapping
17. **Disclosure Service** — aggregate TOVs by HCP/period/category, validate completeness, generate CMS Open Payments CSV export, mark TOVs as disclosed
18. **Reporting UI** — spend dashboard, aggregation by HCP/period/type, export trigger

*Why last:* Disclosure requires complete and accurate TOV data. Building and testing the export before the upstream data is reliable produces a false green.

#### Layer 5 — Operational + Polish (depends on: all layers)

19. **Background job infrastructure** — debarment re-check scheduler, OIG monthly download scheduler, rate card activation scheduler
20. **Admin UI** — config editing (engagement types, approval chains, policy), user management, rate card management
21. **Audit viewer** — compliance officer view of audit log per entity, export for regulatory review
22. **Performance + security hardening** — RLS policy stubs (for v2 readiness), query indexes validated, rate limiting, HTTPS enforcement

### Build Order Summary Table

| Order | Component | Depends On | Risk Level |
|---|---|---|---|
| 1 | DB schema + migrations | — | LOW |
| 2 | Auth + RBAC | DB schema | LOW |
| 3 | Audit Service | DB schema, Auth | LOW |
| 4 | Config schema + loader | DB schema, Auth | MEDIUM |
| 5 | HCP Service | Auth, Audit, Config | MEDIUM |
| 6 | FMV Service | Auth, Audit, Config | MEDIUM |
| 7 | NPI Registry integration | HCP Service | MEDIUM |
| 8 | OIG LEIE integration | HCP Service | MEDIUM |
| 9 | SAM.gov integration | HCP Service | MEDIUM |
| 10 | Engagement Service | HCP, FMV, Audit | HIGH |
| 11 | Approval Engine | Engagement, Config, Audit | HIGH |
| 12 | Notification Service | Approval Engine | LOW |
| 13 | Template Management | Auth, Audit | LOW |
| 14 | Contract Service | Approval Engine, Template | MEDIUM |
| 15 | File Store integration | Contract Service | LOW |
| 16 | TOV Recording | Engagement, Auth | LOW |
| 17 | Disclosure Service | TOV, HCP | HIGH |
| 18 | Reporting UI | Disclosure, TOV | MEDIUM |
| 19 | Background Jobs | All integrations | MEDIUM |
| 20 | Admin UI | Config, FMV, Auth | LOW |
| 21 | Audit Viewer | Audit Service | LOW |
| 22 | Hardening + V2 prep | All layers | MEDIUM |

### Critical Path

The critical path for MVP is: **DB schema → Auth → Audit → Config → HCP + FMV (with NPI/OIG/SAM) → Engagement → Approval Engine → TOV → Disclosure export**. Contract generation is required for a complete workflow but does not block the disclosure path; it can run in parallel with Layer 4.

---

## Sources and Confidence

| Area | Confidence | Basis |
|---|---|---|
| Domain model (HCP, TOV, disclosure) | HIGH | CMS Open Payments data dictionary is public and well-documented; Sunshine Act statute defines required fields |
| Multi-tenancy strategy (RLS vs schema) | HIGH | PostgreSQL RLS is well-documented; pattern is established in compliance SaaS |
| Config architecture | HIGH | Standard pattern for configurable SaaS; JSON schema approach widely used |
| Audit trail design | HIGH | Append-only audit log is regulatory standard; checksum pattern from SOX/HIPAA compliance contexts |
| NPI Registry integration | HIGH | Public CMS API, stable since 2007, well-documented |
| OIG LEIE integration | HIGH | Public HHS resource, CSV format stable for years |
| SAM.gov integration | MEDIUM | API requires free key; individual person matching is less clean than entity matching — matching methodology needs validation during implementation |
| Document generation (PDF) | MEDIUM | Library choice (Puppeteer vs. LibreOffice vs. pdf-lib) has tradeoffs needing phase-specific research |
| Build order | HIGH | Derived from dependency analysis, not speculative |
