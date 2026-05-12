---
phase: 02-fmv-engagement
verified: 2026-05-12T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Upload an Excel/CSV rate card with a mix of valid and invalid NUCC codes and confirm the preview renders per-row badges correctly; confirm the Activate button is disabled until all rows are valid"
    expected: "Green 'valid' badge for recognized codes, red 'unrecognized' badge for unknown codes; Activate button disabled with 'Fix unrecognized rows before activating' message when any row is unrecognized; Activate enabled and working when all rows are valid"
    why_human: "Visual badge rendering and button disable-state behavior cannot be verified programmatically without a running browser"
  - test: "Create an engagement as a Business user, submit it, log in as a Compliance/Finance user, navigate to /engagements/queue, approve the engagement, then log back in as the Business user and complete it"
    expected: "Status timeline shows Draft -> Submitted -> Approved -> Completed; each step reflected in the engagement detail page's Status History card; ActionPanel shows correct role+status-gated buttons at each stage"
    why_human: "Multi-role workflow across the full state machine requires a running app with multiple authenticated sessions"
  - test: "As a Business user, attempt direct URL access to /engagements/[id] for another user's engagement"
    expected: "Receives 404 Next.js not-found page, not a 403 forbidden page"
    why_human: "Requires two authenticated sessions; HTTP response code distinction between 404 and 403 is visible only in browser dev tools or network tab"
  - test: "Navigate to /engagements/new, select an HCP, select an engagement type, and verify the FMV Rate Reference panel updates"
    expected: "Panel shows loading skeleton while fetching, then displays the applicable rate for the HCP's specialty + state + engagement type (or 'No FMV rate on file' if no matching rate; 'No active FMV rate card' if no active card); panel updates when either HCP or engagement type changes"
    why_human: "Client-side fetch timing and visual state transitions (skeleton -> loaded) require browser verification"
  - test: "Reject a submitted engagement with a reason shorter than 10 characters, then with a valid reason"
    expected: "Short reason: Reject button remains disabled in ActionPanel (character counter shows insufficient length); valid reason: engagement transitions to Rejected, reason shown in amber callout on detail page"
    why_human: "ActionPanel character counter and disable logic requires browser verification"
---

# Phase 2: FMV + Engagement Verification Report

**Phase Goal:** Admins can upload and version FMV rate cards, and users can submit engagement requests that route to a single approver for approval or rejection.
**Verified:** 2026-05-12
**Status:** human_needed
**Re-verification:** No — initial verification

## Note on Phase Goal Wording

The verification request stated the phase goal as including "Every engagement must have an applicable FMV rate snapshotted at creation." This phrasing comes from CLAUDE.md's architecture section. The official ROADMAP.md Phase 2 Success Criteria (the contract used for verification) states: "the system **displays** the applicable FMV rate for the HCP — shown for reference, submission is not blocked." The snapshot requirement is REQUIREMENTS.md FMV-V2-02, explicitly deferred to v2. Verification is conducted against the ROADMAP success criteria, not the v2 deferred item. This is accounted for in SC-3 below.

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | An admin can upload an FMV rate card (Excel/CSV), see a parsed preview, and the system rejects any upload where specialty values cannot be matched to NUCC taxonomy codes | VERIFIED | `lib/fmv-parser.ts` exports `parseRateCardBuffer` + `validateNuccCodes`; `actions/fmv.ts parseRateCardAction` calls both; `hasErrors` returned when any `nuccValid=false`; `RateCardTable.tsx` renders per-row NUCC badge; Activate button `disabled={displayHasErrors}` in `FmvUploadWizard.tsx:299`; 19 parser+action tests GREEN |
| SC-2 | When a new rate card is activated it supersedes the prior version; a user can view all historical versions | VERIFIED | `activateRateCardAction` uses `prisma.$transaction`: `updateMany(status=active → superseded, effectiveTo=now)` then `updateMany(id=rateCardId, status=pending → active, effectiveFrom=now)`; `/fmv/page.tsx` queries `findMany orderBy version desc`; `/fmv/[id]/page.tsx` exists with `generateMetadata` and full rate table |
| SC-3 | At engagement creation, the system displays the applicable FMV rate by specialty + geography + engagement type — shown for reference, submission is not blocked | VERIFIED | `FmvRatePanel.tsx` fetches `/api/fmv/rate?hcpId=&type=` in `useEffect` on prop change; `aria-live="polite"`; disclaimer "Shown for reference only. Submission is not blocked." at line 114; `/api/fmv/rate/route.ts` calls `getFmvRate`; `getFmvRate` performs two sequential `fmvRate.findFirst` (state-first, then national fallback); `EngagementForm.tsx` passes `hcpId` and `engagementType` to `FmvRatePanel` |
| SC-4 | A user can submit an engagement request for any of the five engagement types (advisory board, speaker program, investigator/research, meal/TOV, training) | VERIFIED | `lib/engagement-validation.ts VALID_ENGAGEMENT_TYPES` = `["advisory_board","speaker_program","investigator_research","meal_tov","training"]`; `EngagementForm.tsx` renders all 5 as `<Select>` options; `createEngagementAction` validates against these types; 18 validation tests GREEN |
| SC-5 | Engagement moves through four stages: Draft → Submitted → Approved/Rejected → Completed; Compliance or Finance user can approve/reject; rejection requires a reason | VERIFIED | `actions/engagement.ts` has all 6 actions: create (draft), submit, approve (`assertRole(["compliance","finance"])`), reject (`validateRejectionReason` server-side before DB write), complete, delete; `VALID_TRANSITIONS` enforced via `validateStateTransition`; `updateMany where status=X` guards all transitions atomically; `rejectEngagementAction` calls `validateRejectionReason(reason)` at line 201 before DB write; 29 action tests GREEN |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | NuccTaxonomy, FmvRateCard, FmvRate, Engagement, EngagementStatusHistory models + 4 enums | VERIFIED | All 5 models present; `engagements Engagement[]` on Hcp model (line 34); `rateUsd Decimal @db.Decimal(10,2)` (line 259); `compensationUsd Decimal @db.Decimal(10,2)` in Engagement model |
| `prisma/seed.ts` | NuccTaxonomy fixture seed (25 codes) | VERIFIED | `nuccTaxonomy.createMany` at line 102; 25 fixture rows defined |
| `lib/fmv-parser.ts` | `parseRateCardBuffer` + `validateNuccCodes` pure functions | VERIFIED | Exports both functions; no "use server"; no Prisma/Clerk imports |
| `actions/fmv.ts` | `parseRateCardAction` + `activateRateCardAction` Server Actions | VERIFIED | "use server" line 1; `assertRole(["compliance"])` in both actions; `prisma.$transaction` in `activateRateCardAction`; `revalidatePath("/fmv")` after activation |
| `app/(app)/fmv/page.tsx` | Rate card version list (Server Component) | VERIFIED | `export const metadata`; `fmvRateCard.findMany orderBy version desc`; empty state "No rate cards uploaded"; "Upload Rate Card" button; `FmvActivateButton` for pending cards |
| `app/(app)/fmv/upload/page.tsx` + `FmvUploadWizard.tsx` | Upload wizard (Client Component, multi-step state machine) | VERIFIED | 6-state machine (`idle/parsing/preview/activating/done/error`); calls `parseRateCardAction` + `activateRateCardAction`; "Upload and Parse" at line 219; "Activate Rate Card" at line 309; disabled with "Fix unrecognized rows before activating" at line 314; `return null` at line 338 is unreachable exhaustiveness guard, not a stub |
| `components/fmv/RateCardTable.tsx` | Per-row NUCC validation badges | VERIFIED | `nuccValid` conditional badge rendering at lines 78-80; `NUCC_BADGE_CONFIG.valid` and `.unrecognized` |
| `lib/fmv-lookup.ts` | `getFmvRate` async function, injectable Prisma, state-first/national-fallback | VERIFIED | No "use server"; `prisma: PrismaClient` injected parameter; 3 `fmvRate.findFirst` calls: line 27 (active card), line 34 (state match), line 45 (national fallback) |
| `app/(app)/fmv/[id]/page.tsx` | Rate card detail page with filter bar (Server Component) | VERIFIED | `generateMetadata`; `notFound`; `Rate Card v{card.version}`; `FmvRateDetailClient` with full rate table and 3 filter controls |
| `app/api/fmv/rate/route.ts` | GET endpoint for FMV reference panel | VERIFIED | `export async function GET`; `getFmvRate` import; fetches HCP `nuccCode + primaryState` first; 401 auth guard |
| `app/api/hcps/search/route.ts` | GET endpoint for HCP search popover | VERIFIED | `export async function GET`; `q.length < 2` early return; `OR: [fullName contains, npi startsWith]`; `take: 8`; 401 auth guard |
| `lib/engagement-validation.ts` | 3 pure validators | VERIFIED | No "use server"; no Prisma/Clerk; exports `validateEngagementFields`, `validateRejectionReason`, `validateStateTransition`; exact error strings per plan |
| `actions/engagement.ts` | 6 Server Actions (create, submit, approve, reject, complete, delete) | VERIFIED | "use server" line 1; all 6 exported; `assertRole` before DB in every action; `prisma.$transaction` for all state transitions; `validateRejectionReason` called server-side in `rejectEngagementAction` |
| `app/(app)/engagements/page.tsx` | Engagement list page with role-based filtering | VERIFIED | `isBusinessOnly` check at line 63; `where.submittedByClerkId = userId` for Business users; `canCreate` suppresses "New Engagement" for Finance; `EngagementTable` rendered |
| `app/(app)/engagements/new/page.tsx` | New engagement form page wrapper | VERIFIED | "New Engagement" heading; `EngagementForm` imported and rendered |
| `components/engagement/EngagementForm.tsx` | Full form with HCP search, FMV panel, Save Draft + Submit | VERIFIED | `HcpSearchInput` import at line 17; `FmvRatePanel` import at line 18; `createEngagementAction` + `submitEngagementAction` imports; "Save Draft" button at line 273; "Submit for Approval" button at line 257 |
| `components/engagement/HcpSearchInput.tsx` | 300ms debounce, keyboard nav, aria attributes | VERIFIED | `debounceRef` + 300ms `setTimeout` at lines 29-49; `role="combobox"` line 109; `aria-expanded={isOpen}` line 110; `role="listbox"` line 123; fetches `/api/hcps/search` |
| `components/fmv/FmvRatePanel.tsx` | FMV rate reference panel, 3 states, aria-live | VERIFIED | `aria-live="polite"` at line 87; `Skeleton` import at line 5; "FMV Rate Reference" at line 89; disclaimer "Shown for reference only" at line 114; 5-state machine: initial/loading/loaded/no_rate/no_card |
| `app/(app)/engagements/[id]/page.tsx` | Engagement detail page with ownership guard, status history | VERIFIED | `notFound()` + `submittedByClerkId` ownership guard at line 70; `generateMetadata` at line 13; `statusHistory` as `<ol>` at line 167; rejection reason amber callout at lines 191-198; `ActionPanel` rendered |
| `app/(app)/engagements/queue/page.tsx` | Approval queue page | VERIFIED | `where: { status: "submitted" }` at line 42; "Approval Queue" heading at line 56; count chip with `aria-label` at line 64; "Queue is clear" empty state at line 77 |
| `components/engagement/ActionPanel.tsx` | Role+status conditional actions, AlertDialog for delete | VERIFIED | All 4 new actions imported (lines 22-25); `AlertDialog` imported (lines 11-19); `handleApprove`, `handleReject`, `handleComplete`, `handleDelete` all implemented with `useTransition` |
| `components/ui/skeleton.tsx` | shadcn Skeleton component | VERIFIED | File exists |
| `components/ui/alert-dialog.tsx` | shadcn AlertDialog component | VERIFIED | File exists |
| `next.config.ts` | `bodySizeLimit: '5mb'` | VERIFIED | Line 6 |
| `lib/auth.ts` | Phase 2 route permissions | VERIFIED | All 5 Phase 2 routes present: `/fmv`, `/fmv/upload`, `/engagements`, `/engagements/new`, `/engagements/queue` |
| `components/shell/Sidebar.tsx` | FMV + Engagement nav items | VERIFIED | `FileSpreadsheet`, `ClipboardList`, `Plus`, `CheckSquare` imported; hrefs `/fmv`, `/engagements`, `/engagements/new`, `/engagements/queue` |
| `xlsx` (SheetJS 0.20.3) | Installed from CDN, not stale npm registry | VERIFIED | `package.json`: `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/(app)/fmv/upload/FmvUploadWizard.tsx` | `actions/fmv.ts parseRateCardAction` | `import + startTransition` | WIRED | Import line 11; called at line 67 inside `startParseTransition` |
| `app/(app)/fmv/upload/FmvUploadWizard.tsx` | `actions/fmv.ts activateRateCardAction` | `import + startTransition` | WIRED | Import line 11; called at line 99 inside `startActivateTransition` |
| `actions/fmv.ts parseRateCardAction` | `lib/fmv-parser.ts parseRateCardBuffer` | direct import + call | WIRED | Import line 7; called at line 48 with `Buffer.from(arrayBuffer)` |
| `actions/fmv.ts activateRateCardAction` | `prisma.fmvRateCard + prisma.fmvRate` | `prisma.$transaction` | WIRED | `$transaction` at line 131; `updateMany` for active→superseded + pending→active |
| `app/api/fmv/rate/route.ts` | `lib/fmv-lookup.ts getFmvRate` | direct import + call | WIRED | Import line 4; called at line 24 with `nuccCode, primaryState, engagementType, prisma` |
| `lib/fmv-lookup.ts` | `prisma.fmvRate` | two sequential `findFirst` calls | WIRED | `fmvRate.findFirst` state match at line 34; national fallback at line 45 |
| `components/engagement/EngagementForm.tsx` | `actions/engagement.ts createEngagementAction` | `useTransition + startTransition` | WIRED | Import lines 20-21; called at lines 74 and 94 within `startTransition` |
| `components/engagement/HcpSearchInput.tsx` | `app/api/hcps/search/route.ts` | `fetch` with 300ms debounce | WIRED | `fetch('/api/hcps/search?q=...')` at line 41; debounce setTimeout 300ms at line 49 |
| `components/fmv/FmvRatePanel.tsx` | `app/api/fmv/rate/route.ts` | `fetch` in `useEffect` on `[hcpId, engagementType]` | WIRED | `fetch('/api/fmv/rate?hcpId=&type=')` at line 55; `useEffect` deps `[hcpId, engagementType]` |
| `app/(app)/engagements/page.tsx` | `prisma.engagement.findMany` | Business user `where submittedByClerkId=userId` | WIRED | `isBusinessOnly` check at line 63; `where.submittedByClerkId = userId` at line 71 |
| `components/engagement/ActionPanel.tsx` | `actions/engagement.ts approveEngagementAction` | `useTransition + startTransition` | WIRED | Import line 22; called in `handleApprove` at line 66 |
| `components/engagement/ActionPanel.tsx` | `actions/engagement.ts rejectEngagementAction` | `useTransition + startTransition` after client validation | WIRED | Import line 23; called in `handleReject` at line 80 |
| `app/(app)/engagements/[id]/page.tsx` | `ActionPanel` | conditional render based on roles + status | WIRED | `ActionPanel` rendered in right column with `engagementId`, `status`, `submittedByClerkId`, `currentUserClerkId`, `effectiveRoles` |
| `app/(app)/engagements/[id]/page.tsx` (Business user) | `notFound()` | `if (isBusinessRole && engagement.submittedByClerkId !== user.id)` | WIRED | Line 70: exact guard present |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `app/(app)/fmv/page.tsx` | `cards` (rate card list) | `prisma.fmvRateCard.findMany(orderBy: {version: "desc"})` | Yes — live DB query with pagination | FLOWING |
| `app/(app)/fmv/upload/FmvUploadWizard.tsx` | `uploadState.rows` (preview rows) | `parseRateCardAction` → `parseRateCardBuffer(buffer)` → SheetJS parse of uploaded file | Yes — real file bytes parsed server-side | FLOWING |
| `app/(app)/fmv/[id]/page.tsx` | `card.rates` (rate rows for version) | `prisma.fmvRateCard.findUnique({include: {rates: {orderBy: [{nuccCode:"asc"},{state:"asc"}]}}})` | Yes — live DB query | FLOWING |
| `components/fmv/FmvRatePanel.tsx` | `rate` state | `fetch('/api/fmv/rate?hcpId=&type=')` → `getFmvRate` → `prisma.fmvRate.findFirst` | Yes — sequential DB lookups against active card | FLOWING |
| `app/(app)/engagements/page.tsx` | `engagements` | `prisma.engagement.findMany` with role-based `where` clause | Yes — live DB query with role filter | FLOWING |
| `app/(app)/engagements/[id]/page.tsx` | `engagement` + `statusHistory` | `prisma.engagement.findUnique({include: {hcp, statusHistory: {orderBy: {createdAt: "desc"}}}})` | Yes — live DB query | FLOWING |
| `app/(app)/engagements/queue/page.tsx` | `engagements` (submitted queue) | `prisma.engagement.findMany({where: {status: "submitted"}, include: {hcp}})` | Yes — live DB query filtered to submitted only | FLOWING |
| `app/(app)/engagements/[id]/page.tsx` FMV Reference card | (none — static copy) | Hardcoded "Rate data displayed for reference only." | No — static placeholder | STATIC (intentional — FMV-V2-02 deferred) |

**Note on FMV Reference card static copy:** The engagement detail page shows a static FMV reference copy rather than a live rate lookup. This is intentional — per REQUIREMENTS.md FMV-V2-02 ("FMV rate is snapshotted onto the engagement record at creation time") is explicitly a v2 requirement. The v1 ROADMAP SC-3 only requires display at **creation time** (which is fulfilled by `FmvRatePanel` on the new engagement form), not on the detail page. The 02-05-SUMMARY.md explicitly documents this as a known stub with the FMV-V2-02 deferred reason.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 99 tests pass | `npx jest --no-coverage` | 9 suites, 99 passed, 0 failed, 0 todo | PASS |
| fmv-parser tests | `npx jest --testPathPatterns=fmv-parser --no-coverage` | 11 passed | PASS |
| fmv-lookup tests | `npx jest --testPathPatterns=fmv-lookup --no-coverage` | 5 passed | PASS |
| engagement-validation tests | `npx jest --testPathPatterns=engagement-validation --no-coverage` | 18 passed | PASS |
| fmv action tests | `npx jest --testPathPatterns="actions/fmv" --no-coverage` | 8 passed (part of 37-test run) | PASS |
| engagement action tests | `npx jest --testPathPatterns="actions/engagement" --no-coverage` | 29 passed (part of 37-test run) | PASS |
| lib/fmv-parser.ts no "use server" | `grep "use server" lib/fmv-parser.ts` | No match | PASS |
| lib/fmv-lookup.ts injectable Prisma | `grep "prisma: PrismaClient" lib/fmv-lookup.ts` | Line 22 | PASS |
| actions/engagement.ts rejectEngagementAction validates server-side | `grep "validateRejectionReason" actions/engagement.ts` | Line 201, called before DB write | PASS |
| Ownership guard 404 | `grep "isBusinessRole.*submittedByClerkId.*notFound" engagements/[id]/page.tsx` | Line 70 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FMV-01 | 02-01, 02-02 | Upload FMV rate card (Excel/CSV) with parsed preview; rejected if NUCC codes don't match | SATISFIED | `parseRateCardAction` parses + validates; `hasErrors` returned for unrecognized codes; Activate disabled when `hasErrors=true` |
| FMV-02 | 02-01, 02-02 | Validates specialty values against NUCC taxonomy before activation | SATISFIED | `nuccTaxonomy.findMany` called in `parseRateCardAction`; `validateNuccCodes` checks each row against taxonomy map; per-row `nuccValid` flag |
| FMV-03 | 02-02 | Rate cards versioned with effective date ranges; activating new version supersedes prior | SATISFIED | `activateRateCardAction` atomic `$transaction`: prior active card set to `superseded` + `effectiveTo=now`; new card set to `active` + `effectiveFrom=now`; `version` auto-incremented |
| FMV-04 | 02-03, 02-04 | Displays applicable FMV rate at engagement creation time (by specialty + geography + type); shown for reference, does not block submission | SATISFIED | `FmvRatePanel` → `/api/fmv/rate` → `getFmvRate` (state-first/national-fallback); "Shown for reference only. Submission is not blocked." disclaimer; `FmvRatePanel` wired into `EngagementForm` |
| FMV-05 | 02-03 | User can view all rate card versions | SATISFIED | `/fmv/page.tsx` lists all versions ordered by version desc; `/fmv/[id]/page.tsx` shows all rate rows for a specific version with filter controls |
| ENG-01 | 02-04 | User can submit engagement request for 5 engagement types | SATISFIED | All 5 types in `VALID_ENGAGEMENT_TYPES`; all 5 rendered as `<Select>` options in `EngagementForm`; `validateEngagementFields` enforces valid type server-side |
| ENG-02 | 02-04, 02-05 | Engagement status tracks four stages: Draft → Submitted → Approved/Rejected → Completed | SATISFIED | `VALID_TRANSITIONS` enforces state machine; `updateMany where status=X` guards each transition atomically; 6 Server Actions cover all transitions; `EngagementStatusHistory` created for each transition |
| ENG-03 | 02-04, 02-05 | Single approver (Compliance or Finance) reviews; approval or rejection with mandatory reason | SATISFIED | `approveEngagementAction` + `rejectEngagementAction` restricted to `["compliance","finance"]`; `validateRejectionReason` called server-side in `rejectEngagementAction` before DB write; `rejectionReason` stored on Engagement record; rejection reason callout rendered on detail page |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/(app)/fmv/upload/FmvUploadWizard.tsx` | 338 | `return null;` after exhaustive if-chain | Info | TypeScript exhaustiveness guard — all 6 states handled above it; unreachable at runtime; not a stub |
| `app/(app)/engagements/[id]/page.tsx` | 147-149 | Static "Rate data displayed for reference only." in FMV Reference card | Warning | Intentional v2 deferral (FMV-V2-02). The v1 FMV-04 requirement only requires display **at engagement creation**, not on the detail page. Documented in 02-05-SUMMARY.md Known Stubs. Not a blocker. |
| Various UI files | multiple | `placeholder="..."` on Input/Select/Textarea components | Info | HTML placeholder attributes for UX hint text — not data stubs |

---

### Human Verification Required

#### 1. NUCC Validation Badge Rendering in Upload Preview

**Test:** Upload an Excel (.xlsx) file with 2+ rows — one with a valid NUCC code (e.g., 207Q00000X) and one with an invalid code (e.g., INVALID999). Observe the Step 2 preview table.
**Expected:** Row with valid code shows green "valid" badge; row with invalid code shows red "unrecognized" badge; the "Activate Rate Card" button is disabled and shows "Fix unrecognized rows before activating" tooltip; if all rows are valid, the button becomes enabled.
**Why human:** Visual badge color rendering and button disabled-state tooltip behavior require browser inspection.

#### 2. Full Engagement Lifecycle Flow (Multi-Role)

**Test:** Create an engagement as a Business user (Save as Draft, then Submit); log in as Compliance/Finance, navigate to /engagements/queue, click Review, approve the engagement; log back in as the original Business user, navigate to the engagement detail, mark as Completed.
**Expected:** Correct status displayed at each step (Draft → Submitted → Approved → Completed); Status History card shows each transition with actor name and timestamp; ActionPanel shows appropriate buttons for each role+status combination.
**Why human:** Multi-role workflow across the full state machine requires authenticated sessions with two different roles.

#### 3. Business User 404 on Another User's Engagement

**Test:** As a Business user (User A), navigate directly to /engagements/[id] where [id] is an engagement created by a different Business user (User B).
**Expected:** Next.js 404 page is shown, not a 403 forbidden. No engagement data is visible.
**Why human:** Requires two separate authenticated Business user sessions; 404 vs 403 distinction is visible in browser or network tab.

#### 4. FMV Rate Reference Panel Behavior at Engagement Creation

**Test:** Navigate to /engagements/new. Select an HCP with a NUCC specialty that exists in the active rate card. Select a matching engagement type. Observe the FMV Rate Reference panel on the right.
**Expected:** Panel shows a loading skeleton briefly, then displays the rate for the HCP's specialty + primary state + engagement type (or "No FMV rate on file" message if no match). Panel updates when engagement type is changed.
**Why human:** Client-side fetch timing and skeleton-to-loaded visual transition require browser verification.

#### 5. Rejection Reason Character Count Gate in ActionPanel

**Test:** As Compliance/Finance user, open a submitted engagement's detail page. In the ActionPanel, type 9 characters in the rejection reason textarea, then expand to 10+ characters.
**Expected:** With 9 characters: "Reject" button disabled (character counter shows insufficient); with 10+ characters: "Reject" button enabled; after submitting rejection: amber callout on detail page shows the rejection reason.
**Why human:** ActionPanel character counter and live button enable/disable behavior require browser verification.

---

### Gaps Summary

No blocking gaps identified. All 5 ROADMAP success criteria are verified as implemented in the codebase. All 8 requirements (FMV-01 through FMV-05, ENG-01 through ENG-03) are satisfied by the implementation evidence. The "FMV rate snapshot" mentioned in the phase goal prompt is FMV-V2-02 (explicitly deferred to v2) and does not represent a gap against the v1 ROADMAP or REQUIREMENTS.md.

The phase is awaiting 5 human verification checks that require a running browser with authenticated sessions. All automated checks pass: 99/99 tests GREEN, all artifacts exist and are substantive, all key wiring links confirmed, all data flows verified against live DB queries.

---

_Verified: 2026-05-12_
_Verifier: Claude (gsd-verifier)_
