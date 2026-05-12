---
status: partial
phase: 02-fmv-engagement
source: [02-VERIFICATION.md]
started: 2026-05-12T00:00:00Z
updated: 2026-05-12T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. NUCC validation badge rendering
expected: Upload a file with a mix of valid/invalid NUCC codes in /fmv/upload. Green badge for recognized codes, red for unrecognized; Activate button disabled when any row is unrecognized.
result: [pending]

### 2. Full engagement lifecycle (multi-role)
expected: Create draft as Business user → submit → Compliance/Finance approves → Business user completes. StatusHistory card shows all 4 transitions; ActionPanel shows correct buttons per role+status at each step.
result: [pending]

### 3. Business user 404 on another user's engagement
expected: Access /engagements/[id] of another user's engagement as a Business user → 404 page (not 403); no data exposed.
result: [pending]

### 4. FMV Rate Reference Panel at engagement creation
expected: At /engagements/new, select HCP + engagement type; panel transitions from loading skeleton to showing the applicable rate (or "no rate" message); updates when type changes.
result: [pending]

### 5. Rejection reason character gate in ActionPanel
expected: In ActionPanel at /engagements/[id], type 9 chars in rejection textarea — Reject button disabled. Type 10+ chars — Reject button enabled. Amber callout visible on the engagement after rejection.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
