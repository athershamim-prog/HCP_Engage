---
phase: 01-auth-hcp-management
plan: 02
subsystem: api
tags: [nextjs, nppes, prisma, clerk, shadcn, tailwind, typescript, hcp, npi, server-actions]

# Dependency graph
requires:
  - phase: 01-auth-hcp-management/skeleton
    provides: lib/auth.ts, lib/prisma.ts, prisma/schema.prisma (Hcp model), app shell, Clerk middleware
provides:
  - lib/nppes.ts with fetchNppesHcp, mapNppesResult, validateNpi — full NPPES API client
  - app/api/nppes/route.ts — authenticated NPPES proxy route
  - app/api/hcps/exists/route.ts — NPI existence check route
  - actions/hcp.ts with addHcp (role-gated) and searchHcps (paginated) Server Actions
  - HCP Directory page at /hcps — filterable, paginated table with 8 columns
  - NPI Lookup page at /hcps/new — NPPES search, result card, duplicate detection, add-to-DB flow
  - HcpStatusBadge, DebarmentBadge, HcpTable, NpiLookupForm, EmptyState components
affects:
  - 01-auth-hcp-management/hcp-profile
  - 01-auth-hcp-management/hcp-status
  - all future phases using HCP records

# Tech tracking
tech-stack:
  added:
    - date-fns (relative timestamps in HCP table)
  patterns:
    - NPPES proxy pattern — server-side route handler calls external API on behalf of authenticated user
    - Server Action role guard — currentUser() + publicMetadata.role check before DB writes
    - Prisma.HcpWhereInput for type-safe dynamic where clauses in searchHcps
    - base-ui/react Button does not support asChild — use <Link> with className for navigation buttons

key-files:
  created:
    - lib/nppes.ts — fetchNppesHcp (NPPES API caller), mapNppesResult (response mapper), validateNpi (NPI format guard)
    - lib/nppes.test.ts — 7 unit tests for validateNpi (3) and mapNppesResult (4); all pass
    - app/api/nppes/route.ts — GET /api/nppes?npi= proxy; 401 for unauth; 200 with found/hcp shape
    - app/api/hcps/exists/route.ts — GET /api/hcps/exists?npi= returns { exists: boolean, id: string | null }
    - actions/hcp.ts — addHcp (role check, duplicate-safe create) and searchHcps (paginated, name/NPI filter)
    - components/hcp/HcpStatusBadge.tsx — active/inactive/suspended/do_not_engage with UI-SPEC colors
    - components/hcp/DebarmentBadge.tsx — not_checked/clear/hit with AlertTriangle for not_checked
    - components/hcp/HcpTable.tsx — 8-column table, row-click navigation, formatDistanceToNow timestamps
    - components/hcp/NpiLookupForm.tsx — NPI input (numeric, maxLength=10), NPPES fetch, result card, addHcp
    - components/shared/EmptyState.tsx — reusable heading+body empty state
    - app/(app)/hcps/new/page.tsx — Add HCP page wrapping NpiLookupForm
  modified:
    - app/(app)/hcps/page.tsx — replaced placeholder with full directory (searchHcps, HcpTable, pagination)
    - package.json — added date-fns dependency

key-decisions:
  - "Prisma.HcpWhereInput used instead of Parameters<typeof prisma.hcp.findMany>[0]['where'] — the findMany arg is optional, making the index type include undefined"
  - "Button asChild pattern incompatible with @base-ui/react/button — replaced with <Link> + className for all navigation actions; consistent with UI-SPEC visual requirements"
  - "NPI input uses inputMode=numeric + maxLength=10 (not type=number) per UI-SPEC — avoids browser numeric input quirks (arrows, scroll wheel)"

patterns-established:
  - "Pattern 5: NPPES proxy — never call NPPES from client; route handler verifies Clerk auth first, then proxies to CMS API; validateNpi() called before outbound request (T-02-04 injection guard)"
  - "Pattern 6: Server Action role guard — always use currentUser() (not auth()) in Server Actions that write to DB; check publicMetadata.role before any DB mutation"
  - "Pattern 7: Link-as-button — @base-ui/react Button has no asChild; use <Link href> with buttonVariants className for navigation CTAs"

requirements-completed:
  - HCP-01
  - HCP-02

# Metrics
duration: 6min
completed: 2026-05-08
---

# Phase 01 Plan 02: HCP Directory Summary

**NPPES NPI lookup client with authenticated proxy route, role-gated addHcp Server Action, and full filterable HCP directory with status/debarment badge components**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-08T05:42:27Z
- **Completed:** 2026-05-08T05:48:30Z
- **Tasks:** 2 (Task 1: TDD — NPPES client + proxy + Server Actions; Task 2: UI components + pages)
- **Files modified:** 12 (9 created, 3 modified)

## Accomplishments
- NPPES API client with validateNpi injection guard, mapNppesResult field mapper, and fetchNppesHcp async caller; all 7 unit tests pass
- Authenticated /api/nppes proxy route (401 for unauth) and /api/hcps/exists NPI existence check route
- addHcp Server Action with Compliance/Business role guard, duplicate NPI detection, and Prisma create; searchHcps with name/NPI OR filter and pagination
- Full HCP Directory at /hcps with search form, 8-column HcpTable, HcpStatusBadge (4 statuses), DebarmentBadge (3 states with AlertTriangle), and pagination
- NPI Lookup page at /hcps/new — numeric input, NPPES fetch with loading spinner, result card with duplicate banner, "Add to Directory" / "View Profile" / "Search again" buttons matching UI-SPEC copywriting contract exactly

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing tests for validateNpi and mapNppesResult** - `4d20845` (test)
2. **Task 1 GREEN: NPPES client, proxy route, and addHcp Server Action** - `e7bccec` (feat)
3. **Task 2: HCP Directory page, NPI Lookup flow, and badge components** - `e2c11d2` (feat)

## Files Created/Modified
- `lib/nppes.ts` — fetchNppesHcp, mapNppesResult, validateNpi, NppesHcp type
- `lib/nppes.test.ts` — 7 unit tests; 3 for validateNpi, 4 for mapNppesResult; all pass GREEN
- `app/api/nppes/route.ts` — GET proxy with auth() Clerk check; 401/400/200/502 responses
- `app/api/hcps/exists/route.ts` — GET NPI existence check; { exists: boolean, id: string | null }
- `actions/hcp.ts` — addHcp (role guard + duplicate check + Prisma create) and searchHcps (paginated with Prisma.HcpWhereInput)
- `components/hcp/HcpStatusBadge.tsx` — 4 statuses: active/inactive/suspended/do_not_engage with UI-SPEC exact HSL colors
- `components/hcp/DebarmentBadge.tsx` — 3 states: not_checked (AlertTriangle + gray), clear (green), hit (red)
- `components/hcp/HcpTable.tsx` — 8-column table with row-click navigation and formatDistanceToNow
- `components/hcp/NpiLookupForm.tsx` — client component: numeric NPI input, NPPES fetch, result card, addHcp action
- `components/shared/EmptyState.tsx` — reusable empty state with heading + body props
- `app/(app)/hcps/page.tsx` — replaced placeholder; full directory with searchHcps + HcpTable + pagination
- `app/(app)/hcps/new/page.tsx` — Add HCP page wrapping NpiLookupForm

## Decisions Made
- Used `Prisma.HcpWhereInput` for the `where` clause in `searchHcps` — `Parameters<typeof prisma.hcp.findMany>[0]["where"]` resolves to `X | undefined` because the first arg is optional, making TypeScript reject property access on it
- Replaced all `Button asChild` usages with `<Link>` + inline className — the installed Button uses `@base-ui/react/button` which does not support Radix Slot's `asChild` prop; visual result is identical

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma.HcpWhereInput type for searchHcps where clause**
- **Found during:** Task 2 (build verification)
- **Issue:** `Parameters<typeof prisma.hcp.findMany>[0]["where"]` resolves to `WhereInput | undefined` because the entire findMany arg object is optional; TypeScript then rejects `where.OR =` assignment
- **Fix:** Changed to `Prisma.HcpWhereInput` imported from `@prisma/client`
- **Files modified:** `actions/hcp.ts`
- **Verification:** `npm run build` passes TypeScript check
- **Committed in:** `e2c11d2` (Task 2 commit)

**2. [Rule 1 - Bug] Button asChild incompatibility with @base-ui/react**
- **Found during:** Task 2 (build verification)
- **Issue:** Plan code uses `<Button asChild><Link>...</Link></Button>` but the installed Button component (`@base-ui/react/button`) does not expose `asChild` prop — TypeScript error on every Button used for navigation
- **Fix:** Replaced all navigation Buttons with `<Link>` styled with inline Tailwind classes matching the Button's visual design; no functionality change
- **Files modified:** `app/(app)/hcps/page.tsx`, `components/hcp/NpiLookupForm.tsx`
- **Verification:** `npm run build` exits 0; all navigation links render correctly
- **Committed in:** `e2c11d2` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 x Rule 1 — bugs found during build verification)
**Impact on plan:** Both fixes required for build to pass. No scope creep. All planned functionality delivered as specified.

## Issues Encountered
- Build TypeScript check revealed two incompatibilities in code from the plan spec (Prisma type and Button asChild) — both fixed inline per Rule 1 without scope change.

## User Setup Required
None — no new external service configuration required beyond Plan 01 setup (Clerk + Neon already configured).

## Known Stubs
- `app/(app)/hcps/[id]` — HCP profile page not yet created; links from HcpTable and NpiLookupForm ("View Profile") will 404 until Plan 03 implements the profile page. This is intentional — Plan 03 is the next wave.

## Threat Flags
No new threat surface beyond the plan's threat model. All T-02-xx mitigations implemented:
- T-02-01: auth() check in /api/nppes returns 401 for unauth
- T-02-02: addHcp role check throws Forbidden for finance users
- T-02-04: validateNpi() enforces /^\d{10}$/ before NPPES URL construction
- T-02-06: auth() check in searchHcps returns 401 for unauth

## TDD Gate Compliance

RED gate commit: `4d20845` — `test(01-02): add failing tests for NPPES validateNpi and mapNppesResult`
GREEN gate commit: `e7bccec` — `feat(01-02): NPPES client, proxy route, and addHcp Server Action`
Gate sequence: PASSED

## Next Phase Readiness
- Plan 03 (hcp-profile) can build immediately on this: HCP records are in DB, /hcps/[id] route is the only missing piece
- HcpStatusBadge and DebarmentBadge are ready for reuse on the profile page
- searchHcps and HcpSearchResult type are available for any server component needing HCP lists

---
*Phase: 01-auth-hcp-management*
*Completed: 2026-05-08*
