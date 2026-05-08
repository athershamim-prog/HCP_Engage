---
status: complete — all 5 tests passed
phase: 01-auth-hcp-management
source: [01-VERIFICATION.md]
started: 2026-05-08T00:00:00Z
updated: 2026-05-08T12:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Finance User Route Enforcement
expected: Middleware redirects Finance user to /dashboard; HCP Directory never renders
result: PASS

### 2. Business User Dashboard Blocked
expected: Business user redirected to /hcps when navigating to /dashboard
result: PASS

### 3. Debarment Check End-to-End
expected: OIG LEIE match found for NPI 1234567890; expandable details; determination form works; outcome badge appears after save
result: PASS (tested with NPI 1003000126 — seeded OIG fixture)

### 4. Do-Not-Engage Visual Treatment
expected: Select + Textarea borders turn red; label changes to "Reason for Do-Not-Engage designation (required)"
result: PASS

### 5. Business User Profile Read-Only
expected: No "Set HCP Status" panel and no "Run Debarment Check" button visible for Business user
result: PASS

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
