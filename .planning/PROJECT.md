# HCP Engage

## What This Is

HCP Engage is a pharma commercial compliance platform that governs the full lifecycle of interactions between life sciences companies and Healthcare Professionals (HCPs) — from initial onboarding and verification through engagement planning, contract generation, approval workflows, and regulatory disclosure. It is US-focused for v1, targeting Sunshine Act (Open Payments) compliance, and built to replace third-party platforms like Alanda and Medcompli. It launches as a configurable single-tenant system for initial clients, with a clear path toward multi-tenant SaaS.

## Core Value

Every dollar paid to an HCP is captured, justified, and audit-ready — with zero compliance exposure from missing or invalid engagements.

## Requirements

### Validated

- [x] Role-based access (3 roles) with route enforcement via Clerk — AUTH-01 *(Validated in Phase 1: Auth + HCP Management)*
- [x] HCP onboarding with NPI verification via NPPES — HCP-01, HCP-02 *(Validated in Phase 1)*
- [x] Manual debarment checks (OIG LEIE + SAM.gov) with determination recording — HCP-03 *(Validated in Phase 1)*
- [x] HCP status management (4 statuses) with mandatory reason and full history — HCP-04 *(Validated in Phase 1)*

### Active

- [ ] HCP onboarding with NPI verification, debarment/exclusion checks (OIG, SAM.gov), FMV rate assignment, and consent collection
- [ ] Client-uploaded FMV rate card (Excel/CSV by specialty, tier, geography) enforced across all engagements
- [ ] Engagement request submission for advisory boards, speaker programs, investigator activities, and meals/travel transfers of value
- [ ] Multi-level, configurable approval workflows (manager → compliance → legal)
- [ ] Contract generation from templates auto-populated with HCP details, scope of work, and FMV rates
- [ ] Aggregate spend tracking and audit-ready Sunshine Act / Open Payments export
- [ ] Configurable engagement types and workflows per client

### Out of Scope

- HCO (Healthcare Organization) direct engagement — track HCP institutional affiliation only in v1
- Payment processing — system records and tracks payments, does not initiate them
- Multi-tenant isolation — single-tenant architecture for v1, multi-tenant planned for v2
- European regulatory frameworks (EFPIA, ABPI, Loi Bertrand) — US Sunshine Act only for v1
- DocuSign / e-signature integration — contract generation only in v1

## Context

- Replacing commercial platforms like Alanda and Medcompli — the system needs to match or exceed their core compliance workflow capabilities
- Initial deployment targets a small number of pharma/biotech clients with distinct configuration needs (rate cards, approval chains, engagement types) — the architecture must support per-client configuration from day one
- Primary users are internal compliance officers and finance/procurement teams — HCPs are not direct users of the platform in v1
- Sunshine Act (42 U.S.C. § 1320a-7h) mandates annual reporting of transfers of value to physicians and teaching hospitals to CMS Open Payments — all payment records must be reportable-quality
- FMV (Fair Market Value) is a central compliance concept: every HCP payment must be at or below the client's approved FMV rate for that HCP's specialty and geography to withstand regulatory scrutiny

## Constraints

- **Regulatory**: All payment and engagement data must meet Sunshine Act/Open Payments reportability standards
- **Data integrity**: Debarment checks (OIG List of Excluded Individuals/Entities, SAM.gov) must be verifiable and auditable
- **Configurability**: Engagement types, approval workflows, and FMV rate cards must be configurable per client without code changes
- **Architecture**: Single-tenant v1, but data model and config layer must support multi-tenant extraction in v2

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| US-only / Sunshine Act for v1 | Reduces regulatory scope complexity; strongest market need | — Pending |
| FMV via file upload (not API) | Simpler for compliance teams; rate cards already exist as Excel artifacts | — Pending |
| Track payments, not process them | Avoids financial licensing complexity; most pharma companies have existing ERP for payment execution | — Pending |
| Single-tenant v1 → multi-tenant v2 | Lets first clients onboard fast with custom configs; multi-tenant extracted once patterns stabilize | — Pending |
| HCP-only for v1 (no HCO direct engagement) | HCP interactions are the highest-risk disclosure target; HCO adds complexity without proportional v1 value | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-08 after Phase 1 completion*
