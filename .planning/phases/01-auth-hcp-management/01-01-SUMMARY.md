---
phase: 01-auth-hcp-management
plan: 01
subsystem: auth
tags: [nextjs, clerk, prisma, postgresql, neon, shadcn, tailwind, typescript, rbac, middleware]

# Dependency graph
requires: []
provides:
  - Next.js 15 App Router project with TypeScript strict mode and Tailwind CSS v4 + shadcn/ui (neutral)
  - Clerk authentication with email+password (no social login, no self-signup)
  - Role-gated Clerk middleware protecting all routes; unauthenticated and wrong-role redirects
  - lib/auth.ts with getEffectiveRoles(), canAccessRoute(), assertRole() helpers and AppRole type
  - All 7 Phase 1 Prisma tables pushed to Neon PostgreSQL (Hcp, HcpStatusHistory, DebarmentCheck, DebarmentDetermination, OigLeieRecord, SamGovRecord, UserGrant)
  - App shell with role-filtered Sidebar and Header; Business/Compliance see HCP nav, Finance sees Dashboard only
  - UserGrant DB expansion (D-04b) read server-side in app layout and applied to nav rendering
  - Seed fixture data for OigLeieRecord and SamGovRecord (dummy test data)
  - 9 passing unit tests for getEffectiveRoles and canAccessRoute
affects:
  - 01-auth-hcp-management/hcp-directory
  - 01-auth-hcp-management/hcp-profile
  - 01-auth-hcp-management/hcp-status
  - all future phases (auth foundation)

# Tech tracking
tech-stack:
  added:
    - Next.js 15 (App Router)
    - TypeScript 5 (strict)
    - Tailwind CSS v4
    - shadcn/ui (neutral style) — button, card, input, select, textarea, table, badge, pagination, sonner
    - Clerk (nextjs) — RBAC via publicMetadata.role
    - Prisma v5 + @prisma/client
    - PostgreSQL 16 on Neon (DATABASE_URL pooled + DIRECT_URL for migrations)
    - lucide-react (icons)
    - jest + ts-jest (unit testing)
    - ts-node (seed script runner)
  patterns:
    - Clerk middleware-first auth gate — every route protected at middleware layer; public routes whitelisted with createRouteMatcher
    - Role expansion pattern — primary role from Clerk publicMetadata, grants from UserGrant DB table, union computed via getEffectiveRoles()
    - Middleware enforces primary role only (no DB access at edge); Server Components compute full effective roles including grants
    - Nav items completely absent (not disabled) for unauthorized roles — no greyed-out items per UI-SPEC
    - PrismaClient singleton via globalThis for dev hot-reload safety
    - Audit-safe string storage — actor name/role stored as strings at time of action, not FK only

key-files:
  created:
    - middleware.ts — Clerk middleware with isPublicRoute, unauthenticated redirect, canAccessRoute role gate
    - lib/auth.ts — AppRole type, ROUTE_PERMISSIONS, getEffectiveRoles(), canAccessRoute(), assertRole()
    - lib/auth.test.ts — 9 unit tests (4 for getEffectiveRoles, 5 for canAccessRoute)
    - lib/prisma.ts — PrismaClient singleton
    - prisma/schema.prisma — Full Phase 1 schema (7 models, 3 enums)
    - prisma/seed.ts — OIG LEIE + SAM.gov fixture records
    - app/layout.tsx — Root layout with ClerkProvider
    - app/(auth)/sign-in/[[...sign-in]]/page.tsx — Clerk SignIn (no social buttons, no sign-up)
    - app/(app)/layout.tsx — Authenticated shell loading UserGrant + computing effective roles
    - app/(app)/hcps/page.tsx — HCP Directory placeholder
    - app/(app)/dashboard/page.tsx — Finance Dashboard placeholder
    - components/shell/Sidebar.tsx — Role-filtered nav with 3 items (HCP Directory, Add HCP, Dashboard)
    - components/shell/Header.tsx — User name + Clerk UserButton
    - jest.config.ts — ts-jest preset, node environment, @/* alias
    - next.config.ts — img.clerk.com remotePattern
    - .env.example — DATABASE_URL, DIRECT_URL, CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_WEBHOOK_SECRET
  modified:
    - package.json — added test script, prisma seed script, ts-node devDependency

key-decisions:
  - "Role stored in Clerk publicMetadata (server-writable only) — users cannot self-elevate via frontend API"
  - "UserGrant DB expansion (D-04b) read in Server Components, not middleware — middleware has no DB access at edge; conservative primary-role check at middleware, full effective-role check in components"
  - "Nav items completely absent for unauthorized roles (not greyed/disabled) — follows UI-SPEC Screen 2 spec"
  - "Neon requires both DATABASE_URL (pooled) and DIRECT_URL (direct) for Prisma; both in .env.example"
  - "OIG LEIE and SAM.gov use local pre-seeded reference tables (D-11b) — no live API or CSV upload in v1"

patterns-established:
  - "Pattern 1: Role gate — always derive effective roles via getEffectiveRoles() with both Clerk role and DB grants"
  - "Pattern 2: Middleware-first — auth and primary-role check in middleware.ts; no route-level auth guards needed in page components"
  - "Pattern 3: String-stored actors — all DB records store actorName/actorClerkId as strings at write time (no FK-only references)"
  - "Pattern 4: PrismaClient singleton — always import from lib/prisma.ts, never instantiate PrismaClient directly"

requirements-completed:
  - AUTH-01

# Metrics
duration: 60min
completed: 2026-05-08
---

# Phase 01 Plan 01: Skeleton Summary

**Next.js 15 + Clerk RBAC skeleton with role-gated middleware, 7-table Neon schema, and role-filtered app shell**

## Performance

- **Duration:** ~60 min (across two sessions)
- **Started:** 2026-05-07T17:37:14+05:00
- **Completed:** 2026-05-08T10:38:56+05:00
- **Tasks:** 3 (Task 1: scaffold, Task 2: schema push, Task 3: middleware + shell — plus TDD RED commit)
- **Files modified:** 20+

## Accomplishments
- Next.js 15 project fully scaffolded with Clerk, Prisma, shadcn/ui, and TypeScript strict mode
- All 7 Phase 1 Prisma tables created in Neon PostgreSQL via prisma db push; seed fixtures inserted for OIG LEIE and SAM.gov
- Role-gated middleware redirects unauthenticated users to /sign-in and wrong-role users to their default route; 9 unit tests pass for getEffectiveRoles() and canAccessRoute()
- App shell renders role-appropriate navigation: Business/Compliance see HCP Directory + Add HCP; Finance sees only Dashboard
- UserGrant DB expansion (D-04b) wired into app layout server component — Compliance users can be individually elevated to act as Business/Finance

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 15 + Clerk + Prisma + shadcn/ui** - `0e7d0be` (feat)
2. **Task 2: Define Phase 1 Prisma schema and push to Neon** - `3e0328e` (feat)
3. **Task 3 RED: Add failing tests for getEffectiveRoles and canAccessRoute** - `64d66af` (test)
4. **Task 3 GREEN: Implement role-gated middleware and app shell** - `7764be7` (feat)

## Files Created/Modified
- `middleware.ts` — Clerk middleware with isPublicRoute, unauthenticated redirect, canAccessRoute role gate
- `lib/auth.ts` — AppRole type, ROUTE_PERMISSIONS map, getEffectiveRoles(), canAccessRoute(), assertRole()
- `lib/auth.test.ts` — 9 unit tests; all passing GREEN
- `lib/prisma.ts` — PrismaClient singleton (globalThis pattern)
- `prisma/schema.prisma` — Full Phase 1 schema: Hcp, HcpStatusHistory, DebarmentCheck, DebarmentDetermination, OigLeieRecord, SamGovRecord, UserGrant + 3 enums
- `prisma/seed.ts` — OIG LEIE (2 records) + SAM.gov (1 record) fixture data
- `app/layout.tsx` — Root layout with ClerkProvider
- `app/(auth)/sign-in/[[...sign-in]]/page.tsx` — Clerk SignIn component (no social buttons, no sign-up link)
- `app/(app)/layout.tsx` — Authenticated shell: loads UserGrant from DB, computes effective roles, renders Sidebar + Header
- `app/(app)/hcps/page.tsx` — HCP Directory placeholder (full impl in Plan 02)
- `app/(app)/dashboard/page.tsx` — Finance Dashboard placeholder
- `components/shell/Sidebar.tsx` — Role-filtered nav; items fully absent (not disabled) for unauthorized roles
- `components/shell/Header.tsx` — User full name + Clerk UserButton (afterSignOutUrl=/sign-in)
- `jest.config.ts` — ts-jest preset with @/* alias
- `next.config.ts` — img.clerk.com remotePattern
- `.env.example` — All required env vars with placeholders

## Decisions Made
- Role claim lives in Clerk `publicMetadata` (server-writable only) — users cannot self-elevate from the browser
- Middleware enforces primary role only (no DB at edge); full effective-role union (primary + grants) computed in Server Components
- Nav items are completely absent for unauthorized roles — not greyed or disabled — per UI-SPEC Screen 2
- Neon requires both `DATABASE_URL` (pooled) and `DIRECT_URL` (direct connection) for Prisma; both in .env.example
- OIG LEIE and SAM.gov use pre-seeded local reference tables for v1 (D-11b); schemas match real-world CSV field structure

## Deviations from Plan

None - plan executed exactly as written. TDD cycle followed correctly: RED commit (`64d66af`) before GREEN implementation commit (`7764be7`).

## Issues Encountered
None.

## User Setup Required
External services require manual configuration before the app can run:

1. **Clerk** — Create a Clerk application, set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env.local`
2. **Neon PostgreSQL** — Create a database, set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) in `.env.local`; run `npx prisma db push` to create tables; run `npx prisma db seed` for fixture data
3. **Clerk user roles** — Set `publicMetadata.role` to `"business"`, `"compliance"`, or `"finance"` for each user via Clerk Dashboard

## Known Stubs
- `app/(app)/hcps/page.tsx` — Placeholder heading only; full HCP directory implemented in Plan 02
- `app/(app)/dashboard/page.tsx` — Placeholder text "Engagement approvals will appear here."; full Finance dashboard is out of Phase 1 scope

## Threat Flags

No new threat surface beyond what is in the plan's threat model. All STRIDE mitigations from T-01-01 through T-01-06 are implemented:
- Clerk-managed HttpOnly session cookies (T-01-01)
- Role in publicMetadata (server-writable only) — not mutable by client API (T-01-02)
- UserGrant read server-side only; no client self-grant path (T-01-03)
- DATABASE_URL in env var, never committed; .env.example has placeholders only (T-01-04)
- canAccessRoute redirects Finance from /hcps to /dashboard (T-01-06)

## Next Phase Readiness
- Auth foundation complete; Plan 02 (HCP Directory) can build on this skeleton immediately
- Sidebar nav item for "HCP Directory" is already wired; Plan 02 just needs to replace the placeholder page
- All 7 Prisma models available to Plan 02-04 — no schema changes needed to start HCP management
- Concern: Clerk user provisioning (no open signup, admin-only) needs to be verified before demo — add at least one test user with each role in Clerk Dashboard

## TDD Gate Compliance

RED gate commit: `64d66af` — `test(01-01): add failing tests for getEffectiveRoles and canAccessRoute`
GREEN gate commit: `7764be7` — `feat(01-01): implement role-gated middleware and app shell`
Gate sequence: PASSED

---
*Phase: 01-auth-hcp-management*
*Completed: 2026-05-08*
