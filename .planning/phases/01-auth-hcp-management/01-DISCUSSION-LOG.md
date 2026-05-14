# Phase 1: Discussion Log

**Date:** 2026-05-07
**Phase:** Auth + HCP Management

## Areas Discussed

### Role Permissions
- **Q:** What are the exact roles and what can each do?
- **A (user):** Business is not a single role — Marketing, Advisory, and Speaker Program are separate business units that all do the same thing (submit requests). Compliance reviews FMV and runs debarment checks manually. Finance approves payment after Compliance approves.
- **A (user):** Business is a unified role tagged by department. Finance only sees engagements after Compliance approves. Finance handles payments outside the system.
- **Decision:** 3 roles (Business, Compliance, Finance). Business is unified with a department tag. Two-step approval: Compliance then Finance.

### HCP Profile Lifecycle
- **Q:** Store locally on lookup or fetch live each time?
- **A (user):** Store locally on lookup (recommended).
- **Q:** Who can look up and add HCPs?
- **A (user):** Business and Compliance.
- **Decision:** HCP stored in DB on first NPI lookup. Both Business and Compliance can add HCPs.

### Login Experience
- **Q:** Email + password, Google, or both?
- **A (user):** Email + password.
- **Decision:** Clerk email + password. No social login for v1.

### Debarment Check Flow
- **Q:** Can Business submit before debarment check is run?
- **A (user):** Yes — Compliance sees a warning.
- **Q:** What happens on a match?
- **A (user):** Compliance records a determination with rationale.
- **Decision:** Manual trigger only. Submissions allowed pre-check with warning. Match → Compliance reviews and records determination manually.

---

## Session 2 — 2026-05-07 (update)

### SAML SSO
- **Q:** Does the first client need SAML SSO from launch, or is email/password sufficient?
- **A (user):** No SSO needed for v1.
- **Decision:** Clerk email/password only. SSO deferred.

### Role Management UI
- **Q:** In-app user management screen or Clerk dashboard?
- **A (user):** No in-app UI. Roles set via Clerk dashboard.
- **Decision:** No user management screen in Phase 1.

### Compliance Role Expansion
- **A (user):** Compliance should be able to perform all three roles if configured that way from backend.
- **Q:** Per user or per tenant?
- **A (user):** Per user.
- **Decision:** Per-user DB flag grants Compliance users additional Business and/or Finance permissions. Middleware applies union of Clerk role + DB grants.

### NPI Lookup Flow
- **A (user):** Search-first confirmed. NPI entry → NPPES results → confirm to add.
- **Decision:** Search-first flow. NPI or name search supported via NPPES API.

### OIG LEIE Loading
- **Q:** Seeding script, admin upload UI, or pre-seeded fixture?
- **A (user):** Pre-seeded dummy reference table. Skip loading mechanism for v1.
- **Decision:** Pre-seeded local table with dummy data. Real-world schema, fixture data only.

### SAM.gov in v1
- **Q:** Live API or stubbed like OIG?
- **A (user):** Stub/dummy data same as OIG.
- **Decision:** Local pre-seeded table. No live SAM.gov API calls in v1.

## Deferred Ideas
- SAML/SSO — not needed for v1; add in v2
- In-app user management — Clerk dashboard for v1
- Live SAM.gov API — requires API key; deferred to v2
- OIG LEIE CSV refresh mechanism — deferred to v2
- Automated debarment re-checks — v2
- Full audit log — v2
