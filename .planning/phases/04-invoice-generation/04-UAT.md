---
status: testing
phase: 04-invoice-generation
source:
  - .planning/phases/04-invoice-generation/04-01-SUMMARY.md
  - .planning/phases/04-invoice-generation/04-02-SUMMARY.md
  - .planning/phases/04-invoice-generation/04-03-SUMMARY.md
started: "2026-05-16T00:00:00Z"
updated: "2026-05-16T00:00:00Z"
---

## Current Test

number: 5
name: Send to Finance button visible after PoP submitted
expected: |
  As a compliance officer, open an engagement in pop_submitted status. The sidebar shows "Review Proof of Performance" with a blue "Send to Finance" button and a link to view the PoP file.
awaiting: user response

## Tests

### 1. Agreed Rate label on engagement form
expected: Open the Create Engagement form. The compensation field label reads "Agreed Rate (USD)" — not "Compensation (USD)". The aria label is also updated.
result: pass

### 2. No of Activities field on engagement form
expected: Open the Create Engagement form. A "No of Activities" input field is visible in the right column below the FMV Rate Panel, regardless of which engagement type is selected. It accepts a numeric value.
result: pass

### 3. FMV Rate Panel rate display
expected: On the Create Engagement form, select an HCP and an engagement type that has a matching FMV rate card. The FMV Rate Panel shows the applicable rate (e.g., "$X/hr") fetched from the rate card.
result: pass

### 4. No of Activities on engagement detail page
expected: Open any existing completed engagement. The detail page shows a "No of Activities" field with its value (if set). The "Compensation" label has been renamed to "Agreed Rate (USD)" on this page too.
result: pass

### 5. Send to Finance button visible after PoP submitted
expected: As a compliance officer, open an engagement in "pop_submitted" status (business user has uploaded PoP). The sidebar shows "Review Proof of Performance" with a blue "Send to Finance" button and a link to view the PoP file.
result: pass

### 6. Send to Finance auto-completes and generates invoice
expected: Click "Send to Finance" on a pop_submitted engagement (R2 must be configured). The button shows "Completing..." spinner, then the page refreshes. The engagement status changes to "Completed". A toast confirms "Engagement completed — invoice generated and sent to Finance."
result: [pending]

### 7. Compliance cannot see invoice on completed engagement
expected: As a compliance officer, open the now-completed engagement. The sidebar shows "Completed" read-only card — no "Generate Invoice" or "Download Invoice" button visible. The invoice card is also absent from the detail body.
result: [pending]

### 8. Finance sees invoice in queue and on detail page
expected: Log in as a finance user. The Finance Queue shows the completed engagement with a "Download ↗" link in the Actions column (not a "Review" link). Clicking it opens the PDF. On the engagement detail page, the Invoice card shows "Download Invoice ↗" and the Download Invoice button is in the sidebar.
result: [pending]

### 9. Non-finance roles see no invoice
expected: Log in as a legal or business user. Open the completed engagement. No invoice card appears in the detail body and no Download Invoice button appears in the sidebar — just "Completed".
result: [pending]

## Summary

total: 9
passed: 4
issues: 0
pending: 0
skipped: 5

## Gaps

[none yet]
