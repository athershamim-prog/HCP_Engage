---
phase: 02-fmv-engagement
plan: "01"
subsystem: schema-foundation
tags: [prisma, schema, sheetjs, shadcn, auth, nav, test-stubs]
dependency_graph:
  requires: []
  provides:
    - NuccTaxonomy table (25 fixture codes seeded)
    - FmvRateCard, FmvRate tables with enums
    - Engagement, EngagementStatusHistory tables with enums
    - SheetJS 0.20.3 installed
    - Skeleton, AlertDialog shadcn components
    - Phase 2 route permissions in lib/auth.ts
    - Phase 2 nav items in Sidebar.tsx
    - Wave 0 test stubs (5 files, 59 todo tests)
  affects:
    - prisma/schema.prisma
    - prisma/seed.ts
    - lib/auth.ts
    - components/shell/Sidebar.tsx
    - next.config.ts
tech_stack:
  added:
    - SheetJS 0.20.3 (CDN install: cdn.sheetjs.com)
    - shadcn Skeleton component
    - shadcn AlertDialog component
  patterns:
    - Prisma schema extension (Phase 1 preserved verbatim)
    - Decimal type for monetary values (rateUsd, compensationUsd)
    - Enum-based status + type fields for FMV and Engagement models
    - Engagement.statusHistory mirrors HcpStatusHistory pattern
key_files:
  modified:
    - prisma/schema.prisma
    - prisma/seed.ts
    - next.config.ts
    - lib/auth.ts
    - components/shell/Sidebar.tsx
    - package.json
    - package-lock.json
  created:
    - components/ui/skeleton.tsx
    - components/ui/alert-dialog.tsx
    - lib/fmv-parser.test.ts
    - lib/fmv-lookup.test.ts
    - lib/engagement-validation.test.ts
    - actions/fmv.test.ts
    - actions/engagement.test.ts
decisions:
  - "NUCC codes seeded from 25 pharma-relevant fixture codes per D-04; full 900-code dataset requires legal review of NUCC licensing before use"
  - "Prisma client regenerated after db push to expose new models to seed.ts"
  - "SheetJS npm list shows 'invalid' in worktree (CDN URL hash mismatch with npm lockfile expectations) but package is installed, importable, and functional at 0.20.3"
  - "Worktree .env.local copied from main repo since worktrees do not inherit parent .env files"
metrics:
  completed: "2026-05-12"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 7
  files_created: 9
---

# Phase 2 Plan 01: Wave 1 Foundation — Schema, Dependencies, Nav, and Test Stubs Summary

## One-liner

Phase 2 schema foundation: 5 new Prisma models (NuccTaxonomy, FmvRateCard, FmvRate, Engagement, EngagementStatusHistory) + 4 enums pushed to Neon, SheetJS 0.20.3 installed, shadcn Skeleton and AlertDialog added, Phase 2 route permissions and sidebar nav wired, and 59 Wave 0 test stubs scaffolded across 5 files.

## Tasks Completed

| # | Task | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Extend Prisma schema with Phase 2 models and push to Neon | a26488f | prisma/schema.prisma (+5 models, +4 enums), prisma/seed.ts (+25 NUCC codes), npx prisma db push exit 0 |
| 2 | Install SheetJS, add shadcn components, update config and nav | f956b7a | xlsx@0.20.3, skeleton.tsx, alert-dialog.tsx, next.config.ts (bodySizeLimit), lib/auth.ts (+5 routes), Sidebar.tsx (+4 nav items) |
| 3 | Create Wave 0 test stub files | 7099f9b | 5 test files, 59 todo tests, npm test exit 0 (9 suites, 87 tests total) |

## Verification Results

- `npx prisma db push` — exit 0, all 5 models synced to Neon PostgreSQL
- `npx prisma db seed` — exit 0, 25 NuccTaxonomy records inserted
- `node -e "require('xlsx')"` — xlsx 0.20.3 loads OK
- `next.config.ts` — `bodySizeLimit: '5mb'` present; `remotePatterns` preserved
- `lib/auth.ts` — 8 route entries (3 Phase 1 + 5 Phase 2)
- `components/shell/Sidebar.tsx` — FileSpreadsheet, ClipboardList, Plus, CheckSquare imported; /fmv, /engagements, /engagements/queue hrefs present
- `components/ui/skeleton.tsx` — exists (shadcn CLI)
- `components/ui/alert-dialog.tsx` — exists (shadcn CLI)
- `npm test` — 9 suites, 28 passed, 59 todo, 0 failed
- `npm run build` — exit 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Missing .env.local in worktree**

- **Found during:** Task 1 (npx prisma db push)
- **Issue:** Worktrees do not inherit parent repo .env files; `npx prisma db push` failed with "Connection url is empty"
- **Fix:** Copied .env.local and .env from main repo root to worktree directory; both files are already in .gitignore so the copies will not be committed
- **Files modified:** .env.local, .env (not tracked; in .gitignore)
- **Commit:** N/A (env files not committed)

**2. [Rule 3 - Blocking Issue] Prisma client stale after db push**

- **Found during:** Task 1 (npx prisma db seed)
- **Issue:** `prisma.nuccTaxonomy` not found on PrismaClient — generated client predates new models
- **Fix:** Ran `npx prisma generate` before db seed; client regenerated to include all new models
- **Files modified:** node_modules/@prisma/client (runtime, not committed)
- **Commit:** N/A (generated files not committed)

**3. [Rule 3 - Blocking Issue] Jest testPathPattern flag renamed in Jest 30**

- **Found during:** Task 3 verification
- **Issue:** `--testPathPattern` was replaced by `--testPathPatterns` in Jest 30; using old flag caused a warning and non-execution
- **Fix:** Used `npx jest --testPathPatterns` directly for verification
- **Files modified:** None (verification command updated only)
- **Commit:** N/A

## Threat Model Coverage

All T-02-F-01 through T-02-F-03 mitigations confirmed present:
- T-02-F-01 (Schema tampering): Schema changes only via `npx prisma db push`; no raw SQL
- T-02-F-02 (Privilege escalation): `/fmv` and `/fmv/upload` restricted to `compliance` only; `/engagements/queue` restricted to `compliance` + `finance`; business role cannot reach approval queue
- T-02-F-03 (DoS via upload): `bodySizeLimit: '5mb'` added to `next.config.ts`
- T-02-F-04 (NUCC data disclosure): Accepted — NUCC codes from NPPES are public; 25-code fixture has no PII

## Known Stubs

None — this plan creates test stubs intentionally (Wave 0 scaffolding). Implementation files (lib/fmv-parser.ts, lib/fmv-lookup.ts, lib/engagement-validation.ts, actions/fmv.ts, actions/engagement.ts) do not exist yet and will be created in Plans 02 and 03.

## Threat Flags

No new security-relevant surfaces beyond what's in the plan's threat model.

## Self-Check: PASSED

Files confirmed present:
- prisma/schema.prisma — FOUND
- prisma/seed.ts — FOUND (contains nuccTaxonomy.createMany)
- next.config.ts — FOUND (contains bodySizeLimit: '5mb')
- lib/auth.ts — FOUND (contains /fmv, /engagements/queue)
- components/shell/Sidebar.tsx — FOUND (contains FileSpreadsheet, /fmv)
- components/ui/skeleton.tsx — FOUND
- components/ui/alert-dialog.tsx — FOUND
- lib/fmv-parser.test.ts — FOUND (contains describe("parseRateCardBuffer"))
- lib/fmv-lookup.test.ts — FOUND (contains describe("getFmvRate"))
- lib/engagement-validation.test.ts — FOUND (contains describe("validateEngagementFields"))
- actions/fmv.test.ts — FOUND (contains describe("activateRateCard"))
- actions/engagement.test.ts — FOUND (contains describe("submitEngagement"))

Commits confirmed:
- a26488f — FOUND (feat(02-01): extend Prisma schema)
- f956b7a — FOUND (feat(02-01): install SheetJS, add shadcn)
- 7099f9b — FOUND (test(02-01): create Wave 0 test stubs)
