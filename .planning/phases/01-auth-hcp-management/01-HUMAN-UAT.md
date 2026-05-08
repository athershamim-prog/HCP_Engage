---
status: partial
phase: 01-auth-hcp-management
source: [01-VERIFICATION.md]
started: 2026-05-08T00:00:00Z
updated: 2026-05-08T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Finance User Route Enforcement
expected: Middleware redirects Finance user to /dashboard; HCP Directory never renders
result: [pending]

### 2. Business User Dashboard Blocked
expected: Business user redirected to /hcps when navigating to /dashboard
result: [pending]

### 3. Debarment Check End-to-End
expected: OIG LEIE match found for NPI 1234567890; expandable details; determination form works; outcome badge appears after save
result: [pending]

### 4. Do-Not-Engage Visual Treatment
expected: Select + Textarea borders turn red; label changes to "Reason for Do-Not-Engage designation (required)"
result: [pending]

### 5. Business User Profile Read-Only
expected: No "Set HCP Status" panel and no "Run Debarment Check" button visible for Business user
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
