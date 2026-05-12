---
phase: 02-fmv-engagement
plan: "03"
subsystem: fmv-lookup-api
tags: [prisma, api-route, server-component, client-component, fmv, hcp-search, tdd]
dependency_graph:
  requires:
    - 02-01 (FmvRateCard, FmvRate, Hcp schema models)
  provides:
    - getFmvRate function (state-first / national-fallback lookup)
    - GET /api/fmv/rate endpoint (FMV reference panel data source)
    - GET /api/hcps/search endpoint (HCP search popover data source)
    - /fmv/[id] rate card detail page (FMV-05)
  affects:
    - lib/fmv-lookup.ts (new)
    - lib/fmv-lookup.test.ts (replaced stubs with real tests)
    - app/api/fmv/rate/route.ts (new)
    - app/api/hcps/search/route.ts (new)
    - app/(app)/fmv/[id]/page.tsx (new)
    - components/fmv/FmvRateDetailClient.tsx (new)
tech_stack:
  added: []
  patterns:
    - Injectable Prisma client for unit testability (lib/fmv-lookup.ts)
    - Two-step sequential DB lookup for most-specific-wins (state then national)
    - Decimal to plain number serialization across server/client boundary
    - Server Component + "use client" child component split for page with filters
    - Base UI Select component with string | null onValueChange handler type
key_files:
  created:
    - lib/fmv-lookup.ts
    - app/api/fmv/rate/route.ts
    - app/api/hcps/search/route.ts
    - app/(app)/fmv/[id]/page.tsx
    - components/fmv/FmvRateDetailClient.tsx
  modified:
    - lib/fmv-lookup.test.ts (Wave 0 todo stubs replaced with 5 real tests)
decisions:
  - "FmvRateDetailClient placed in components/fmv/ (separate from page.tsx) because Next.js App Router requires server components and client components to be in separate files"
  - "Select onValueChange handler typed as (v: string | null) => void to match Base UI Select API (not Radix)"
  - "Decimal.toString() + parseFloat() used to serialize rateUsd across server/client boundary — safer than .toNumber() which has precision edge cases at large values"
metrics:
  completed: "2026-05-12"
  duration_minutes: 8
  tasks_completed: 3
  tasks_total: 3
  files_modified: 1
  files_created: 5
---

# Phase 2 Plan 03: FMV Lookup APIs and Rate Card Detail Page Summary

## One-liner

FMV lookup library with state-first/national-fallback (5 tests GREEN), /api/fmv/rate and /api/hcps/search API routes, and /fmv/[id] Server Component detail page with client-side filtering.

## Tasks Completed

| # | Task | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Implement lib/fmv-lookup.ts and make lookup tests GREEN | 6bbf8e5 | lib/fmv-lookup.ts (getFmvRate, injectable Prisma), lib/fmv-lookup.test.ts (5 tests, all PASS) |
| 2 | Build /api/fmv/rate and /api/hcps/search API routes | 314749d | app/api/fmv/rate/route.ts, app/api/hcps/search/route.ts, npm run build exit 0 |
| 3 | Build FMV rate card detail page (/fmv/[id]) | 2be10b4 | app/(app)/fmv/[id]/page.tsx (Server Component), components/fmv/FmvRateDetailClient.tsx (client filter+table) |

## Verification Results

- `npx jest --testPathPatterns=fmv-lookup` — 5 tests PASS, exit 0
- `npm test` full suite — 9 suites, 33 passed, 54 todo, 0 failed
- All 4 artifact files exist (confirmed via node -e check)
- `npm run build` — exit 0, /fmv/[id] and both API routes appear in route manifest
- lib/fmv-lookup.ts: no "use server" directive; accepts prisma as injected param; two sequential findFirst calls (state then null state)
- app/api/hcps/search/route.ts: q.length < 2 early return (T-02-03-04 DoS mitigation); take: 8; auth guard
- app/api/fmv/rate/route.ts: fetches HCP nuccCode + primaryState first; calls getFmvRate; auth guard
- app/(app)/fmv/[id]/page.tsx: generateMetadata, notFound, Decimal → number conversion before passing to client component

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Missing .env.local in worktree**

- **Found during:** Task 2 (npm run build)
- **Issue:** Worktree does not inherit .env files from main repo; build failed with "DATABASE_URL environment variable is not set"
- **Fix:** Copied .env.local and .env from main repo to worktree directory (same fix as Plan 01 — documented in 02-01-SUMMARY.md)
- **Files modified:** .env.local, .env (not committed; in .gitignore)
- **Commit:** N/A

**2. [Rule 1 - Bug] Base UI Select onValueChange type mismatch**

- **Found during:** Task 3 (npm run build TypeScript check)
- **Issue:** FmvRateDetailClient.tsx used `(v: string) => void` handler but Base UI Select.Root `onValueChange` signature is `(value: string | null, eventDetails: ...) => void` — TypeScript type error
- **Fix:** Updated handler types to `(v: string | null) => void` with `v ?? "all"` null-coalescing
- **Files modified:** components/fmv/FmvRateDetailClient.tsx
- **Commit:** Included in Task 3 commit (2be10b4) before separate commit

**3. [Rule 2 - Missing Critical Functionality] FmvRateDetailClient in separate file**

- **Found during:** Task 3 (architecture)
- **Issue:** Plan action suggested the client component could be inline in page.tsx, but Next.js App Router requires that files with "use client" and server component defaults be separate files — mixing causes build failure
- **Fix:** Created components/fmv/FmvRateDetailClient.tsx as a separate client component; page.tsx imports it as a server component would normally import a client child
- **Files created:** components/fmv/FmvRateDetailClient.tsx

## Threat Model Coverage

All T-02-03-* mitigations confirmed present:
- T-02-03-01 (Information Disclosure, /api/fmv/rate): `auth()` check → 401; implemented
- T-02-03-02 (Information Disclosure, /api/hcps/search): `auth()` check → 401; implemented
- T-02-03-03 (Information Disclosure, /fmv/[id]): Route protected via ROUTE_PERMISSIONS in lib/auth.ts (compliance only) from Plan 02-01
- T-02-03-04 (DoS, /api/hcps/search): `q.length < 2` early return + `take: 8` limit; implemented
- T-02-03-05 (Spoofing, hcpId in /api/fmv/rate): Accepted — read-only route; no ownership enforcement needed

## Known Stubs

None — all implemented functionality is wired to real Prisma queries. Placeholder attributes in Select/Input components are UI hint text, not data stubs.

## Threat Flags

No new security-relevant surfaces beyond what's in the plan's threat model. Both API routes are read-only with auth guards.

## Self-Check: PASSED

Files confirmed present:
- lib/fmv-lookup.ts — FOUND (contains `export async function getFmvRate(`)
- lib/fmv-lookup.test.ts — FOUND (5 real tests, no todos)
- app/api/fmv/rate/route.ts — FOUND (contains `export async function GET(`, `getFmvRate`)
- app/api/hcps/search/route.ts — FOUND (contains `export async function GET(`, `results: hcps`)
- app/(app)/fmv/[id]/page.tsx — FOUND (contains `generateMetadata`, `notFound`, `Rate Card v`)
- components/fmv/FmvRateDetailClient.tsx — FOUND (contains `Specialty Code`, `nuccDisplayName`)

Commits confirmed:
- 6bbf8e5 — FOUND (feat(02-03): implement getFmvRate lookup library)
- 314749d — FOUND (feat(02-03): add /api/fmv/rate and /api/hcps/search API routes)
- 2be10b4 — FOUND (feat(02-03): build FMV rate card detail page)
