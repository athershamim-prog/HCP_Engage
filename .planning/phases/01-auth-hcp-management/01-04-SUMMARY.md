---
phase: 01-auth-hcp-management
plan: 04
subsystem: ui
tags: [nextjs, prisma, clerk, shadcn, tailwind, typescript, server-actions, tdd, hcp-status, base-ui]

# Dependency graph
requires:
  - phase: 01-auth-hcp-management/skeleton
    provides: lib/auth.ts, lib/prisma.ts, prisma/schema.prisma, Clerk middleware
  - phase: 01-auth-hcp-management/hcp-profile
    provides: app/(app)/hcps/[id]/page.tsx with placeholder right sidebar, HcpStatusBadge

provides:
  - components/hcp/HcpStatusPanel.tsx — Set HCP Status sidebar panel (compliance-only); Select, Textarea, Set Status button; do-not-engage destructive treatment; same-status tooltip
  - lib/hcp-validation.ts — validateSetStatusParams pure helper (testable, no DB/Clerk dependency)
  - actions/hcp.ts — extended with setHcpStatus Server Action (atomic HcpStatusHistory + Hcp.status transaction)
  - app/(app)/hcps/[id]/page.tsx — placeholder card replaced with HcpStatusPanel; Phase 1 HCP profile complete

affects:
  - all future phases using /hcps/[id] profile route (no placeholder stubs remain in right sidebar)
  - Phase 2 engagement flow (HCP status is readable for engagement gating)

# Tech tracking
tech-stack:
  added:
    - "@base-ui/react tooltip component (via npx shadcn@latest add tooltip) — Base UI v1 tooltip, not Radix-based"
  patterns:
    - Pure validation helper extracted to lib/ to avoid 'use server' sync-export constraint
    - Base UI TooltipTrigger render prop pattern for tooltip on disabled button wrapper
    - TDD with jest.mock — no DATABASE_URL needed for pure validation tests

key-files:
  created:
    - lib/hcp-validation.ts — validateSetStatusParams pure fn; reason length + same-status checks
    - components/hcp/HcpStatusPanel.tsx — "use client"; Select+Textarea+Button; do-not-engage destructive borders; Base UI tooltip on same-status disabled button
    - actions/hcp.test.ts — 4 unit tests for validateSetStatusParams; all pass
    - components/ui/tooltip.tsx — Base UI tooltip (added via shadcn CLI)
  modified:
    - actions/hcp.ts — added setHcpStatus Server Action (compliance-only, atomic $transaction, revalidatePath)
    - app/(app)/hcps/[id]/page.tsx — replaced Set HCP Status placeholder with HcpStatusPanel

key-decisions:
  - "validateSetStatusParams extracted to lib/hcp-validation.ts — 'use server' file-level directive forbids synchronous exports; pure helper moved to lib/ so tests can import without mocking Prisma/Clerk"
  - "Base UI TooltipTrigger render prop used instead of asChild — shadcn@latest installs @base-ui/react tooltip (not Radix); render prop is Base UI's composability API; wrapper span ensures tooltip fires on disabled button"
  - "jest.mock not needed in hcp.test.ts — test imports from lib/hcp-validation.ts directly, bypassing actions/hcp.ts and its Prisma/Clerk imports"

patterns-established:
  - "Pattern 11: 'use server' sync-export escape hatch — extract pure validation/utility functions to lib/ before using in Server Action files to avoid Next.js 'Server Actions must be async' constraint"
  - "Pattern 12: Base UI TooltipTrigger render prop — use render={<span>...</span>} to wrap disabled interactive elements; asChild is a Radix concept not supported by Base UI"

requirements-completed:
  - HCP-04

# Metrics
duration: 22min
completed: 2026-05-08
---

# Phase 01 Plan 04: HCP Status Summary

**HCP status management panel with compliance-only access, do-not-engage destructive visual treatment, same-status tooltip guard, and atomic DB transaction via setHcpStatus Server Action**

## Performance

- **Duration:** ~22 min
- **Started:** ~2026-05-08T07:30:00Z
- **Completed:** 2026-05-08
- **Tasks:** 1 (TDD task: RED → GREEN → wire + build)
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- `lib/hcp-validation.ts`: pure `validateSetStatusParams` helper; reason min-10 and same-status checks; no Prisma/Clerk deps; fully unit-tested
- `setHcpStatus` Server Action in `actions/hcp.ts`: compliance role guard (T-04-01), server-side reason validation (T-04-02), HCP existence check (T-04-03), atomic `prisma.$transaction([hcpStatusHistory.create, hcp.update])`, `revalidatePath` on success
- `HcpStatusPanel.tsx`: 4 status options (Active/Inactive/Suspended/Do Not Engage); do-not-engage triggers destructive red borders on Select and Textarea; reason label changes to "Reason for Do-Not-Engage designation (required)"; character counter "N/10 minimum characters"; `useTransition` for pending state with spinner
- Same-status prevention: button disabled with Base UI tooltip showing "HCP is already {label}" when current status === selected status
- Business users see no panel — `{isCompliance && <HcpStatusPanel .../>}` renders nothing for Business role
- After save: `router.refresh()` triggers RSC re-render; profile header badge and status history timeline update with new state
- All 28 tests pass; `npm run build` exits 0

## Task Commits

TDD sequence:

1. **RED: Failing tests for validateSetStatusParams** — `86c0455` (test)
2. **GREEN: setHcpStatus Server Action + validateSetStatusParams** — `ec5c737` (feat)
3. **Implementation: HcpStatusPanel + page.tsx wiring + lib/hcp-validation extraction + build fixes** — `d10f7aa` (feat)

## Files Created/Modified

- `lib/hcp-validation.ts` — validateSetStatusParams pure fn; reason.trim().length < 10 check; same-status check
- `actions/hcp.test.ts` — 4 unit tests; imports from lib/hcp-validation; no mocking needed; all pass
- `actions/hcp.ts` — added setHcpStatus async Server Action; imports validateSetStatusParams not re-exported (use server constraint)
- `components/ui/tooltip.tsx` — Base UI tooltip installed via `npx shadcn@latest add tooltip`
- `components/hcp/HcpStatusPanel.tsx` — full Set HCP Status panel per UI-SPEC Screen 7
- `app/(app)/hcps/[id]/page.tsx` — HcpStatusPanel import added; placeholder card replaced with `<HcpStatusPanel hcpId={hcp.id} currentStatus={hcp.status} />`

## Decisions Made

- Extracted `validateSetStatusParams` to `lib/hcp-validation.ts` because Next.js 16 Turbopack enforces "Server Actions must be async" at the file level — a synchronous `export function` in a `"use server"` file fails the build. Pure validation function belongs in `lib/` anyway.
- Used Base UI `TooltipTrigger` `render` prop instead of `asChild` — the `shadcn@latest add tooltip` command installed `@base-ui/react` (not the Radix-based implementation) which does not have `asChild`; `render={<span>...</span>}` is the Base UI composability API.
- Test file imports directly from `lib/hcp-validation` (not `actions/hcp`) — no `jest.mock` needed, simpler test setup than Plan 03's debarment tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved validateSetStatusParams out of actions/hcp.ts to lib/hcp-validation.ts**
- **Found during:** Build after implementing GREEN step
- **Issue:** `actions/hcp.ts` has `"use server"` directive (file-level); Next.js 16 Turbopack enforces that ALL exports from a "use server" file must be async functions. `validateSetStatusParams` is a sync pure function — build error: "Server Actions must be async functions."
- **Fix:** Created `lib/hcp-validation.ts` with the pure helper (no "use server"); updated test to import from `@/lib/hcp-validation`; `actions/hcp.ts` imports from lib internally but does not re-export (to avoid the same constraint on re-exports)
- **Files modified:** `lib/hcp-validation.ts` (created), `actions/hcp.test.ts` (import path updated), `actions/hcp.ts` (removed sync export, added internal import)
- **Verification:** `npm run build` passes; 28 tests pass
- **Committed in:** `d10f7aa`

**2. [Rule 1 - Bug] Fixed Select onValueChange type: string | null instead of string**
- **Found during:** Build TypeScript check
- **Issue:** Base UI Select's `onValueChange` passes `string | null`; handler typed as `(val: string)` caused TS error
- **Fix:** Updated `handleStatusChange` signature to `(val: string | null)`, added `if (val === null) return` guard
- **Files modified:** `components/hcp/HcpStatusPanel.tsx`
- **Verification:** TypeScript passes; no runtime behavior change (null deselect is a no-op)
- **Committed in:** `d10f7aa`

**3. [Rule 1 - Bug] Fixed TooltipTrigger asChild → render prop (Base UI compatibility)**
- **Found during:** Build TypeScript check
- **Issue:** Plan spec used `<TooltipTrigger asChild>` (Radix UI pattern); installed tooltip is Base UI which does not accept `asChild`; TS error: "Property 'asChild' does not exist on type"
- **Fix:** Replaced `asChild` with `render={<span className="block w-full">...</span>}` pattern; conditionally renders tooltip only when `isSameStatus` is true so non-same-status case uses a plain Button without tooltip overhead
- **Files modified:** `components/hcp/HcpStatusPanel.tsx`
- **Verification:** TypeScript passes; `npm run build` exits 0
- **Committed in:** `d10f7aa`

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug: build constraint, TS type mismatch, library API difference)
**Impact on plan:** All fixes necessary for correct build/runtime. No scope creep. Functional behavior unchanged from spec.

## Issues Encountered

- `npx shadcn@latest add tooltip` installs Base UI tooltip (not Radix) — Base UI has a different component API; required switching from `asChild` to `render` prop pattern for tooltip trigger wrapping.

## User Setup Required

None — no new external service configuration required.

## Known Stubs

None — all stubs from Plan 03 (`Set HCP Status panel placeholder`) have been replaced with the full implementation.

## Threat Flags

No new threat surface beyond the plan's threat model. All T-04-xx mitigations implemented:
- T-04-01: `role !== "compliance"` guard returns Forbidden for non-Compliance users
- T-04-02: `params.reason.trim().length < 10` checked server-side before DB write; client check is UX only
- T-04-03: `prisma.hcp.findUnique` verifies HCP exists before writing; invalid IDs return error without side effects
- T-04-04: Accepted — Prisma transactions are atomic; no unbounded loops

## TDD Gate Compliance

RED gate commit: `86c0455` — `test(01-04): add failing tests for validateSetStatusParams`
GREEN gate commit: `ec5c737` — `feat(01-04): add validateSetStatusParams and setHcpStatus Server Action`
Gate sequence: PASSED

## Next Phase Readiness

- Phase 1 complete: AUTH-01 (skeleton), HCP-01 (directory), HCP-02 (debarment), HCP-03 (profile), HCP-04 (status) all delivered
- HCP status field is queryable for Phase 2 engagement gating (e.g., prevent engagement request if HCP is do_not_engage)
- `setHcpStatus` Server Action is the canonical status-change interface for any future workflow that needs to set HCP status programmatically

---
*Phase: 01-auth-hcp-management*
*Completed: 2026-05-08*
