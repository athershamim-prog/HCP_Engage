---
phase: 04-invoice-generation
plan: "03"
subsystem: invoice-ui
tags: [invoice, ui, engagement-form, action-panel, fmv, react, next-js]
dependency_graph:
  requires:
    - "04-01 (agreedRateUsd field, noOfActivities field, Invoice model)"
    - "04-02 (POST /api/engagements/[id]/invoice route handler)"
  provides:
    - "components/fmv/FmvRatePanel.tsx — onRateLoaded callback prop wired to EngagementForm"
    - "components/engagement/EngagementForm.tsx — Agreed Rate (USD) label, noOfActivities conditional field"
    - "components/engagement/ActionPanel.tsx — Generate Invoice (compliance gate) + Download Invoice (all roles)"
    - "app/(app)/engagements/[id]/page.tsx — Invoice relation in Prisma query, invoiceStorageUrl passed to ActionPanel"
  affects:
    - "Human verification checkpoint — requires manual testing of UI flows"
tech_stack:
  added: []
  patterns:
    - "onRateLoaded callback pattern — child panel calls parent callback on fetch resolve/reject/reset"
    - "Conditional field pattern — showNoOfActivities derived from rateUnit state, gates field render"
    - "Role-gated action button — isCompliance && popDocumentUrl gating Generate Invoice"
    - "fetch POST in useTransition — handleGenerateInvoice uses startTransition for loading state"
key_files:
  created: []
  modified:
    - components/fmv/FmvRatePanel.tsx
    - components/engagement/EngagementForm.tsx
    - components/engagement/ActionPanel.tsx
    - app/(app)/engagements/[id]/page.tsx
    - actions/engagement.ts
decisions:
  - "noOfActivities field placed in right column after FmvRatePanel (not in left column form) — keeps form linear while showing rate context alongside activities input"
  - "actions/engagement.ts CreateEngagementParams extended with noOfActivities optional — deviation Rule 2 (missing critical passthrough for schema field)"
  - "Invoice download card added to detail page body (in addition to ActionPanel) — provides visibility outside sidebar for all roles"
metrics:
  duration_seconds: 600
  duration_minutes: 10
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 5
  completed_date: "2026-05-16"
---

# Phase 4 Plan 03: Invoice UI — FmvRatePanel Callback, EngagementForm noOfActivities, ActionPanel Invoice Buttons Summary

**One-liner:** Wired invoice UI end-to-end: FmvRatePanel fires onRateLoaded callback to drive conditional noOfActivities field in EngagementForm; ActionPanel shows Generate Invoice (compliance-only when PoP present) and Download Invoice (all roles when invoice exists) on completed engagements; detail page queries Invoice relation and passes storageUrl.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | FmvRatePanel onRateLoaded callback + EngagementForm noOfActivities field | 7cc0a82 | Done |
| 2 | ActionPanel Generate/Download Invoice buttons + detail page Invoice relation | f773dbc | Done |

## What Was Built

### Task 1: FmvRatePanel + EngagementForm

**components/fmv/FmvRatePanel.tsx:**
- Added `onRateLoaded?: (rateUnit: string | null) => void` to `FmvRatePanelProps`
- Callback fires in 5 branches: `loaded` (passes `data.rate.rateUnit`), `no_rate` (passes `null`), `no_card` (passes `null`), fetch error (passes `null`), hcpId/engagementType reset (passes `null`)

**components/engagement/EngagementForm.tsx:**
- Added `rateUnit` state (`string | null`) — updated by `onRateLoaded` callback from FmvRatePanel
- Added `noOfActivities` state (`string`) — bound to conditional field
- Added `showNoOfActivities = rateUnit === "per_hour" || rateUnit === "per_day"` derived flag
- Renamed label: `"Compensation (USD)"` → `"Agreed Rate (USD)"`; aria-label updated to `"Agreed rate in USD"`
- Added `noOfActivities` Input field conditionally rendered in right column when `showNoOfActivities` is true
- Both `createEngagementAction` call sites updated to pass `noOfActivities: showNoOfActivities ? parseInt(noOfActivities, 10) || null : null`

**actions/engagement.ts (deviation Rule 2):**
- Added `noOfActivities?: number | null` to `CreateEngagementParams` interface
- Added `noOfActivities: params.noOfActivities ?? null` to `prisma.engagement.create` data

### Task 2: ActionPanel + Detail Page

**components/engagement/ActionPanel.tsx:**
- Added `invoiceStorageUrl?: string | null` to `ActionPanelProps` and destructuring
- Added `handleGenerateInvoice` async function: `fetch POST /api/engagements/{id}/invoice`, sets error on failure, calls `router.refresh()` on success, uses `startTransition`
- Replaced `return <ReadOnlyCard message="Completed" />` with tri-branch completed section:
  1. `invoiceStorageUrl` present → Download Invoice button (`<a href>` wrapping `<Button variant="outline">`) — visible to all roles
  2. `isCompliance && popDocumentUrl` → Generate Invoice button with `isPending` spinner — compliance only
  3. Fallback → `<ReadOnlyCard message="Completed" />` — no PoP or non-compliance without invoice

**app/(app)/engagements/[id]/page.tsx:**
- Added `invoice: { select: { storageUrl: true } }` to Prisma include block
- Added `invoiceStorageUrl={engagement.invoice?.storageUrl ?? null}` to `<ActionPanel>` call
- Added Invoice download card in detail body (between PoP and Status History) — visible when `engagement.invoice` exists

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (non-test files) | 0 errors |
| `npx jest --no-coverage` (full suite) | 147/147 tests PASS (12 suites) |
| `grep -c 'onRateLoaded' FmvRatePanel.tsx` | 8 (interface + destructure + 6 call sites) |
| `grep -c 'onRateLoaded' EngagementForm.tsx` | 1 (passed to FmvRatePanel) |
| `grep -c 'noOfActivities' EngagementForm.tsx` | 5 (state, showNoOfActivities, field, 2 action calls) |
| `grep 'compensationUsd' actions/ lib/ components/ app/` | 0 matches |
| `grep -c 'invoiceStorageUrl' ActionPanel.tsx` | 4 (interface + destructure + condition + href) |
| `grep -c 'handleGenerateInvoice' ActionPanel.tsx` | 2 (function def + onClick) |
| `grep -c 'invoice' detail page.tsx` | 5 (include + Invoice card + storageUrl + 2 references) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added noOfActivities to CreateEngagementParams**
- **Found during:** Task 1
- **Issue:** `createEngagementAction` in `actions/engagement.ts` had `CreateEngagementParams` without `noOfActivities`. Passing `noOfActivities` from the form would cause TypeScript errors and the value would not reach the Prisma create call.
- **Fix:** Added `noOfActivities?: number | null` to the interface and `noOfActivities: params.noOfActivities ?? null` to the prisma create data.
- **Files modified:** `actions/engagement.ts`
- **Commit:** 7cc0a82

**2. [Rule 2 - Design Enhancement] noOfActivities field placed in right column after FmvRatePanel**
- **Found during:** Task 1 (layout decision)
- **Issue:** Plan suggested placing noOfActivities "after the agreedRateUsd field" in left column; however, placing it in the right column adjacent to FmvRatePanel provides better UX — the user sees the rate unit context while entering activities count.
- **Fix:** Placed the conditional field in the right column `<div className="pt-6 space-y-5">` block, below FmvRatePanel.
- **Files modified:** `components/engagement/EngagementForm.tsx`
- **Commit:** 7cc0a82

## Known Stubs

None — all invoice UI is fully wired. Generate Invoice calls the real route handler; Download Invoice uses the real R2 storageUrl from DB.

Note: R2 env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`) must be set in `.env.local` for actual PDF generation to work. UI changes (field visibility, button presence/absence) can be verified without R2.

## Threat Surface Scan

Plan's threat model mitigations applied in implementation:

| Threat | Status |
|--------|--------|
| T-4-03-01: Generate Invoice visible to non-compliance | `isCompliance && popDocumentUrl` gate — frontend defense-in-depth; backend assertRole is the real control |
| T-4-03-02: noOfActivities float injection | `parseInt(noOfActivities, 10) || null` prevents float injection from form |
| T-4-03-03: invoiceStorageUrl disclosure | URL comes from server-side DB query (not user input); public R2 URL per D-12 |
| T-4-03-04: Invoice generation repudiation | Route handler stores generatedByClerkId and generatedByName (implemented in 04-02) |

No new threat surfaces introduced beyond plan's threat model.

## Self-Check: PASSED

- [x] `components/fmv/FmvRatePanel.tsx` has `onRateLoaded` in interface, destructuring, and 6 call sites
- [x] `components/engagement/EngagementForm.tsx` has `rateUnit` state, `showNoOfActivities`, `noOfActivities` field, and "Agreed Rate (USD)" label
- [x] `components/engagement/ActionPanel.tsx` has `invoiceStorageUrl` prop, `handleGenerateInvoice`, "Generate Invoice" and "Download Invoice" in completed branch
- [x] `app/(app)/engagements/[id]/page.tsx` has `invoice: { select: { storageUrl: true } }` in include and `invoiceStorageUrl` passed to ActionPanel
- [x] Commits 7cc0a82 and f773dbc exist in git log
- [x] 147 total tests pass, 0 test failures
- [x] 0 TypeScript errors in source (non-test) files
- [x] 0 `compensationUsd` references in source files
