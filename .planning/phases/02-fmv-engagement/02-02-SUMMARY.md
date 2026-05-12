---
phase: 02-fmv-engagement
plan: "02"
subsystem: fmv-upload-wizard
tags: [fmv, sheetjs, parser, server-actions, upload-wizard, nucc, compliance, tdd]
dependency_graph:
  requires:
    - 02-01 (NuccTaxonomy table seeded, FmvRateCard/FmvRate schema, SheetJS installed)
  provides:
    - parseRateCardBuffer pure function (lib/fmv-parser.ts)
    - validateNuccCodes pure function (lib/fmv-parser.ts)
    - parseRateCardAction Server Action (actions/fmv.ts)
    - activateRateCardAction Server Action (actions/fmv.ts)
    - FMV rate card list page (app/(app)/fmv/page.tsx)
    - FMV upload wizard (app/(app)/fmv/upload/page.tsx + FmvUploadWizard.tsx)
    - RateCardTable preview component (components/fmv/RateCardTable.tsx)
    - FmvActivateButton client component (app/(app)/fmv/FmvActivateButton.tsx)
  affects:
    - lib/fmv-parser.ts (created)
    - lib/fmv-parser.test.ts (converted from stubs to real tests)
    - actions/fmv.ts (created)
    - actions/fmv.test.ts (converted from stubs to real tests)
    - app/(app)/fmv/page.tsx (created)
    - app/(app)/fmv/FmvActivateButton.tsx (created)
    - app/(app)/fmv/upload/page.tsx (created)
    - app/(app)/fmv/upload/FmvUploadWizard.tsx (created)
    - components/fmv/RateCardTable.tsx (created)
tech_stack:
  added: []
  patterns:
    - TDD red-green cycle for pure functions (parser + action tests)
    - SheetJS XLSX.read(buffer, {type:"buffer"}) with raw:false (formula injection prevention)
    - Prisma $transaction for atomic rate card activation (supersede prior + activate new)
    - Upload wizard 4-state machine: idle → parsing → preview → activating
    - Server Action role guard pattern: assertRole(["compliance"]) before any DB operation
    - per-row NUCC validation badge pattern (nuccValid boolean → Badge color class)
key_files:
  created:
    - lib/fmv-parser.ts
    - actions/fmv.ts
    - app/(app)/fmv/page.tsx
    - app/(app)/fmv/FmvActivateButton.tsx
    - app/(app)/fmv/upload/page.tsx
    - app/(app)/fmv/upload/FmvUploadWizard.tsx
    - components/fmv/RateCardTable.tsx
  modified:
    - lib/fmv-parser.test.ts (replaced 11 it.todo stubs with real tests)
    - actions/fmv.test.ts (replaced 9 it.todo stubs with real tests)
decisions:
  - "Button component uses Base UI ButtonPrimitive — no asChild support; Cancel links use plain Link with button styling instead"
  - "FmvActivateButton extracted as a separate client component file rather than inline in the Server Component page to satisfy Next.js server/client boundary"
  - "Upload wizard state machine handles both idle and error in one render branch (re-shows file drop zone with error message on parse failure)"
  - "View Rates link in rate card list page points to /fmv/[id] (forward reference to Plan 03 detail page; will 404 until implemented)"
metrics:
  completed: "2026-05-12"
  duration_minutes: 7
  tasks_completed: 3
  tasks_total: 3
  files_modified: 2
  files_created: 7
---

# Phase 2 Plan 02: FMV Upload Wizard Vertical Slice Summary

## One-liner

Full FMV upload wizard vertical slice: SheetJS parser library with NUCC validation, compliance-only Server Actions with atomic $transaction activation, rate card version list page, and multi-step upload wizard with per-row validation badges — 19 parser and action tests GREEN, build clean.

## Tasks Completed

| # | Task | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Implement lib/fmv-parser.ts and make parser tests GREEN | fee00f8 | lib/fmv-parser.ts (parseRateCardBuffer + validateNuccCodes), 11 tests GREEN |
| 2 | Implement actions/fmv.ts Server Actions and make action tests GREEN | 27ca20d | actions/fmv.ts (parseRateCardAction + activateRateCardAction), 8 tests GREEN |
| 3 | Build FMV rate card list page and upload wizard | 7688e75 | 5 UI files; npm run build exit 0 |

## Verification Results

- `npm test -- --testPathPatterns=fmv-parser` — 11/11 PASS (FMV-01, FMV-02)
- `npm test -- --testPathPatterns="actions/fmv"` — 8/8 PASS (FMV-01, FMV-02, FMV-03)
- `npm test` (full suite) — 47 passed, 0 failed, 39 todo (remaining engagement stubs)
- `npm run build` — exit 0; TypeScript clean; all 5 routes compiled
- All 5 must-have files exist
- lib/fmv-parser.ts — no "use server"; no Prisma/Clerk imports (pure utility)
- actions/fmv.ts — "use server" first line; assertRole before DB; $transaction for activation; revalidatePath("/fmv")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] No node_modules in worktree**

- **Found during:** Pre-task setup
- **Issue:** The worktree was created without a node_modules directory; `npm test` and `npm run build` would fail
- **Fix:** Ran `npm install` which installed all dependencies including SheetJS 0.20.3 from CDN
- **Files modified:** node_modules (runtime, not committed), package-lock.json (already tracked)
- **Commit:** N/A (node_modules not committed)

**2. [Rule 3 - Blocking Issue] No .env.local in worktree**

- **Found during:** Pre-task setup (anticipating Task 2 server action build)
- **Issue:** Worktrees do not inherit parent repo .env files; Next.js build would fail without DATABASE_URL / Clerk keys
- **Fix:** Copied .env.local and .env from main repo; both in .gitignore so not committed
- **Files modified:** .env.local, .env (not tracked)
- **Commit:** N/A

**3. [Rule 1 - Bug] Button asChild not supported in Base UI ButtonPrimitive**

- **Found during:** Task 3 (npm run build TypeScript error)
- **Issue:** The plan's suggested `<Button asChild>` pattern is from Radix/shadcn v3; this project's Button wraps Base UI's ButtonPrimitive which has no asChild prop — TypeScript error
- **Fix:** Replaced all `<Button asChild>` Cancel buttons with `<Link>` using button-equivalent Tailwind classes
- **Files modified:** app/(app)/fmv/upload/FmvUploadWizard.tsx
- **Commit:** Included in Task 3 commit (7688e75)

**4. [Rule 1 - Bug] Unused destructure variables causing potential TypeScript warnings**

- **Found during:** Task 3 code review before build
- **Issue:** The preview state branch destructured `rows`, `hasErrors`, `rowCount` but also computed `displayRows`, `displayHasErrors`, `displayRowCount` separately
- **Fix:** Removed the redundant destructure; use display* variables directly
- **Files modified:** app/(app)/fmv/upload/FmvUploadWizard.tsx
- **Commit:** Included in Task 3 commit (7688e75)

## Threat Model Coverage

All T-02-02-* mitigations confirmed present:

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-02-02-01 | raw:false in sheet_to_json prevents formula injection | PRESENT in fmv-parser.ts |
| T-02-02-02 | assertRole(["compliance"]) in parseRateCardAction before file read | PRESENT |
| T-02-02-03 | assertRole(["compliance"]) in activateRateCardAction | PRESENT |
| T-02-02-04 | $transaction with updateMany where id=rateCardId AND status=pending; count=0 guard | PRESENT |
| T-02-02-05 | Client-side 5MB check + next.config.ts bodySizeLimit:5mb (from Plan 01) | PRESENT |
| T-02-02-06 | ROUTE_PERMISSIONS restricts /fmv and /fmv/upload to compliance (from Plan 01) | PRESENT |

## Known Stubs

- `/fmv/[id]` (rate card detail page) — not yet implemented; "View Rates" link in page.tsx points to this route which will 404 until built. This is intentional — the detail page is in Plan 03 scope.

## Threat Flags

No new security-relevant surfaces beyond what's in the plan's threat model.

## Self-Check: PASSED

Files confirmed present:
- lib/fmv-parser.ts — FOUND
- lib/fmv-parser.test.ts — FOUND (11 real tests)
- actions/fmv.ts — FOUND
- actions/fmv.test.ts — FOUND (8 real tests)
- app/(app)/fmv/page.tsx — FOUND
- app/(app)/fmv/FmvActivateButton.tsx — FOUND
- app/(app)/fmv/upload/page.tsx — FOUND
- app/(app)/fmv/upload/FmvUploadWizard.tsx — FOUND
- components/fmv/RateCardTable.tsx — FOUND

Commits confirmed:
- fee00f8 — FOUND (feat(02-02): implement fmv-parser pure utility)
- 27ca20d — FOUND (feat(02-02): implement actions/fmv.ts Server Actions)
- 7688e75 — FOUND (feat(02-02): add FMV rate card list page, upload wizard)
