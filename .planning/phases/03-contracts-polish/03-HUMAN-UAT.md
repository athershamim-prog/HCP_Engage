---
status: partial
phase: 03-contracts-polish
source: [03-VERIFICATION.md]
started: 2026-05-14T00:00:00Z
updated: 2026-05-14T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. PoP file upload end-to-end
expected: Log in as Business user, open an `approved` engagement, click "Choose file" in the ActionPanel, select a real PDF. Button shows spinner then filename + green check. Click "Submit PoP". Engagement moves to `pop_submitted`. On the detail page, PoP card shows "View attached file ↗" link. Clicking the link opens the file in a new tab.
result: [pending]

### 2. Legal review round-trip
expected: As Compliance, open a submitted engagement and click "Send to Legal". As Legal user, open /engagements/legal-queue — engagement appears there. Click through to detail, submit ≥10 chars of feedback, click "Submit Feedback & Return". Engagement returns to `compliance_review`. Status history shows the Legal feedback as the reason for the compliance_review transition.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
