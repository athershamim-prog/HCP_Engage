---
phase: 01-auth-hcp-management
plan: 03
subsystem: ui
tags: [nextjs, prisma, clerk, shadcn, tailwind, typescript, debarment, oig, sam-gov, hcp-profile, server-actions, tdd]

# Dependency graph
requires:
  - phase: 01-auth-hcp-management/skeleton
    provides: lib/auth.ts, lib/prisma.ts, prisma/schema.prisma, app shell, Clerk middleware
  - phase: 01-auth-hcp-management/hcp-directory
    provides: HcpStatusBadge, DebarmentBadge, actions/hcp.ts, HCP records in DB

provides:
  - app/(app)/hcps/[id]/page.tsx — full HCP profile page, two-column layout
  - lib/debarment.ts — normalizeName, matchOigRecord, matchSamRecord, runDebarmentCheck
  - actions/debarment.ts — runCheck (compliance-only), saveDetermination (upsert)
  - components/hcp/DebarmentCheckPanel.tsx — debarment check UI with determination form
  - components/hcp/StatusHistoryTimeline.tsx — status history timeline component

affects:
  - 01-auth-hcp-management/hcp-status (profile page has Set HCP Status placeholder — Plan 04 fills it)
  - all future phases using HCP profile route /hcps/[id]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD for pure matching functions with jest.mock for prisma isolation
    - Server Action atomic transaction — prisma.$transaction([check.create, hcp.update]) for debarment check
    - Debarment upsert — prisma.debarmentDetermination.upsert allows Compliance to re-record
    - Role prop threading — isCompliance computed server-side, passed to client component; no role check in client
    - router.refresh() after Server Action mutation — triggers RSC re-render with updated DB state

key-files:
  created:
    - lib/debarment.ts — normalizeName, matchOigRecord, matchSamRecord, runDebarmentCheck (local OIG LEIE + SAM.gov queries)
    - lib/debarment.test.ts — 8 unit tests: normalizeName (2), matchOigRecord (4), matchSamRecord (2); all pass
    - actions/debarment.ts — runCheck (compliance role guard, atomic $transaction), saveDetermination (upsert, rationale min-20 server-side)
    - components/hcp/DebarmentCheckPanel.tsx — "use client" panel with run-check, OIG/SAM result rows, expandable match details, determination form
    - components/hcp/StatusHistoryTimeline.tsx — ordered list with status badges, formatDistanceToNow, empty state
    - app/(app)/hcps/[id]/page.tsx — RSC profile page; fetches HCP with statusHistory + debarmentChecks[0].determination
  modified: []

key-decisions:
  - "jest.mock('@/lib/prisma') added to debarment.test.ts — prisma client throws on missing DATABASE_URL at import time; mock isolates pure matching functions from DB in unit tests"
  - "isCompliance computed server-side in page.tsx then passed as prop to DebarmentCheckPanel — avoids client-side role check; client only renders/hides based on boolean prop"
  - "Set HCP Status card rendered as placeholder in right sidebar — full implementation deferred to Plan 04 (hcp-status); placeholder shown only to Compliance users"

patterns-established:
  - "Pattern 8: Server Action atomic transaction — prisma.$transaction([]) for operations that must be consistent (debarment check + HCP status update)"
  - "Pattern 9: RSC refresh pattern — Server Action calls revalidatePath(); client component calls router.refresh() after action; no manual state management for DB-sourced data"
  - "Pattern 10: Role prop threading — isCompliance/isAdmin flags computed server-side and passed to client components as booleans; never recompute roles in client"

requirements-completed:
  - HCP-02
  - HCP-03

# Metrics
duration: 18min
completed: 2026-05-08
---

# Phase 01 Plan 03: HCP Profile Summary

**Full HCP profile page with debarment check flow — OIG LEIE and SAM.gov local table matching, compliance-only check panel, determination recording, and status history timeline**

## Performance

- **Duration:** ~18 min
- **Started:** ~2026-05-08T06:00:00Z
- **Completed:** 2026-05-08
- **Tasks:** 2 (Task 1: TDD — debarment logic + Server Actions; Task 2: UI components + profile page)
- **Files modified:** 6 created, 0 modified

## Accomplishments

- Debarment matching library: `normalizeName`, `matchOigRecord`, `matchSamRecord` pure functions with NPI-first matching, normalized name fallback
- `runDebarmentCheck` queries local `OigLeieRecord` and `SamGovRecord` Prisma tables (no external API calls per D-11b)
- `runCheck` Server Action: compliance role guard, atomic `prisma.$transaction` records `DebarmentCheck` + updates `Hcp.debarmentStatus` together
- `saveDetermination` Server Action: upsert pattern so Compliance can re-record; server-side rationale length validation (min 20 chars)
- `DebarmentCheckPanel` client component: run check button (compliance only), OIG LEIE + SAM.gov result rows with expandable match detail accordions, prior determination display block, determination form with outcome select + rationale textarea
- `StatusHistoryTimeline`: ordered list with HcpStatusBadge, relative timestamps (date-fns), empty state "No status changes recorded."
- Full HCP profile page at `/hcps/[id]`: two-column layout (65/35), NPPES data card, debarment check card, status history card; Set HCP Status placeholder in right sidebar (Compliance only)
- All 8 unit tests pass; `npm run build` exits 0; `/hcps/[id]` appears in route table

## Task Commits

1. **Task 1 RED: Failing tests for debarment pure functions** — `952a071` (test)
2. **Task 1 GREEN: Debarment logic, Server Actions, passing tests** — `83d4096` (feat)
3. **Task 2: Profile page, DebarmentCheckPanel, StatusHistoryTimeline** — `a1ec7f0` (feat)

## Files Created/Modified

- `lib/debarment.ts` — normalizeName, matchOigRecord, matchSamRecord, runDebarmentCheck; exports DebarmentResult type
- `lib/debarment.test.ts` — 8 unit tests; jest.mock for prisma isolation; all pass GREEN
- `actions/debarment.ts` — "use server"; runCheck (role guard + $transaction), saveDetermination (upsert + rationale validation)
- `components/hcp/DebarmentCheckPanel.tsx` — "use client"; full debarment UI per UI-SPEC Screen 6
- `components/hcp/StatusHistoryTimeline.tsx` — server component; timeline with badges + empty state
- `app/(app)/hcps/[id]/page.tsx` — RSC; two-column layout; fetches HCP with statusHistory + debarmentChecks[0].determination

## Decisions Made

- Used `jest.mock("@/lib/prisma")` in `debarment.test.ts` — the prisma singleton throws on missing `DATABASE_URL` at import time; mocking isolates the pure matching functions (`normalizeName`, `matchOigRecord`, `matchSamRecord`) from DB initialization in unit tests; `runDebarmentCheck` (which needs real DB) is not unit tested but covered by integration
- Threaded `isCompliance` as a boolean prop from the RSC (where Clerk + UserGrant are available) to `DebarmentCheckPanel` — client components should not re-compute roles from Clerk on client side; boolean prop is the idiomatic Next.js App Router pattern
- Set HCP Status card is a placeholder in Plan 03 — the plan spec explicitly notes "Plan 04 implements this panel"; placeholder shown only to Compliance users to preserve correct role-gating behavior once Plan 04 fills it in

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added jest.mock for prisma in debarment.test.ts**
- **Found during:** Task 1 RED — tests failed with "DATABASE_URL environment variable is not set" rather than the expected "cannot find module" error
- **Issue:** `lib/debarment.ts` has a top-level `import { prisma } from "@/lib/prisma"` which executes `createPrismaClient()` at import time; `createPrismaClient()` throws when `DATABASE_URL` is not set; unit test runner has no DB env
- **Fix:** Added `jest.mock("@/lib/prisma", () => ({ prisma: { oigLeieRecord: ..., samGovRecord: ... } }))` at top of test file; isolates pure function tests from DB dependency; 8 tests now pass
- **Files modified:** `lib/debarment.test.ts`
- **Commit:** `83d4096`

## Issues Encountered

- Jest module resolution error on first RED run — resolved via prisma mock (Rule 1 auto-fix above)

## User Setup Required

None — no new external service configuration. All debarment matching uses local Neon DB tables seeded in Plan 01.

## Known Stubs

- **Set HCP Status panel** in `app/(app)/hcps/[id]/page.tsx` right sidebar: rendered as a placeholder Card with message "Status management panel — implemented in next plan." This is intentional — Plan 04 (hcp-status) implements the full panel. The placeholder correctly gates on `isCompliance` so Business users don't see it.

## Threat Flags

No new threat surface beyond the plan's threat model. All T-03-xx mitigations implemented:
- T-03-01: `role !== "compliance"` guard in `runCheck` — returns `{ success: false, error: "Forbidden" }` for non-Compliance
- T-03-02: Same guard in `saveDetermination`
- T-03-03: `hcpId` flows from server-rendered page that validates HCP exists via `prisma.hcp.findUnique` before prop threading
- T-03-04: Rationale length validated server-side in `saveDetermination` before upsert
- T-03-06: `currentUser()` from Clerk validates session server-side in both Server Actions

## TDD Gate Compliance

RED gate commit: `952a071` — `test(01-03): add failing tests for debarment normalizeName, matchOigRecord, matchSamRecord`
GREEN gate commit: `83d4096` — `feat(01-03): debarment matching logic, Server Actions, and passing unit tests`
Gate sequence: PASSED

## Next Phase Readiness

- Plan 04 (hcp-status) can implement Set HCP Status directly — placeholder in right sidebar awaits replacement
- DebarmentCheckPanel and StatusHistoryTimeline are reusable for any future HCP-adjacent views
- `runDebarmentCheck` is integration-ready — swap local table queries for live OIG/SAM.gov APIs in v2 without interface changes

---
*Phase: 01-auth-hcp-management*
*Completed: 2026-05-08*
