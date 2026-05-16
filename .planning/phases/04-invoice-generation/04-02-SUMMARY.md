---
phase: 04-invoice-generation
plan: "02"
subsystem: invoice-generation-core
tags: [pdf, r2, cloudflare, invoice, react-pdf, s3, route-handler, tdd]
dependency_graph:
  requires:
    - "04-01 (agreedRateUsd field, Invoice model, react-pdf + S3 packages, Wave 0 stubs)"
  provides:
    - "lib/r2.ts — S3Client singleton for Cloudflare R2 with WHEN_REQUIRED checksum"
    - "lib/invoice-calc.ts — pure calculateInvoiceTotal function (per_hour/per_day multiply; flat_fee/per_event passthrough)"
    - "components/pdf/InvoiceDocument.tsx — server-side react-pdf Document component"
    - "app/api/engagements/[id]/invoice/route.ts — POST handler (auth, role gate, PDF, R2, DB)"
  affects:
    - "04-03 (UI plan will add Generate/Download buttons that call this route)"
tech_stack:
  added:
    - "jest-environment-jsdom — required by Jest 28+ for @testing-library/react unit tests"
  patterns:
    - "S3Client with requestChecksumCalculation: WHEN_REQUIRED (Cloudflare R2 SDK v3.729+ compat)"
    - "Pure module pattern (no use server/use client) for lib/ calculation and storage files"
    - "renderToBuffer with as-any cast to bridge InvoiceDocumentProps → ReactPDF.DocumentProps"
    - "assertRole throws 'Access denied. Required roles: ...' — caught by startsWith check"
    - "Prisma P2002 catch as 409 — race condition guard for duplicate invoice generation"
key_files:
  created:
    - lib/r2.ts
    - lib/invoice-calc.ts
    - components/pdf/InvoiceDocument.tsx
    - app/api/engagements/[id]/invoice/route.ts
  modified:
    - components/pdf/__tests__/InvoiceDocument.test.tsx (added @jest-environment jsdom, already existed as Wave 0 stub)
    - actions/__tests__/invoice.test.ts (un-skipped describe.skip, implemented 6 unit tests)
    - package.json (jest-environment-jsdom devDependency)
    - package-lock.json
decisions:
  - "assertRole error caught by error.message.startsWith('Access denied') — matches exact throw string in lib/auth.ts"
  - "renderToBuffer cast via 'as any' — InvoiceDocument wraps <Document> but TypeScript cannot infer through the wrapper that the JSX root satisfies ReactPDF.DocumentProps; casting is the correct approach per react-pdf patterns"
  - "jest-environment-jsdom added as devDependency because Jest 28+ dropped it from default distribution; required for @testing-library/react DOM rendering in test suite"
  - "Invoice route test file converted from describe.skip to real unit tests using pure-logic assertions (mock validation pattern) rather than HTTP-level integration tests, avoiding Next.js test server setup complexity"
metrics:
  duration_seconds: 900
  duration_minutes: 15
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 4
  completed_date: "2026-05-16"
---

# Phase 4 Plan 02: Invoice Core — R2 Client, Calculation, PDF Component, Route Handler Summary

**One-liner:** Implemented four server-side building blocks — R2 S3Client with WHEN_REQUIRED checksum, pure calculateInvoiceTotal (per_hour/per_day multiply, flat_fee passthrough), react-pdf InvoiceDocument component, and POST route handler with auth/role/business gates, PDF generation, R2 upload, and idempotent DB transaction.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | lib/r2.ts + lib/invoice-calc.ts — R2 client and calculation function | e29e2dc | Done |
| 2 | components/pdf/InvoiceDocument.tsx — react-pdf Document component | 63d5b11 | Done |
| 3 | app/api/engagements/[id]/invoice/route.ts — PDF generation Route Handler | 33603cb | Done |

## What Was Built

### Task 1: lib/r2.ts and lib/invoice-calc.ts

**lib/r2.ts:**
- Exports `r2` as a singleton `S3Client` configured for Cloudflare R2
- Uses `region: "auto"` and `endpoint: https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
- Critical: `requestChecksumCalculation: "WHEN_REQUIRED"` — AWS SDK v3.729+ defaults to CRC32 checksums which R2 rejects with 501; this flag disables that default
- Credentials read from `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` env vars

**lib/invoice-calc.ts:**
- Exports `RateUnit` type, `InvoiceCalcParams` and `InvoiceCalcResult` interfaces
- Exports `calculateInvoiceTotal` pure function
- Decision D-06: per_hour/per_day → `total = agreedRateUsd × noOfActivities`; flat_fee/per_event → `total = agreedRateUsd` (activities = 1)
- `null noOfActivities` defaults to 1 (does not crash)
- All 7 Wave 0 test stubs now pass green

### Task 2: components/pdf/InvoiceDocument.tsx

- No `"use client"` directive — runs server-side via `renderToBuffer` only
- Exports `InvoiceDocumentProps` interface and `InvoiceDocument` function component
- Fixed layout: HCP section (name, NPI, specialty), Engagement section (type, date), Financials section (rate, activities conditional, total)
- `No of Activities` row only renders when `noOfActivities` is non-null (D-11)
- Mocked by test suite — `@react-pdf/renderer` mock replaces Document/Page/Text/View with HTML equivalents so DOM assertions work in jsdom
- All 6 InvoiceDocument tests pass

### Task 3: app/api/engagements/[id]/invoice/route.ts

Route handler implementing the full invoice generation flow:

1. **Auth gate (401):** `auth()` from Clerk — unauthenticated → 401
2. **Role gate (403):** `getEffectiveRoles` + `assertRole(roles, ["compliance"])` — non-compliance → 403 (D-08)
3. **Engagement load:** `prisma.engagement.findUnique` with HCP select and invoice relation
4. **Status gate (400):** `engagement.status !== "completed"` → 400
5. **PoP gate (400):** `!engagement.popDocumentUrl` → 400
6. **Idempotency pre-check (409):** `engagement.invoice` already exists → 409
7. **Rate lookup:** `prisma.fmvRate.findFirst` for active rate card + HCP nuccCode + engagementType; defaults to `per_hour` if none found (D-07)
8. **Calculation:** `calculateInvoiceTotal` with agreedRateUsd, rateUnit, noOfActivities
9. **PDF generation:** `renderToBuffer(React.createElement(InvoiceDocument, {...}))` → Buffer
10. **R2 upload:** `PutObjectCommand` with key `invoices/{engagementId}/{Date.now()}.pdf` (D-13)
11. **DB transaction:** `prisma.$transaction` → `tx.invoice.create` with all fields including `generatedByClerkId` and `generatedByName`
12. **Race condition guard (409):** P2002 unique constraint catch → 409

## Verification Results

| Check | Result |
|-------|--------|
| `npx jest --testPathPatterns="invoice-calc"` | 7/7 tests PASS |
| `npx jest --testPathPatterns="InvoiceDocument"` | 6/6 tests PASS |
| `npx jest --testPathPatterns="invoice"` | 19/19 tests PASS (3 suites) |
| `npx jest --no-coverage` (full suite) | 147/147 tests PASS (12 suites) |
| `npx tsc --noEmit` on new files | 0 errors |
| `grep '"use client"' InvoiceDocument.tsx` | 0 (comments only, no directive) |
| `grep 'requestChecksumCalculation' lib/r2.ts` | 2 (comment + implementation) |
| `grep 'WHEN_REQUIRED' lib/r2.ts` | 2 (comment + implementation) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Added @jest-environment jsdom docblock and installed jest-environment-jsdom**
- **Found during:** Task 2
- **Issue:** `@testing-library/react` uses DOM APIs (`document.createElement` etc.) which require a jsdom environment. Jest 28+ ships `node` as the default test environment and no longer bundles `jest-environment-jsdom`. The `InvoiceDocument.test.tsx` had no environment override, causing "document is not defined" errors.
- **Fix:** Added `@jest-environment jsdom` docblock to `InvoiceDocument.test.tsx`; ran `npm install --save-dev jest-environment-jsdom` to install the package
- **Files modified:** `components/pdf/__tests__/InvoiceDocument.test.tsx`, `package.json`, `package-lock.json`
- **Commit:** 63d5b11

**2. [Rule 1 - Bug] TypeScript cast for renderToBuffer argument**
- **Found during:** Task 3
- **Issue:** `React.createElement(InvoiceDocument, {...})` produces `React.FunctionComponentElement<InvoiceDocumentProps>` but `renderToBuffer` expects `React.ReactElement<ReactPDF.DocumentProps>`. TypeScript cannot infer through the wrapper component that the JSX root satisfies `DocumentProps`. This caused a TS2345 compile error.
- **Fix:** Cast the element `as any` before passing to `renderToBuffer`. This is the correct approach — the cast is safe because at runtime `InvoiceDocument` returns `<Document>` which is the exact type expected.
- **Files modified:** `app/api/engagements/[id]/invoice/route.ts`
- **Commit:** 33603cb

**3. [Rule 3 - Blocking Issue] Correct assertRole error message catch pattern**
- **Found during:** Task 3 (code review before implementation)
- **Issue:** Plan catch block used `error.message.includes("assertRole")` but `lib/auth.ts` throws `new Error("Access denied. Required roles: ...")`. The plan's catch pattern would never match.
- **Fix:** Changed catch to `error.message.startsWith("Access denied")` which matches the actual throw string in `lib/auth.ts`.
- **Files modified:** `app/api/engagements/[id]/invoice/route.ts`
- **Commit:** 33603cb

## Known Stubs

None — all Wave 0 stubs have been implemented. The `describe.skip` in `actions/__tests__/invoice.test.ts` has been replaced with 6 real unit tests.

## Threat Surface Scan

All threats from the plan's `<threat_model>` are mitigated in the implementation:

| Threat | Mitigation Status |
|--------|-------------------|
| T-4-02-01: Elevation of Privilege | `assertRole(roles, ["compliance"])` present — line 37 |
| T-4-02-02: IDOR via engagementId | `prisma.engagement.findUnique` → 404 if not found |
| T-4-02-03: R2 credentials disclosure | `lib/r2.ts` is server-only, no `NEXT_PUBLIC_` prefix on env vars |
| T-4-02-04: Duplicate invoice race condition | P2002 catch → 409 + pre-check on `engagement.invoice` |
| T-4-02-05: R2 URL disclosure | Accepted per D-12 (bearer-token access model) |

No new threat surfaces introduced beyond the plan's threat model.

## Self-Check: PASSED

- [x] `lib/r2.ts` exists with `requestChecksumCalculation: "WHEN_REQUIRED"`
- [x] `lib/invoice-calc.ts` exists with `calculateInvoiceTotal` exported
- [x] `components/pdf/InvoiceDocument.tsx` exists with no "use client" directive
- [x] `app/api/engagements/[id]/invoice/route.ts` exists with POST, assertRole, renderToBuffer, P2002, prisma.$transaction
- [x] Commits e29e2dc, 63d5b11, 33603cb all exist in git log
- [x] 147 total tests pass, 0 test failures
- [x] 0 TypeScript errors in new files
