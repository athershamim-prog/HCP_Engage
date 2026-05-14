---
phase: 04-invoice-generation
plan: "01"
subsystem: schema-migration
tags: [prisma, migration, rename, invoice, packages, wave0-stubs]
dependency_graph:
  requires: []
  provides:
    - agreedRateUsd field on Engagement (renamed from compensationUsd, data preserved)
    - noOfActivities Int? field on Engagement
    - Invoice model with unique engagementId constraint
    - Regenerated Prisma client types
    - "@react-pdf/renderer@4.5.1 installed"
    - "@aws-sdk/client-s3@3.1046.0 installed"
    - Wave 0 test stubs for invoice-calc, InvoiceDocument, invoice route
  affects:
    - All engagement UI (field rename flows through EngagementTable, EngagementForm, all queue pages)
    - Wave 2 invoice generation (depends on Invoice model + R2 env vars)
tech_stack:
  added:
    - "@react-pdf/renderer@4.5.1 — PDF generation library"
    - "@aws-sdk/client-s3@3.1046.0 — Cloudflare R2 (S3-compatible) client"
    - "@testing-library/react — React component testing for InvoiceDocument"
    - "@testing-library/jest-dom — additional jest matchers"
  patterns:
    - "Prisma db push workflow (no migration history) → manual migration via prisma db execute"
    - "Wave 0 TDD stub pattern: tests written red before implementation modules exist"
    - "RENAME COLUMN SQL (not DROP+ADD) to preserve existing compensation data"
key_files:
  created:
    - prisma/migrations/20260514000000_rename_compensation_add_invoice/migration.sql
    - lib/__tests__/invoice-calc.test.ts
    - components/pdf/__tests__/InvoiceDocument.test.tsx
    - actions/__tests__/invoice.test.ts
  modified:
    - prisma/schema.prisma
    - package.json
    - package-lock.json
    - next.config.ts
    - .env.example
    - lib/engagement-validation.ts
    - lib/engagement-validation.test.ts
    - actions/engagement.ts
    - actions/engagement.test.ts
    - app/(app)/engagements/page.tsx
    - app/(app)/engagements/[id]/page.tsx
    - app/(app)/engagements/legal-queue/page.tsx
    - app/(app)/engagements/queue/page.tsx
    - components/engagement/EngagementForm.tsx
    - components/engagement/EngagementTable.tsx
decisions:
  - "Used prisma db execute instead of prisma migrate dev because the project uses db push workflow (no prior migration history) — migrate dev detected schema drift and required a full reset"
  - "RENAME COLUMN SQL handwritten to avoid Prisma's incorrect auto-generated DROP+ADD which would destroy existing compensation data"
  - "@testing-library/react and @testing-library/jest-dom added as devDependencies to support Wave 0 InvoiceDocument test stub"
  - "Wave 0 invoice route stub uses describe.skip (not just failing) because the route module does not exist yet — skipped tests will be converted to real tests in Wave 2"
metrics:
  duration_seconds: 460
  duration_minutes: 7
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 15
  completed_date: "2026-05-14"
---

# Phase 4 Plan 01: Schema Migration + Package Installation + Wave 0 TDD Stubs Summary

**One-liner:** Blocking wave — renamed compensationUsd→agreedRateUsd (RENAME COLUMN, data preserved), added noOfActivities+Invoice model, installed react-pdf/S3 packages, updated 10 files, wrote Wave 0 red test stubs.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Install packages, update next.config.ts and .env.example | 93016bb | Done |
| 2 | [BLOCKING] Prisma schema migration — rename compensationUsd, add noOfActivities, add Invoice model | 90f6eaa | Done |
| 3 | Rename compensationUsd across all 10 files and write Wave 0 test stubs | 378188f | Done |

## What Was Built

### Task 1: Packages + Config
- Installed `@react-pdf/renderer@4.5.1` and `@aws-sdk/client-s3@3.1046.0` as production dependencies
- Installed `@testing-library/react` and `@testing-library/jest-dom` as dev dependencies
- Added `serverExternalPackages: ["@react-pdf/renderer"]` to `next.config.ts` (required for Next.js server-side PDF rendering)
- Documented all 5 R2 env vars in `.env.example` with placeholder values

### Task 2: Prisma Schema Migration (BLOCKING)
- **Schema changes:** `compensationUsd` renamed to `agreedRateUsd`, `noOfActivities Int?` added, `invoice Invoice?` relation added, `Invoice` model created
- **Migration approach:** Project uses `prisma db push` workflow (no migration history). Used `prisma db execute` with handwritten SQL using `RENAME COLUMN` to preserve existing data
- **Invoice model:** Includes `@unique engagementId` constraint (idempotency guard for Wave 2), all required fields for PDF generation
- `npx prisma generate` regenerated client types — `agreedRateUsd` and `Invoice` now available as Prisma types

### Task 3: Field Rename + Wave 0 Stubs
- **10 files renamed:** All `compensationUsd` references replaced with `agreedRateUsd` — zero remaining references
- **engagement-validation.ts:** Param name changed, error message updated to "Agreed rate cannot be negative."
- **engagement-validation.test.ts:** VALID_ENGAGEMENT fixture updated, negative test updated to match `/agreed rate/i`
- **Wave 0 test stubs created:**
  - `lib/__tests__/invoice-calc.test.ts` — 7 tests for `calculateInvoiceTotal`, fails with "Cannot find module" (expected)
  - `components/pdf/__tests__/InvoiceDocument.test.tsx` — 6 tests for PDF rendering with mocked react-pdf, fails with "Cannot find module" (expected)
  - `actions/__tests__/invoice.test.ts` — 6 tests using `describe.skip` for route handler (skipped, no failures)

## Verification Results

| Check | Result |
|-------|--------|
| `npx prisma validate` | Schema is valid |
| `npx prisma generate` | Exit 0, client types regenerated |
| `grep -rn compensationUsd actions/ lib/ components/ app/` | 0 matches |
| `npx jest --testPathPatterns="engagement-validation"` | 33 tests PASS |
| `npx jest --testPathPatterns="invoice-calc"` | FAIL: Cannot find module (expected Wave 0) |
| `npx jest --testPathPatterns="InvoiceDocument"` | FAIL: Cannot find module (expected Wave 0) |
| `npx tsc --noEmit \| grep compensationUsd` | 0 matches |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Used prisma db execute instead of prisma migrate dev**
- **Found during:** Task 2
- **Issue:** `npx prisma migrate dev --create-only` detected schema drift (database has all tables from prior `prisma db push` runs but no migration history). Prisma required a full reset which would destroy all data.
- **Fix:** Handwrote the migration SQL file and applied via `npx prisma db execute --file migration.sql`. The migration uses `RENAME COLUMN "compensationUsd" TO "agreedRateUsd"` (preserves data) plus `ADD COLUMN "noOfActivities"` and `CREATE TABLE "Invoice"`.
- **Files modified:** `prisma/migrations/20260514000000_rename_compensation_add_invoice/migration.sql` (created manually)
- **Commit:** 90f6eaa

**2. [Rule 2 - Missing Critical Functionality] Added @testing-library/react and @testing-library/jest-dom**
- **Found during:** Task 3
- **Issue:** InvoiceDocument.test.tsx requires `@testing-library/react` which was not installed (not in original devDependencies).
- **Fix:** Ran `npm install --save-dev @testing-library/react @testing-library/jest-dom`
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** 378188f

## User Action Required (R2 Bucket Provisioning)

The following R2 setup is required before Wave 2 route handler can upload PDFs. Code tasks can proceed without real credentials:

| Step | Location | Task |
|------|----------|------|
| Create R2 bucket | Cloudflare Dashboard → R2 → Create Bucket | Name: `hcp-engage-invoices` |
| Enable public access | R2 → hcp-engage-invoices → Settings → Public Access | Enable and copy domain |
| Create API token | R2 → Manage R2 API Tokens → Create API Token | Grants Object Read/Write |
| Set env vars | `.env.local` | R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL |

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `calculateInvoiceTotal` missing | `lib/__tests__/invoice-calc.test.ts` | Module `lib/invoice-calc.ts` not created until Wave 2 |
| `InvoiceDocument` missing | `components/pdf/__tests__/InvoiceDocument.test.tsx` | Component not created until Wave 2 |
| Invoice route tests skipped | `actions/__tests__/invoice.test.ts` | Route handler not created until Wave 2 |

These stubs are intentional Wave 0 placeholders. Wave 2 will implement the modules and un-skip/fix the tests.

## Self-Check: PASSED

- [x] prisma/schema.prisma contains agreedRateUsd and Invoice model
- [x] prisma/migrations/20260514000000_rename_compensation_add_invoice/migration.sql contains RENAME COLUMN
- [x] lib/__tests__/invoice-calc.test.ts exists
- [x] components/pdf/__tests__/InvoiceDocument.test.tsx exists
- [x] actions/__tests__/invoice.test.ts exists
- [x] Commits 93016bb, 90f6eaa, 378188f all exist in git log
- [x] engagement-validation tests: 33 passed
- [x] Zero compensationUsd references in source files
