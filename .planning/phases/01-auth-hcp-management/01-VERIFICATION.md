---
phase: 01-auth-hcp-management
verified: 2026-05-08T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Sign in as Finance user, manually navigate to /hcps — confirm redirect to /dashboard"
    expected: "Middleware redirects Finance user to /dashboard with no HCP content visible"
    why_human: "Cannot run middleware in test environment; requires live Clerk session"
  - test: "Sign in as Business user, manually navigate to /dashboard — confirm redirect to /hcps"
    expected: "Business user redirected to /hcps; Dashboard content never renders"
    why_human: "Requires live Clerk session to verify middleware role redirect logic"
  - test: "Compliance user runs debarment check on an HCP with NPI 1234567890 (seeded in OIG LEIE fixture)"
    expected: "OIG LEIE row shows 'Match Found' badge; 'View match details' expands accordion; 'Record Determination' form appears"
    why_human: "Requires running dev server and connected Neon database with seed data"
  - test: "Compliance user sets HCP status to 'Do Not Engage' — verify Select and Textarea borders turn red"
    expected: "Select border turns destructive red; Textarea border turns destructive red; label changes to 'Reason for Do-Not-Engage designation (required)'"
    why_human: "Visual UI behavior; cannot verify with grep"
  - test: "Business user views HCP profile — confirm no 'Set HCP Status' panel and no 'Run Debarment Check' button"
    expected: "Right sidebar shows only 'Quick Facts' card; Debarment section shows check results without any Run button"
    why_human: "Role-gated rendering depends on live Clerk session"
---

# Phase 1: Auth + HCP Management Verification Report

**Phase Goal:** Users can log in with one of three roles, and compliance officers can onboard and manage HCPs with NPI verification and manual debarment checks.
**Verified:** 2026-05-08T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Scope Note: AUD-01 and AUD-02

The task description listed AUD-01 and AUD-02 as Phase 1 requirement IDs. Both are v2 requirements per `.planning/REQUIREMENTS.md` (section "v2 Requirements > Audit & Governance") and are explicitly deferred to v2 in `.planning/phases/01-auth-hcp-management/01-CONTEXT.md` (Deferred section: "Audit log (AUD-01) — deferred to v2"). AUD-02 does not appear in REQUIREMENTS.md at all. These IDs were incorrectly listed — Phase 1 covers only AUTH-01, HCP-01, HCP-02, HCP-03, HCP-04.

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Business, Compliance, and Finance users can each log in and see only their role-permitted routes; cross-role access is blocked | VERIFIED | `middleware.ts` uses `clerkMiddleware` with `canAccessRoute()`; `ROUTE_PERMISSIONS` in `lib/auth.ts` covers `/hcps` (business+compliance), `/hcps/new` (business+compliance), `/dashboard` (finance). CR-04 finding in review is a false alarm — `/dashboard` IS present at line 6 of `lib/auth.ts`. |
| 2 | A compliance officer can look up an HCP by NPI and see canonical name, credentials, NUCC specialty, primary state, and HCO affiliation pulled from NPPES | VERIFIED | `lib/nppes.ts:fetchNppesHcp()` calls CMS NPPES API; `app/api/nppes/route.ts` proxies it with auth check; `NpiLookupForm.tsx` shows result card with all 5 canonical fields; `actions/hcp.ts:addHcp()` persists to DB. Full wiring confirmed. |
| 3 | A compliance officer can manually trigger a debarment check against OIG LEIE and SAM.gov, view the results, and record a determination with a written rationale | VERIFIED | `lib/debarment.ts:runDebarmentCheck()` queries `prisma.oigLeieRecord` and `prisma.samGovRecord` (local tables, no live API). `actions/debarment.ts:runCheck()` records `DebarmentCheck` and updates `Hcp.debarmentStatus` in `$transaction`. `saveDetermination()` records outcome + rationale (min 20 chars validated server-side). `DebarmentCheckPanel.tsx` wires all three actions. |
| 4 | A compliance officer can set an HCP's status (active / inactive / suspended / do-not-engage) with a mandatory reason; full status history visible on profile | VERIFIED | `actions/hcp.ts:setHcpStatus()` validates reason length (min 10) server-side, creates `HcpStatusHistory` and updates `Hcp.status` atomically via `$transaction`. `HcpStatusPanel.tsx` is wired in profile page for compliance-only. `StatusHistoryTimeline.tsx` renders all history entries. |
| 5 | All 7 Prisma tables exist and the Prisma client is generated | VERIFIED | `prisma/schema.prisma` defines: Hcp, HcpStatusHistory, DebarmentCheck, DebarmentDetermination, OigLeieRecord, SamGovRecord, UserGrant. `.env.local` has Neon `DATABASE_URL` and `DIRECT_URL`. Prisma client generated in `node_modules/.prisma/client/`. |

**Score:** 5/5 truths verified (automated evidence)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | All 7 Phase 1 models | VERIFIED | 7 models present with correct fields and relations |
| `middleware.ts` | Role-gated routing via Clerk | VERIFIED | `clerkMiddleware`, `canAccessRoute`, unauthenticated redirect to `/sign-in` |
| `lib/auth.ts` | `getEffectiveRoles()`, `assertRole()`, `canAccessRoute()` | VERIFIED | All 3 functions exported; ROUTE_PERMISSIONS correct |
| `app/(app)/layout.tsx` | App shell with Sidebar + Header; UserGrant expansion | VERIFIED | Reads `prisma.userGrant`, calls `getEffectiveRoles`, passes to `Sidebar` |
| `app/(auth)/sign-in/[[...sign-in]]/page.tsx` | Clerk SignIn embedded | VERIFIED | `SignIn` from `@clerk/nextjs` rendered |
| `lib/nppes.ts` | `fetchNppesHcp()`, `mapNppesResult()`, `validateNpi()` | VERIFIED | All 3 exported; maps NPPES response to `NppesHcp` type |
| `app/api/nppes/route.ts` | GET proxy with auth check | VERIFIED | `auth()` check returns 401 for unauthenticated; delegates to `fetchNppesHcp` |
| `actions/hcp.ts` | `addHcp()`, `searchHcps()`, `setHcpStatus()` | VERIFIED | All 3 exported; `"use server"` directive; real DB queries |
| `app/(app)/hcps/page.tsx` | HCP Directory with filterable table | VERIFIED | `searchHcps()` called server-side; real `HcpTable` component with pagination |
| `app/(app)/hcps/new/page.tsx` | NPI Lookup / Add HCP flow | VERIFIED | Renders `NpiLookupForm`; full NPPES lookup → add → redirect to profile |
| `app/(app)/hcps/[id]/page.tsx` | Full HCP profile, two-column layout | VERIFIED | Fetches HCP with `statusHistory` + `debarmentChecks[0].determination`; passes `isCompliance` prop; `HcpStatusPanel` replaces placeholder |
| `lib/debarment.ts` | `runDebarmentCheck()`, `matchOigRecord()`, `matchSamRecord()` | VERIFIED | Queries local OIG LEIE and SAM.gov tables; no live API calls |
| `actions/debarment.ts` | `runCheck()`, `saveDetermination()` | VERIFIED | Compliance-only role guard; atomic transaction for check; upsert for determination |
| `components/hcp/DebarmentCheckPanel.tsx` | Full debarment check UI | VERIFIED | OIG/SAM result rows; expandable match details; determination form |
| `components/hcp/HcpStatusPanel.tsx` | Set HCP Status panel | VERIFIED | 4 status options; mandatory reason; do-not-engage destructive treatment; same-status tooltip |
| `components/hcp/StatusHistoryTimeline.tsx` | Status history timeline | VERIFIED | Ordered list with status badges; empty state |
| `components/shell/Sidebar.tsx` | Role-filtered nav items | VERIFIED | `NAV_ITEMS` filtered by `effectiveRoles`; Business/Compliance see HCP items; Finance sees Dashboard |
| `app/api/hcps/exists/route.ts` | NPI existence check | VERIFIED | Returns `{ exists: boolean, id: string | null }` with auth check |
| `lib/hcp-validation.ts` | `validateSetStatusParams()` pure helper | VERIFIED | Extracted from Server Action for testability |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `middleware.ts` | `lib/auth.ts` | `canAccessRoute()` called with primary role from session claims | WIRED | Line 32: `canAccessRoute({ effectiveRoles: primaryRoles, route: pathname })` |
| `components/shell/Sidebar.tsx` | `lib/auth.ts` | `effectiveRoles` prop from AppLayout; `ROLE_LABELS` imported | WIRED | Role-filtered `visibleItems` computed from `effectiveRoles.includes(r)` |
| `app/(app)/hcps/new/page.tsx` | `app/api/nppes/route.ts` | `NpiLookupForm` fetches `/api/nppes?npi=` | WIRED | `NpiLookupForm.tsx:39` |
| `app/(app)/hcps/new/page.tsx` | `actions/hcp.ts` | `addHcp()` called on "Add to Directory" click | WIRED | `NpiLookupForm.tsx:71` |
| `app/(app)/hcps/page.tsx` | `actions/hcp.ts` | `searchHcps()` called server-side | WIRED | `hcps/page.tsx:18` |
| `components/hcp/DebarmentCheckPanel.tsx` | `actions/debarment.ts` | `runCheck()` on button click; `saveDetermination()` on form submit | WIRED | Lines 17, 676, 683 |
| `lib/debarment.ts` | `prisma.oigLeieRecord` + `prisma.samGovRecord` | Local DB queries by NPI and name | WIRED | Lines 78-108 in `lib/debarment.ts` |
| `components/hcp/HcpStatusPanel.tsx` | `actions/hcp.ts` | `setHcpStatus()` on "Set Status" click | WIRED | `HcpStatusPanel.tsx:71` |
| `app/(app)/hcps/[id]/page.tsx` | `components/hcp/HcpStatusPanel.tsx` | Props `hcpId` and `currentStatus` from server-fetched Hcp | WIRED | Lines 197-200 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `app/(app)/hcps/page.tsx` | `hcps`, `total` | `searchHcps()` → `prisma.hcp.findMany()` | Yes — real DB query with filters | FLOWING |
| `app/(app)/hcps/[id]/page.tsx` | `hcp` | `prisma.hcp.findUnique()` with `include: { statusHistory, debarmentChecks }` | Yes — full HCP data with relations | FLOWING |
| `components/hcp/HcpTable.tsx` | `hcps` prop | Passed from `HcpsPage` server component from DB query | Yes — server-fetched | FLOWING |
| `components/hcp/DebarmentCheckPanel.tsx` | `initialCheck` prop | Passed from `HcpProfilePage` — `hcp.debarmentChecks[0]` from DB | Yes — DB row or null | FLOWING |
| `lib/debarment.ts:runDebarmentCheck()` | `oigCandidates`, `samCandidates` | `prisma.oigLeieRecord.findMany()`, `prisma.samGovRecord.findMany()` | Yes — local seeded tables | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All unit tests pass | `npx jest --passWithNoTests` | 28 passed (auth:9, nppes:7, debarment:8, hcp-validation:4) | PASS |
| TypeScript compilation | `npx tsc --noEmit` | No output (exit 0) | PASS |
| Prisma client generated | `ls node_modules/.prisma/client/` | `client.d.ts`, `client.js`, `default.d.ts`, `edge.d.ts` present | PASS |
| middleware.ts exports default | `grep "^export default" middleware.ts` | Confirms clerkMiddleware default export | PASS |
| `actions/hcp.ts` has "use server" | `head -1 actions/hcp.ts` | `"use server"` at line 1 | PASS |
| `actions/debarment.ts` has "use server" | `head -1 actions/debarment.ts` | `"use server"` at line 1 | PASS |
| Placeholder removed from profile page | `grep "implemented in next plan" app/(app)/hcps/[id]/page.tsx` | No output (placeholder removed) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | Plan 01 | Role-based access — 3 roles; all routes and write actions validated against authenticated user's role | SATISFIED | `middleware.ts` + `lib/auth.ts` + `ROUTE_PERMISSIONS`; Server Actions check primary role before DB writes |
| HCP-01 | Plan 02 | NPI lookup via CMS NPPES API; validates NPI exists; pulls canonical name, specialty, credentials | SATISFIED | `lib/nppes.ts:fetchNppesHcp()` calls live NPPES API; `validateNpi()` enforces format |
| HCP-02 | Plans 02+03 | HCP profile with name, credentials, NUCC specialty code, primary state, HCO affiliation | SATISFIED | `app/(app)/hcps/[id]/page.tsx` renders all 5 required fields from DB |
| HCP-03 | Plan 03 | Compliance officer manually triggers debarment check vs OIG LEIE + SAM.gov; views results; records determination with rationale | SATISFIED | `runCheck()` queries local tables; result recorded in `DebarmentCheck`; `saveDetermination()` requires min-20-char rationale |
| HCP-04 | Plan 04 | Compliance officer sets HCP status (4 values) with mandatory reason; status history visible on profile | SATISFIED | `setHcpStatus()` enforces min-10-char reason, atomic transaction; `StatusHistoryTimeline` renders history |
| AUD-01 | N/A | Append-only audit log (v2 requirement) | OUT OF SCOPE | Explicitly deferred to v2 in REQUIREMENTS.md and CONTEXT.md; not a Phase 1 deliverable |
| AUD-02 | N/A | Not in REQUIREMENTS.md | NOT APPLICABLE | This ID does not exist in REQUIREMENTS.md |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `prisma/schema.prisma` | 5-7 | Datasource block missing explicit `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")` as required by plan | Warning | Schema deviated from plan spec; DB connection works via `.env.local` but schema is incomplete per spec |
| `actions/debarment.ts` | 98 | `prisma.debarmentDetermination.upsert` — determination is mutable (CR-06) | Warning | Compliance officer can silently overwrite a prior determination; no history of change preserved. Note: AUD-01 append-only audit is a v2 requirement — this is a quality warning, not a Phase 1 blocker |
| `prisma/schema.prisma` | 40-52 | `HcpStatusHistory` lacks `fromStatus` field (CR-05) | Warning | Status change entries are not self-contained; prior state must be reconstructed from ordering. Note: AUD-01 self-contained audit entries is v2 scope |
| `actions/debarment.ts` | 28-29 | `runCheck` lookup `prisma.hcp.findUnique({ where: { id: hcpId } })` has no tenant scope (CR-02) | Warning | IDOR risk in multi-tenant scenario; v1 is single-tenant so no immediate data isolation breach |
| `actions/debarment.ts` | 96-113 | `saveDetermination` does not verify `checkId` belongs to `hcpId` (CR-03) | Warning | Cross-ownership not validated; minimal risk in single-tenant v1 |
| `app/api/hcps/exists/route.ts` | 9-10 | No NPI format validation before Prisma query (CR-09) | Info | No SQL injection risk (parameterized), but allows malformed inputs |
| `components/hcp/NpiLookupForm.tsx` | 71 | `addHcp(lookupState.hcp)` — client-provided NPPES data passed to Server Action without re-validation (WR-03) | Warning | Malicious user could manipulate NUCC codes, names, affiliations in browser state before addHcp call |
| `lib/auth.ts` | 58-59 | `return true` fallback in `canAccessRoute` — any future unregistered route is world-accessible (WR-08) | Warning | Latent defect for Phase 2+ routes; not a blocker for current Phase 1 routes which are all explicitly listed |
| `prisma/schema.prisma` | 49, 69, 85 | `onDelete: Cascade` on compliance records (IN-01) | Info | Deleting an HCP would destroy all status/debarment history |
| `components/hcp/HcpTable.tsx` | 65 | `window.location.href` for row click instead of `router.push` (IN-02) | Info | Full page reload; UX degradation only |

### Human Verification Required

#### 1. Finance User Route Enforcement

**Test:** Sign in to the app as a user with `publicMetadata.role = "finance"` (set via Clerk Dashboard). Manually navigate to `http://localhost:3000/hcps`.
**Expected:** Middleware immediately redirects to `/dashboard`. The HCP Directory page never renders. No HCP data is visible.
**Why human:** Requires a live Clerk session with `role: "finance"` in publicMetadata. Cannot test middleware redirect behavior with grep alone.

#### 2. Business User Dashboard Blocked

**Test:** Sign in as `role: "business"` user. Manually navigate to `http://localhost:3000/dashboard`.
**Expected:** Middleware redirects to `/hcps`. The Dashboard page never renders.
**Why human:** Requires live Clerk session. The logic exists in `canAccessRoute` (verified via code) but end-to-end behavior needs confirmation.

#### 3. Debarment Check End-to-End

**Test:** With the dev server running and Neon connected, add an HCP with NPI `1234567890` (matches OIG LEIE seed fixture). As Compliance user, open the HCP profile and click "Run Debarment Check".
**Expected:** OIG LEIE row shows "Match Found" badge. "View match details" accordion expands with exclusion data. "Record Determination" form appears below. Enter outcome "Cleared" and 20+ char rationale, click "Save Determination". Determination block appears with outcome badge and actor name.
**Why human:** Requires running dev server, connected Neon DB with seed data, and live Clerk Compliance session.

#### 4. Do-Not-Engage Visual Treatment

**Test:** Open an HCP profile as Compliance user. In the "Set HCP Status" panel, select "Do Not Engage" from the dropdown.
**Expected:** Select trigger border turns red (`hsl(0_72%_51%)`). Textarea border turns red. Reason label changes to "Reason for Do-Not-Engage designation (required)".
**Why human:** Visual/CSS behavior; cannot verify programmatically.

#### 5. Business User Profile Read-Only

**Test:** Sign in as Business user. Navigate to `/hcps/[id]` for any HCP.
**Expected:** Profile renders with NPPES data, debarment section (showing results without "Run Debarment Check" button), and status history. Right sidebar shows only "Quick Facts" — no "Set HCP Status" panel.
**Why human:** Role-conditional rendering depends on `isCompliance` prop from server-side Clerk session.

---

## Gaps Summary

No functional gaps were found against the 5 Phase 1 ROADMAP success criteria. All artifacts exist, are substantive, are wired, and data flows to real DB queries.

**Quality warnings not blocking Phase 1 goal:**

1. **Mutable determinations (CR-06):** `saveDetermination` uses `upsert` — a compliance officer can silently overwrite a prior determination. The append-only audit requirement (AUD-01) is explicitly a v2 requirement and out of Phase 1 scope. This is a known quality gap to address before v2 audit feature development.

2. **Missing `fromStatus` in `HcpStatusHistory` (CR-05):** Status change entries don't record the prior state inline. AUD-01 self-contained audit entries are v2 scope. Timeline still renders correctly from sequential ordering.

3. **Schema missing explicit `url` / `directUrl` in datasource:** Prisma resolves these from `.env.local` at runtime; client generates successfully. But the schema deviates from the plan specification and won't be portable without the `.env.local` file.

4. **`return true` fallback in `canAccessRoute` (WR-08):** All current Phase 1 routes are explicitly listed in `ROUTE_PERMISSIONS`. Future phases adding routes will need to add them to the map — this is a maintainability concern for Phase 2.

5. **WR-01 (UserGrant expansion not used in Server Actions):** Server Actions check `user.publicMetadata.role` directly instead of calling `getEffectiveRoles()`. A UserGrant-expanded Compliance user (primary role: business, granted: compliance) cannot run debarment checks or set status via Server Actions. This is a behavioral gap vs. the D-04b design decision — expansion is only applied to navigation/rendering, not write authorization.

---

_Verified: 2026-05-08T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
