---
phase: 02-fmv-engagement
plan: "04"
subsystem: engagement-form-vertical-slice
tags: [engagement, tdd, state-machine, role-based-filtering, hcp-search, fmv-panel, server-actions, client-components]
dependency_graph:
  requires:
    - 02-01 (Engagement schema, EngagementStatusHistory, NUCC seeded)
    - 02-03 (GET /api/hcps/search and GET /api/fmv/rate API routes)
  provides:
    - validateEngagementFields, validateRejectionReason, validateStateTransition pure functions (lib/engagement-validation.ts)
    - createEngagementAction, submitEngagementAction Server Actions (actions/engagement.ts)
    - Engagement list page with role-based filter (app/(app)/engagements/page.tsx)
    - New engagement form page (app/(app)/engagements/new/page.tsx)
    - EngagementForm client component with HCP search + FMV panel
    - HcpSearchInput with 300ms debounce and keyboard nav
    - FmvRatePanel with skeleton loader and 5 panel states
    - EngagementStatusBadge with all 5 statuses
    - EngagementTable with dual empty states
  affects:
    - lib/engagement-validation.ts (created)
    - lib/engagement-validation.test.ts (replaced 18 it.todo stubs with real tests)
    - actions/engagement.ts (created)
    - actions/engagement.test.ts (replaced create/submit stubs; approve/reject/complete remain todo for Phase 3)
    - components/engagement/EngagementStatusBadge.tsx (created)
    - components/engagement/EngagementTable.tsx (created)
    - components/engagement/HcpSearchInput.tsx (created)
    - components/engagement/EngagementForm.tsx (created)
    - components/fmv/FmvRatePanel.tsx (created)
    - app/(app)/engagements/page.tsx (created)
    - app/(app)/engagements/new/page.tsx (created)
tech_stack:
  added: []
  patterns:
    - TDD red-green cycle for pure functions (engagement-validation tests) and server actions (create/submit tests)
    - useRef timer pattern for 300ms debounce in HcpSearchInput
    - role=combobox + role=listbox ARIA contract for HCP search popover
    - aria-live=polite on FmvRatePanel for screen reader announcements
    - Server-side ownership filter (submittedByClerkId = userId) for Business role
    - updateMany atomic ownership+status guard (T-02-04-02 mitigation)
    - Two-step create-then-submit pattern in EngagementForm for "Submit for Approval" button
key_files:
  created:
    - lib/engagement-validation.ts
    - actions/engagement.ts
    - components/engagement/EngagementStatusBadge.tsx
    - components/engagement/EngagementTable.tsx
    - components/engagement/HcpSearchInput.tsx
    - components/engagement/EngagementForm.tsx
    - components/fmv/FmvRatePanel.tsx
    - app/(app)/engagements/page.tsx
    - app/(app)/engagements/new/page.tsx
  modified:
    - lib/engagement-validation.test.ts (replaced 18 it.todo stubs with real tests)
    - actions/engagement.test.ts (replaced 9 create/submit stubs; 13 todo remain for Phase 3)
decisions:
  - "Submit for Approval creates draft then immediately calls submitEngagementAction in sequence within a single startTransition — no combined action needed for v1"
  - "useRef<ReturnType<typeof setTimeout> | undefined>(undefined) required for TypeScript strict mode; bare useRef<...>() not accepted"
  - "FmvRatePanel tracks 5 panel states (initial/loading/loaded/no_rate/no_card) as an explicit state machine rather than boolean flags to avoid impossible combinations"
  - "Engagement list page uses dynamic import of currentUser inside the component to avoid module-level top-level await in Server Component"
metrics:
  completed: "2026-05-12"
  duration_minutes: 12
  tasks_completed: 3
  tasks_total: 3
  files_modified: 2
  files_created: 9
---

# Phase 2 Plan 04: Engagement Form Vertical Slice Summary

## One-liner

Engagement creation form vertical slice: pure validation library (18 tests GREEN), createEngagement + submitEngagement Server Actions with ownership guard, HCP search popover with 300ms debounce, FMV rate reference panel with skeleton loader, engagement list page with role-based Business user filter, and new engagement form page — npm run build exit 0.

## Tasks Completed

| # | Task | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Implement lib/engagement-validation.ts and make validation tests GREEN | 156d0b2 | lib/engagement-validation.ts (3 pure validators), 18 tests GREEN |
| 2 | Implement actions/engagement.ts (createEngagement + submitEngagement) and make action tests GREEN | 00f190d | actions/engagement.ts (create + submit), 9 tests GREEN |
| 3 | Build engagement components, list page, and new engagement form page | 400612a | 7 UI files; npm run build exit 0, 15 routes |

## Verification Results

- `npx jest --testPathPatterns=engagement-validation` — 18/18 PASS (ENG-01, ENG-02, ENG-03)
- `npx jest --testPathPatterns="actions/engagement"` — 9/9 PASS (13 todo reserved for Phase 3 approve/reject/complete)
- `npx jest` full suite — 9 suites, 79 passed, 13 todo, 0 failed
- All 9 artifact files exist (confirmed via node -e check)
- `npm run build` — exit 0; TypeScript clean; 15 routes compiled including /engagements and /engagements/new
- lib/engagement-validation.ts — no "use server"; no Prisma/Clerk imports (pure utility, pattern: lib/hcp-validation.ts)
- actions/engagement.ts — "use server" first line; assertRole(["business","compliance"]) before DB; updateMany ownership+status guard; $transaction for state transitions
- app/(app)/engagements/page.tsx — submittedByClerkId filter for Business role (T-02-04-03); canCreate check suppresses "New Engagement" button for Finance users
- components/engagement/HcpSearchInput.tsx — role="combobox", role="listbox", 300ms debounce, Up/Down/Enter keyboard nav
- components/fmv/FmvRatePanel.tsx — aria-live="polite", Skeleton import, "FMV Rate Reference" heading, "Shown for reference only. Submission is not blocked." disclaimer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useRef requires explicit undefined initial value in TypeScript strict mode**

- **Found during:** Task 3 (npm run build TypeScript check)
- **Issue:** `useRef<ReturnType<typeof setTimeout>>()` fails TypeScript strict check — "Expected 1 arguments, but got 0" because the generic form without an argument is not valid when TypeScript can't infer the type
- **Fix:** Changed to `useRef<ReturnType<typeof setTimeout> | undefined>(undefined)` with explicit initial value
- **Files modified:** components/engagement/HcpSearchInput.tsx
- **Commit:** Included in Task 3 commit (400612a)

**2. [Rule 3 - Blocking Issue] Missing .env.local in worktree**

- **Found during:** Task 3 (npm run build page data collection phase)
- **Issue:** Same issue as Plans 02-02 and 02-03 — worktree does not inherit .env files; "DATABASE_URL environment variable is not set" error during build static page generation
- **Fix:** Copied .env.local and .env from main repo to worktree directory
- **Files modified:** .env.local, .env (not committed; in .gitignore)
- **Commit:** N/A

## Threat Model Coverage

All T-02-04-* mitigations confirmed present:

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-02-04-01 | `assertRole(roles, ["business", "compliance"])` in createEngagementAction — Finance cannot create | PRESENT |
| T-02-04-02 | `updateMany where id=engagementId AND status="draft" AND submittedByClerkId=user.id` — only creator can submit | PRESENT |
| T-02-04-03 | Server-side `where: { submittedByClerkId: userId }` for Business role in engagement list page | PRESENT |
| T-02-04-04 | `validateEngagementFields` called server-side before DB write in createEngagementAction | PRESENT |
| T-02-04-05 | Status hardcoded to `"draft"` in createEngagementAction data object — client cannot inject a different status | PRESENT |
| T-02-04-06 | HCP search results contain public registry data only; accepted per plan disposition | ACCEPTED |

## Known Stubs

None — all implemented functionality is wired to real API calls and Server Actions. The FMV panel fetches `/api/fmv/rate` which was implemented in Plan 02-03. The HCP search fetches `/api/hcps/search` which was implemented in Plan 02-03.

## Threat Flags

No new security-relevant surfaces beyond what's in the plan's threat model. Both API endpoints were created in Plan 02-03 with auth guards.

## Self-Check: PASSED

Files confirmed present:
- lib/engagement-validation.ts — FOUND (exports validateEngagementFields, validateRejectionReason, validateStateTransition)
- actions/engagement.ts — FOUND (exports createEngagementAction, submitEngagementAction)
- components/engagement/EngagementStatusBadge.tsx — FOUND (STATUS_CONFIG with all 5 statuses)
- components/engagement/EngagementTable.tsx — FOUND (8 columns, dual empty states)
- components/engagement/HcpSearchInput.tsx — FOUND (role="combobox", debounce 300ms, role="listbox")
- components/engagement/EngagementForm.tsx — FOUND ("Save Draft", "Submit for Approval", HcpSearchInput, FmvRatePanel)
- components/fmv/FmvRatePanel.tsx — FOUND (aria-live="polite", Skeleton, "FMV Rate Reference")
- app/(app)/engagements/page.tsx — FOUND (submittedByClerkId filter, canCreate Finance guard)
- app/(app)/engagements/new/page.tsx — FOUND ("New Engagement" heading, EngagementForm import)

Commits confirmed:
- 156d0b2 — FOUND (feat(02-04): implement engagement-validation pure library)
- 00f190d — FOUND (feat(02-04): implement createEngagementAction and submitEngagementAction)
- 400612a — FOUND (feat(02-04): add engagement components, list page, and new form page)
