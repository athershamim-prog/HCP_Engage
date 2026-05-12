---
phase: 02-fmv-engagement
plan: "05"
subsystem: engagement-lifecycle-vertical-slice
tags: [engagement, state-machine, approval-queue, action-panel, role-based-access, tdd, server-actions, client-components, alert-dialog]
dependency_graph:
  requires:
    - 02-04 (createEngagementAction, submitEngagementAction, EngagementStatusBadge, engagement list page)
    - 02-01 (Engagement schema, EngagementStatusHistory table)
  provides:
    - approveEngagementAction, rejectEngagementAction, completeEngagementAction, deleteEngagementAction
    - Engagement detail page (/engagements/[id]) with full status history timeline
    - ActionPanel client component with role+status conditional actions
    - Approval queue page (/engagements/queue) with count chip and Review links
  affects:
    - actions/engagement.ts (4 new actions appended)
    - actions/engagement.test.ts (13 todo stubs replaced with 20 real tests)
    - app/(app)/engagements/[id]/page.tsx (created)
    - app/(app)/engagements/queue/page.tsx (created)
    - components/engagement/ActionPanel.tsx (created)
tech_stack:
  added: []
  patterns:
    - TDD red-green cycle for all 4 new server actions (20 new tests replacing 13 todo stubs)
    - Prisma $transaction with updateMany status guard for atomic state machine transitions
    - submittedByClerkId ownership guard in updateMany where clause for complete + delete actions
    - notFound() returning 404 (not 403) for Business user accessing another user's engagement
    - AlertDialog for delete draft confirmation (only modal in Phase 2)
    - useTransition + startTransition + Loader2 spinner pattern in ActionPanel (client component)
    - Role+status matrix rendering in ActionPanel (8 distinct states)
    - Defense-in-depth assertRole in /engagements/queue Server Component (middleware is primary)
key_files:
  created:
    - app/(app)/engagements/[id]/page.tsx
    - app/(app)/engagements/queue/page.tsx
    - components/engagement/ActionPanel.tsx
  modified:
    - actions/engagement.ts (4 new actions: approve, reject, complete, delete)
    - actions/engagement.test.ts (20 new tests replacing 13 todo stubs + adding 7 more; all 29 pass)
decisions:
  - "All 4 new actions follow the same updateMany status guard pattern — no direct field updates to status (CLAUDE.md architecture rule: engagement state machine, named transitions only)"
  - "Task 3 (approval queue page) executed before the checkpoint to match the plan's <verification> requirement: 'Tasks 1 and 3 must complete before the checkpoint'"
  - "FMV Reference card on detail page shows placeholder copy because rate snapshot onto engagement is deferred to v2 (FMV-V2-02)"
  - "validateRejectionReason called server-side in rejectEngagementAction before any DB write (ASVS V5 — client-side check is UX only)"
  - "deleteEngagementAction uses findUnique + explicit checks rather than updateMany because the delete call itself cannot be guarded with a where clause the same way"
metrics:
  completed: "2026-05-12"
  duration_minutes: 25
  tasks_completed: 3
  tasks_total: 3
  files_modified: 2
  files_created: 3
---

# Phase 2 Plan 05: Engagement Lifecycle Vertical Slice Summary

## One-liner

Engagement lifecycle complete: approve/reject/complete/delete server actions with $transaction status guards, engagement detail page with two-column layout and ownership 404 guard, AlertDialog delete confirmation, ActionPanel rendering 8 role+status combinations, and approval queue page — 29 tests GREEN, npm run build exit 0.

## Tasks Completed

| # | Task | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Add approve/reject/complete/delete actions + make all action tests GREEN | 06759a6 | 4 new Server Actions in actions/engagement.ts; 29/29 tests GREEN (was 9 pass + 13 todo) |
| 2 | Build engagement detail page + ActionPanel | 2eb96dc | app/(app)/engagements/[id]/page.tsx; components/engagement/ActionPanel.tsx; build exit 0 |
| 3 | Build approval queue page | 00db94c | app/(app)/engagements/queue/page.tsx; 17 routes; 99/99 full suite GREEN |

## Verification Results

- `npx jest --testPathPatterns="actions/engagement"` — 29/29 PASS (all 13 todo stubs replaced + 7 additional tests)
- Full test suite `npx jest --runInBand` — 9 suites, 99 passed, 0 failed, 0 todo
- All 3 artifact files exist: [id]/page.tsx, queue/page.tsx, ActionPanel.tsx
- Ownership guard present: `notFound()` + `submittedByClerkId` in engagement detail page
- `npm run build` — exit 0; TypeScript clean; 17 routes compiled including /engagements/[id] and /engagements/queue
- approveEngagementAction: `assertRole(roles, ["compliance", "finance"])` present
- completeEngagementAction: `submittedByClerkId: user.id` in updateMany where clause
- rejectEngagementAction: `validateRejectionReason(reason)` called before DB write

## Deviations from Plan

### Auto-fixed Issues

None.

### Ordering Adjustment

**[Deviation - Plan Ambiguity] Task 3 executed before checkpoint**

- **Found during:** Planning the checkpoint execution
- **Issue:** The plan's `<verification>` section states "Tasks 1 and 3 must complete before the checkpoint" but the XML task list places Task 3 AFTER the checkpoint. These two directives conflict.
- **Resolution:** Followed the `<verification>` directive — Task 3 (approval queue page) is purely additive and independent; executing it before the checkpoint allows the full verification suite to run and gives the human verifier a complete feature to test.
- **Impact:** The checkpoint now covers the full Phase 2 feature set including the approval queue.

## Threat Model Coverage

All T-02-05-* mitigations confirmed present:

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-02-05-01 | `assertRole(roles, ["compliance", "finance"])` in approveEngagementAction | PRESENT |
| T-02-05-02 | `assertRole(roles, ["compliance", "finance"])` + `validateRejectionReason` server-side in rejectEngagementAction | PRESENT |
| T-02-05-03 | `validateRejectionReason(reason)` called BEFORE DB write in rejectEngagementAction | PRESENT |
| T-02-05-04 | `updateMany where status="submitted"` in approveEngagementAction — count=0 on wrong state | PRESENT |
| T-02-05-05 | `if (isBusinessRole && engagement.submittedByClerkId !== user.id) notFound()` — returns 404 not 403 | PRESENT |
| T-02-05-06 | Explicit `findUnique` + ownership + draft status checks before `prisma.engagement.delete` | PRESENT |
| T-02-05-07 | ROUTE_PERMISSIONS middleware (primary) + `assertRole` in /engagements/queue (defense in depth) | PRESENT |

## Known Stubs

**FMV Reference card on engagement detail page** — shows "Rate data displayed for reference only." instead of actual rate data.

- **File:** `app/(app)/engagements/[id]/page.tsx`
- **Reason:** FMV rate snapshot onto engagement at creation time is deferred to v2 (FMV-V2-02 — "FMV rate cards are immutable — rows never overwritten; effective date ranges; rate snapshotted onto engagement at creation" is a v2 requirement). In v1, no FMV data is stored on the engagement record.
- **Future plan:** FMV-V2-02 will add a `fmvRateAtSubmission` field to the Engagement model and snapshot it at creation. The detail page will then display the snapshotted value.
- **Assessment:** This stub does NOT prevent the plan's goal from being achieved. The engagement lifecycle (approve/reject/complete/delete) is fully functional. The FMV reference is display-only by design for v1.

## Threat Flags

No new security-relevant surfaces beyond what's in the plan's threat model.

## Self-Check: PASSED

Files confirmed present:
- actions/engagement.ts — FOUND (exports approveEngagementAction, rejectEngagementAction, completeEngagementAction, deleteEngagementAction)
- actions/engagement.test.ts — FOUND (29 tests all PASS)
- app/(app)/engagements/[id]/page.tsx — FOUND (notFound, submittedByClerkId, Status History, Engagement Details, FMV Reference, generateMetadata)
- app/(app)/engagements/queue/page.tsx — FOUND (Approval Queue, status: submitted, Queue is clear)
- components/engagement/ActionPanel.tsx — FOUND (AlertDialog, Approve, all 4 actions imported)

Commits confirmed:
- 06759a6 — FOUND (feat(02-05): add approve/reject/complete/delete engagement actions)
- 2eb96dc — FOUND (feat(02-05): add engagement detail page and ActionPanel component)
- 00db94c — FOUND (feat(02-05): add approval queue page (/engagements/queue))
