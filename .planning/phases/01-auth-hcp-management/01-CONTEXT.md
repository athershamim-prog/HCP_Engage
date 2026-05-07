# Phase 1: Auth + HCP Management - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers: secure login with role-based access (Business, Compliance, Finance) + HCP onboarding via NPI lookup with local storage + manual debarment check with Compliance-recorded determination + HCP status management.

**In scope:** User authentication, role enforcement on all routes, HCP NPI lookup + local profile storage, manual debarment check against OIG LEIE + SAM.gov, debarment determination recording, HCP status management (active / inactive / suspended / do-not-engage)

**Out of scope:** Engagement submission (Phase 2), FMV rate cards (Phase 2), contract generation (Phase 3), approval workflow (Phase 2)

</domain>

<decisions>
## Implementation Decisions

### Roles & Permissions
- **D-01:** Three roles — **Business**, **Compliance**, **Finance**. Managed via Clerk.
- **D-02:** Business is a unified role with a department tag (Marketing / Advisory / Speaker Program). All Business users have the same permissions regardless of department tag — the tag is metadata only.
- **D-03:** Business and Compliance can look up and add HCPs. Finance has no HCP management access in Phase 1.
- **D-04:** Engagement approval flow (Compliance then Finance) is Phase 2 scope — role definitions here must not foreclose the two-step approval pattern.

### Approval Flow (for role scoping awareness)
- **D-05:** Business submits → Compliance approves/rejects → Finance approves/rejects. Finance sees engagements only after Compliance approval. Finance payment handling happens outside the system (in client ERP).

### Authentication
- **D-06:** Email + password login via Clerk. No social login or SSO for v1.
- **D-07:** Invited users only — no open self-signup. Admin provisions accounts.

### HCP Profile Lifecycle
- **D-08:** HCP record is stored locally in the database on first NPI lookup. NPPES data (name, credentials, NUCC specialty, primary state, HCO affiliation) is cached at that point.
- **D-09:** Both Business and Compliance users can look up and add HCPs via NPI.
- **D-10:** HCP record is the persistent anchor for debarment results, status history, and future engagement links.

### Debarment Check
- **D-11:** Debarment check is manually triggered by a Compliance officer — no automatic scheduling in v1.
- **D-12:** Business users can submit engagement requests for HCPs whose debarment check has not yet been run. Compliance sees a visible warning on the engagement ("Debarment check not run").
- **D-13:** On a debarment match, Compliance manually reviews the match result, writes a determination with rationale (e.g., cleared / confirmed exclusion / false positive), and sets the HCP status accordingly. No auto-suspend.

### HCP Status
- **D-14:** Compliance officer sets HCP status (active / inactive / suspended / do-not-engage) with a mandatory reason field. Full status history is visible on the HCP profile.

### Claude's Discretion
- Exact Clerk role implementation (custom metadata vs. organization roles) — use whichever integrates cleanly with Next.js App Router middleware
- NPPES API caching strategy (TTL, refresh trigger) — reasonable default acceptable
- UI layout and component choices for HCP profile page

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-01, HCP-01, HCP-02, HCP-03, HCP-04 are the v1 requirements for this phase

### Roadmap & Project Context
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and dependency structure
- `.planning/PROJECT.md` — project constraints, core value, and key decisions

### External APIs (no local docs — research required)
- CMS NPPES API — NPI verification and HCP canonical data (public REST API, no auth required)
- OIG LEIE — monthly exclusion list (CSV download); check if local table approach is preferred over live API
- SAM.gov API — exclusion search API (requires API key)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, building from scratch.

### Established Patterns
- Stack: Next.js 15 App Router + TypeScript strict + Tailwind CSS v4 + shadcn/ui + PostgreSQL (Neon) + Prisma v5 + Clerk
- All patterns to be established in this phase become the baseline for Phases 2–3.

### Integration Points
- Clerk middleware will wrap all App Router routes — role checks happen at the middleware layer
- Prisma schema established in this phase must carry all future tables (no tenant_id in v1 but schema must be clean)

</code_context>

<specifics>
## Specific Ideas

- Department tag on Business users (Marketing / Advisory / Speaker Program) should be visible in the UI when viewing engagement requests — helps Compliance know which business unit is requesting
- Debarment check warning on engagements (Phase 2) needs to be designed with this phase's data model in mind — HCP record must have a `debarment_checked_at` timestamp and `debarment_status` field

</specifics>

<deferred>
## Deferred Ideas

- SAML/SSO login — mentioned as a future consideration; Clerk supports it but not needed for v1 launch
- Automatic monthly debarment re-checks (HCP-V2-01) — scheduling deferred to v2
- Audit log (AUD-01) — deferred to v2; no append-only audit infrastructure in v1

</deferred>

---

*Phase: 1 — Auth + HCP Management*
*Context gathered: 2026-05-07*
