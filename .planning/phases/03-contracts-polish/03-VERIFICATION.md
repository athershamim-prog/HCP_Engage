---
phase: 03-contracts-polish
verified: 2026-05-14T00:00:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Business user uploads a real file via the ActionPanel 'Choose file' button on an approved engagement"
    expected: "File uploads successfully, the PoP card on the detail page shows 'View attached file' as a clickable link, and the file is retrievable via the pop-file API route (auth-gated)"
    why_human: "Requires a running app, a real Clerk-authenticated session, filesystem write to uploads/pop/, and browser interaction"
  - test: "Legal user opens Legal Queue, opens an engagement in legal_review, submits feedback, and the engagement transitions back to compliance_review"
    expected: "Legal Queue lists the engagement; Legal user sees 'Legal Review' panel with feedback textarea; after submitting, engagement returns to compliance_review and disappears from Legal Queue"
    why_human: "Requires a running app, two distinct Clerk sessions (Compliance to send, Legal to return), and state-machine round-trip observation"
---

# Phase 3: Contracts + Polish — Verification Report

**Phase Goal:** Business users can upload actual PoP documents (files) when closing engagements; the expanded approval workflow (Legal role, compliance_review/legal_review/pop_submitted/finance_review states) is fully operational.
**Verified:** 2026-05-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Business user can attach a file (PDF, PNG, JPG, DOCX ≤ 5 MB) as Proof of Performance for an approved engagement; the file is stored and retrievable | VERIFIED (code path complete; runtime needs human) | Upload API route at `app/api/engagements/pop-upload/route.ts` implements: Clerk auth guard, 5 MB limit (`MAX_BYTES = 5 * 1024 * 1024`), MIME allowlist (PDF/PNG/JPG/DOCX) with magic-byte validation via `file-type`, UUID filename, saves to `uploads/pop/`. Serve route at `app/api/engagements/pop-file/[filename]/route.ts` has path-traversal protection, engagement-scoped authorization, and correct Content-Type headers. ActionPanel wires file input to upload API and auto-populates `popUrl`. Detail page renders the URL as a clickable "View attached file" link. |
| 2 | The stored PoP URL cannot be overwritten through the application once submitted | VERIFIED | `attachPopAction` in `actions/engagement.ts` (line 418) uses `updateMany` with `WHERE status = 'approved'`. Once status transitions to `pop_submitted`, no code path in the application sets `popDocumentUrl` again. No update route for `popDocumentUrl` exists on the `pop_submitted` path — the Compliance panel for `pop_submitted` only calls `sendToFinanceAction`, `sendToLegalAction`, or `rejectEngagementAction`, none of which touch `popDocumentUrl`. |
| 3 | A Legal user can review engagements routed to Legal and return them with feedback | VERIFIED (code path complete; runtime needs human) | `sendToLegalAction` moves engagement to `legal_review` and stores `legalReviewReturnStatus`. `legalReturnAction` enforces `assertRole(["legal"])`, validates feedback (≥10 chars), reads `legalReviewReturnStatus`, and transitions back. Legal Queue page at `app/(app)/engagements/legal-queue/page.tsx` queries `status = legal_review`, enforces Legal/Compliance role, and links to each engagement detail page. Sidebar wires "Legal Queue" nav item (`href: "/engagements/legal-queue"`) visible to `legal` and `compliance` roles. ActionPanel renders the Legal Review action panel when `status === "legal_review" && isLegal`. |

**Score:** 3/3 truths verified (code evidence complete; 2 of 3 require human runtime confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/engagements/pop-upload/route.ts` | POST endpoint: auth, size limit, MIME allowlist, file storage | VERIFIED | Substantive: auth guard, `MAX_BYTES`, magic-byte validation, UUID filename, `writeFile` to `uploads/pop/`. Wired: ActionPanel calls `/api/engagements/pop-upload` in `handleFileUpload`. |
| `app/api/engagements/pop-file/[filename]/route.ts` | GET endpoint: auth, path-traversal protection, file serve | VERIFIED | Substantive: `resolve(UPLOAD_DIR, filename)` + `startsWith(UPLOAD_DIR + sep)` path-traversal guard, engagement-scoped authorization, `readFile`, correct Content-Type. Wired: detail page and ActionPanel render `/api/engagements/pop-file/` URLs as clickable links. |
| `components/engagement/ActionPanel.tsx` | File upload UI for `approved` status; Legal Review panel for `legal_review` | VERIFIED | Substantive: file input hidden/styled, three upload states (idle/uploading/uploaded), OR divider, `popUrl` auto-populated, `attachPopAction` wired to Submit PoP button. Legal panel: feedback textarea, `legalReturnAction` call, 10-char minimum enforced. Not a stub — all state transitions are live. |
| `app/(app)/engagements/[id]/page.tsx` | PoP card renders file URLs as clickable links; ActionPanel wired with all props | VERIFIED | Substantive: PoP card conditionally renders on `engagement.popDocumentUrl`, URL prefix check renders "View attached file" anchor. `ActionPanel` receives `popDocumentUrl`, `effectiveRoles` (includes `legal`), and all required props. |
| `actions/engagement.ts` | `sendToLegalAction`, `legalReturnAction`, `attachPopAction` | VERIFIED | All three actions are substantive, role-guarded, and use `prisma.$transaction`. `attachPopAction` gated on `status = 'approved'`. `sendToLegalAction` valid from `submitted`, `compliance_review`, `pop_submitted`. `legalReturnAction` reads `legalReviewReturnStatus` for correct return target. |
| `app/(app)/engagements/legal-queue/page.tsx` | Legal queue page listing `legal_review` engagements | VERIFIED | Queries `prisma.engagement.findMany({ where: { status: "legal_review" } })`, enforces `assertRole(["legal", "compliance"])`, renders table with link to each engagement detail page. |
| `prisma/schema.prisma` | `legal_review`, `compliance_review`, `pop_submitted`, `finance_review` states; `legalReviewReturnStatus` field | VERIFIED | `EngagementStatus` enum contains all four states. `Engagement` model has `legalReviewReturnStatus EngagementStatus?` field. |
| `lib/auth.ts` | `legal` as a recognized `AppRole` | VERIFIED | `AppRole = "business" | "compliance" | "finance" | "legal"`. Route allowlist includes `/engagements/legal-queue`. Sidebar `Legal Queue` nav item scoped to `["legal", "compliance"]`. |
| `.gitignore` | `uploads/` excluded | VERIFIED | Lines 35-36: `# Local file uploads (PoP documents, etc.)` and `uploads/`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ActionPanel` (approved panel) | `/api/engagements/pop-upload` | `fetch` in `handleFileUpload` | WIRED | Line 81: `fetch("/api/engagements/pop-upload", { method: "POST", body: fd })`. Response `data.url` written to `popUrl` state. |
| `ActionPanel` (approved panel) | `attachPopAction` | `wrap(() => attachPopAction(...))` | WIRED | Line 311: button `onClick` calls `wrap(() => attachPopAction(engagementId, popUrl), ...)`. |
| `attachPopAction` | Prisma `Engagement.popDocumentUrl` | `updateMany WHERE status='approved'` | WIRED | Lines 415-429: `data: { status: "pop_submitted", popDocumentUrl: popDocumentUrl.trim() }`. |
| `ActionPanel` (legal_review panel) | `legalReturnAction` | `wrap(() => legalReturnAction(...))` | WIRED | Line 226: button `onClick` calls `wrap(() => legalReturnAction(engagementId, legalFeedback), ...)`. |
| `sendToLegalAction` | `Engagement.legalReviewReturnStatus` | `tx.engagement.update` | WIRED | Lines 223-227: sets `status: "legal_review"` and `legalReviewReturnStatus: returnStatus`. |
| `legalReturnAction` | `legalReviewReturnStatus` | reads field, transitions back | WIRED | Lines 289-296: reads `engagement.legalReviewReturnStatus`, updates to that status, nulls the field. |
| `legal-queue page` | Prisma `legal_review` engagements | `findMany WHERE status="legal_review"` | WIRED | Lines 38-44: real DB query, includes HCP name. |
| `detail page` | `ActionPanel` | renders with `effectiveRoles`, `popDocumentUrl` | WIRED | Lines 308-316: passes all required props from server-fetched engagement. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `pop-upload/route.ts` | `buffer` / `filename` | `request.formData()` + `file.arrayBuffer()` | Yes — real file bytes written to filesystem | FLOWING |
| `pop-file/[filename]/route.ts` | `buffer` | `readFile(resolved)` from local filesystem | Yes — reads real file bytes | FLOWING |
| `legal-queue/page.tsx` | `engagements` | `prisma.engagement.findMany(...)` | Yes — live DB query | FLOWING |
| `ActionPanel` | `popUrl` | Upload API response (`data.url`) or manual input | Yes — URL written from real upload response | FLOWING |
| `engagement detail page` | `engagement.popDocumentUrl` | `prisma.engagement.findUnique(...)` | Yes — live DB field | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — verifying API routes requires a running Next.js server and Clerk authentication context; spot-checks cannot be run without starting the server.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CONT-02 (simplified) | 03-01-PLAN.md | File upload for PoP attachment (reframed from PDF contract generation) | SATISFIED | Upload API, ActionPanel UI, and `attachPopAction` deliver file upload capability. The phase CONTEXT.md documents the deliberate scope reframe: CONT-02 satisfied by PoP file upload rather than PDF contract generation. |
| CONT-03 (simplified) | 03-01-PLAN.md | Stored PoP URL cannot be overwritten (reframed from cloud storage immutability) | SATISFIED | `attachPopAction` only fires from `status='approved'`; once transitioned to `pop_submitted`, no application code path updates `popDocumentUrl`. CONTEXT.md confirms this interpretation. |

**Note on CONT-01 and CONT-04:** These requirements are mapped to Phase 3 in REQUIREMENTS.md but were explicitly deferred per CONTEXT.md decisions D-01 and D-03 (contract template upload and 4-stage contract lifecycle are out of v1 scope). They are not covered by this plan and are treated as deferred.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/api/engagements/pop-upload/route.ts` | 37 | Dynamic `import("file-type")` inside request handler | Info | Not a stub — functional magic-byte validation. Dynamic import is acceptable for an optional ESM-only package. No impact on correctness. |
| `actions/engagement.ts` | 28-30 | `assertRole(roles, ["business", "compliance"])` in `createEngagementAction` uses no UserGrant lookup | Info | Pre-existing pattern from Phase 2; grants are only checked in pages, not server actions for create. Not introduced by this phase. |

No blockers or stubs found. No TODO/FIXME/placeholder comments in any modified files.

### Human Verification Required

#### 1. PoP File Upload End-to-End

**Test:** Log in as a Business user. Open an engagement in `approved` status. In the Actions panel, click "Choose file", select a PDF under 5 MB, wait for upload confirmation (green check + filename). Click "Submit PoP". Reload the page.
**Expected:** The Proof of Performance card appears on the detail page with a "View attached file" link. Clicking the link opens the file in a new tab (authenticated via Clerk session cookie). The engagement status badge changes to "PoP Submitted".
**Why human:** Requires a running Next.js server, a Clerk-authenticated browser session, actual filesystem write to `uploads/pop/`, and browser file picker interaction. Cannot be verified with grep or static analysis.

#### 2. Legal Review Round-Trip

**Test:** Log in as a Compliance user. Open a `submitted` engagement. Click "Send to Legal". Confirm status changes to "Legal Review". Log out. Log in as a Legal user. Navigate to Legal Queue. Confirm the engagement appears. Click "Review & Submit Feedback", type at least 10 characters of feedback, click "Submit Feedback & Return". Confirm the engagement transitions back to "Compliance Review" and disappears from the Legal Queue.
**Expected:** All transitions occur without errors. Status history on the engagement detail page shows the legal_review entry with the Legal user's name, and the compliance_review return entry with the feedback text as the reason.
**Why human:** Requires two distinct Clerk sessions with different roles, state-machine round-trip observation across browser tabs, and confirmation that `legalReviewReturnStatus` correctly resolves the return target.

### Gaps Summary

No gaps found. All three observable truths are verified at the code level. The two human verification items are confirmation tests, not gap indicators — the underlying implementation is complete and substantive.

The phase goal is achieved at the implementation level. Human sign-off on the two runtime flows is required before proceeding to the next phase.

---

_Verified: 2026-05-14_
_Verifier: Claude (gsd-verifier)_
