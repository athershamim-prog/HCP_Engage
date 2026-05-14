---
phase: 3
plan: 1
subsystem: engagement
tags: [file-upload, api, pop, proof-of-performance]
dependency_graph:
  requires: [phase-2-engagement-lifecycle]
  provides: [pop-file-upload, pop-file-serve]
  affects: [ActionPanel, engagement-detail-page]
tech_stack:
  added: []
  patterns: [next-app-router-api-route, clerk-auth-self-authenticate, uuid-filename-sanitization, path-traversal-protection]
key_files:
  created:
    - app/api/engagements/pop-upload/route.ts
    - app/api/engagements/pop-file/[filename]/route.ts
  modified:
    - .gitignore
    - components/engagement/ActionPanel.tsx
    - app/(app)/engagements/[id]/page.tsx
decisions:
  - Local filesystem storage under uploads/pop/ for v1 PoP files (no cloud storage in this plan)
  - UUID-based filename generation prevents collisions and hides original names at storage layer
  - Path-traversal guard in serve route: regex test for /[\\/.]\./ plus explicit ".." check
metrics:
  duration: ~15 minutes
  completed_date: "2026-05-14T07:20:42Z"
  tasks_completed: 4
  tasks_total: 4
---

# Phase 3 Plan 1: PoP File Upload Summary

## One-liner

Local file upload for Proof of Performance attachments: auth-gated POST+GET API routes (5 MB limit, MIME allowlist, path-traversal protection) with file upload UI in ActionPanel and clickable file link rendering on the engagement detail page.

## What Was Built

### Task 1 — .gitignore update (9d4e2df)
Added `uploads/` to `.gitignore` so that PoP files saved to the local filesystem are never tracked by git.

### Task 2 — PoP upload and serve API routes (bd47fad)
- `app/api/engagements/pop-upload/route.ts` — POST endpoint: Clerk auth guard, 5 MB size limit, MIME allowlist (PDF/PNG/JPG/DOCX), UUID filename generation, saves to `uploads/pop/`
- `app/api/engagements/pop-file/[filename]/route.ts` — GET endpoint: Clerk auth guard, path-traversal protection (`/[/\\.]\./.test(filename)` + `includes("..")`), serves with correct Content-Type header

### Task 3 — ActionPanel file upload UI (5021303)
Extended the "approved" status panel with a file upload section above the existing manual URL input:
- Hidden `<input type="file">` triggered by a styled button
- Three upload states: idle (Choose file + paperclip icon), uploading (spinner), uploaded (filename + green check)
- OR divider separating file upload from manual reference input
- Uploaded file URL auto-populates `popUrl` for the Submit PoP action
- Manual URL edits clear the uploaded state to prevent stale data submission

### Task 4 — Engagement detail page PoP link rendering (7fc4e29)
- Proof of Performance card on the detail page: renders `/api/engagements/pop-file/` URLs as a "View attached file ↗" anchor with `target="_blank"`
- Backward compatible: manual URL references render as plain text (unchanged)
- Same link pattern applied in the ActionPanel `pop_submitted` Compliance review section

## Verification Results

- TypeScript: pre-existing errors only in `actions/engagement.test.ts` and `actions/fmv.test.ts` (Prisma mock typing issues unrelated to this plan's files — confirmed pre-existing by stash test)
- Tests: 128/128 passed, 9 test suites — no regressions

## Deviations from Plan

None — plan executed exactly as written. All 4 tasks committed individually with the correct commit type prefixes. The pre-existing TypeScript errors in test files were out of scope (confirmed pre-existing before any changes in this plan).

## Known Stubs

None. The upload URL returned from the POST route (`/api/engagements/pop-file/{uuid}.ext`) is immediately usable as the `popDocumentUrl` value stored on the engagement and rendered as a real clickable link.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: file-upload | app/api/engagements/pop-upload/route.ts | New file upload surface: accepts multipart POST. Mitigated by MIME allowlist, 5 MB limit, UUID filename (no original name in path), and Clerk auth guard. |
| threat_flag: file-serve | app/api/engagements/pop-file/[filename]/route.ts | New file serve surface: reads files from local filesystem by URL parameter. Mitigated by path-traversal guard (regex + ".." check) and Clerk auth guard. |

## Self-Check: PASSED

- [x] `app/api/engagements/pop-upload/route.ts` — FOUND (committed bd47fad)
- [x] `app/api/engagements/pop-file/[filename]/route.ts` — FOUND (committed bd47fad)
- [x] `components/engagement/ActionPanel.tsx` — FOUND (committed 5021303)
- [x] `app/(app)/engagements/[id]/page.tsx` — FOUND (committed 7fc4e29)
- [x] `.gitignore` — FOUND (committed 9d4e2df)
- [x] All 4 task commits confirmed in git log
- [x] 128 tests pass, 0 failures
