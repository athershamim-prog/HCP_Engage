# HCP Engage — Project Guide

## Project

**HCP Engage** is a pharma commercial compliance platform governing the full lifecycle of HCP interactions — onboarding, engagement, contracts, and regulatory disclosure. US Sunshine Act focus. Single-tenant v1, multi-tenant v2.

See `.planning/PROJECT.md` for full context and `.planning/ROADMAP.md` for phase structure.

## GSD Workflow

This project uses the GSD (Get Shit Done) workflow system.

**Starting a new phase:**
```
/gsd-discuss-phase N    # gather context
/gsd-plan-phase N       # create PLAN.md
/gsd-execute-phase N    # execute plans
```

**Current state:** `.planning/STATE.md`
**Requirements:** `.planning/REQUIREMENTS.md`
**Roadmap:** `.planning/ROADMAP.md`

## Stack

- **Framework:** Next.js 15 (App Router, Server Components, Server Actions)
- **Language:** TypeScript 5 (strict mode throughout)
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Database:** PostgreSQL 16 on Neon, Prisma v5 ORM
- **Auth:** Clerk (RBAC + SAML SSO)
- **Background jobs:** BullMQ v5 + Upstash Redis
- **File parsing:** SheetJS (xlsx) for FMV rate cards
- **PDF generation:** @react-pdf/renderer v3
- **E-signature:** DocuSign (Phase 4)
- **Storage:** AWS S3 / Cloudflare R2 (per-tenant path prefix)
- **Hosting:** Railway (early) → AWS ECS Fargate (production)

## Critical Architecture Rules

1. **tenant_id on every table** — non-nullable, present from migration 1
2. **Audit log is append-only** — separate schema, write-only DB role; application cannot UPDATE or DELETE audit rows
3. **FMV rate cards are immutable** — rows never overwritten; effective date ranges; rate snapshotted onto engagement at creation
4. **Engagement state machine** — only named transitions permitted; no direct field updates to status
5. **Config is database-resident** — approval chains, engagement types, policy settings are versioned DB records scoped by tenant_id
6. **Specialty = NUCC taxonomy code** — throughout the system; display names derived at render time

## Phases

| Phase | Name | Requirements |
|-------|------|--------------|
| 1 | Foundation | AUD-01, AUD-02 |
| 2 | HCP Management + FMV | HCP-01–04, FMV-01–06 |
| 3 | Engagement Lifecycle + Approval | ENG-01–06 |
| 4 | Contract Generation + DocuSign | CONT-01–05 |
| 5 | Operations + Polish | (hardens 1–4) |

## Key Compliance Facts

- **NPI verification:** CMS NPPES API — canonical identity for every HCP
- **Debarment checks:** OIG LEIE (monthly CSV → local table) + SAM.gov (API); NPI-first matching; re-check monthly for all active HCPs
- **FMV enforcement:** Every engagement must snapshot the applicable rate at creation; above-rate requires mandatory written justification
- **Audit trail:** Self-contained entries — actor stored as strings (name + email + role), not FK only; before/after state captured
- **DocuSign:** Contract execution via DocuSign webhook; signed artifact stored as immutable blob
