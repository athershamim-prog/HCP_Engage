---
phase: 4
slug: invoice-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.3.0 |
| **Config file** | `package.json` (`"test": "jest"`) |
| **Quick run command** | `npx jest --testPathPattern=invoice` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=invoice --testPathPattern=engagement-validation`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | CONT-02 | — | agreedRateUsd rename compiles; existing tests pass | unit | `npx jest --testPathPattern=engagement-validation` | ❌ W0 update | ⬜ pending |
| 4-01-02 | 01 | 1 | CONT-02 | — | noOfActivities nullable field accepted | unit | `npx jest --testPathPattern=invoice-calc` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 2 | CONT-02 | — | per_hour: total = agreedRateUsd × noOfActivities | unit | `npx jest --testPathPattern=invoice-calc` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 2 | CONT-02 | — | flat_fee: total = agreedRateUsd (no multiplication) | unit | `npx jest --testPathPattern=invoice-calc` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 3 | CONT-02 | T-4-01 | PDF buffer generated with all required fields | unit | `npx jest --testPathPattern=InvoiceDocument` | ❌ W0 | ⬜ pending |
| 4-04-01 | 04 | 3 | CONT-03 | T-4-02 | Duplicate generate blocked by unique constraint | unit | `npx jest --testPathPattern=invoice` | ❌ W0 | ⬜ pending |
| 4-04-02 | 04 | 3 | CONT-03 | T-4-03 | Only compliance role can trigger generate (401/403 for others) | unit | `npx jest --testPathPattern=invoice` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/__tests__/invoice-calc.test.ts` — unit tests for total calculation logic (per_hour/per_day × noOfActivities vs flat_fee/per_event as-is)
- [ ] `components/pdf/__tests__/InvoiceDocument.test.tsx` — render test verifying all required fields (HCP name/NPI/specialty, engagement type/date, financials) appear in PDF output
- [ ] `actions/__tests__/invoice.test.ts` — unit tests for role gate (compliance-only), duplicate constraint (409 on second call), and R2 upload mock
- [ ] Update `lib/__tests__/engagement-validation.test.ts` — rename `compensationUsd` → `agreedRateUsd` in all test fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Generate Invoice" button only appears when status=completed AND popDocumentUrl set | CONT-02 | UI state gating not easily unit-tested | Navigate to a completed+PoP engagement; verify button is visible. Navigate to approved (no PoP) engagement; verify button is absent. |
| Downloaded PDF renders correctly with HCP data, engagement data, and correct total | CONT-02 | PDF visual fidelity | Generate invoice for a per_hour engagement; open PDF; verify HCP name/NPI/specialty, type, date, No of Activities, rate, total are present and correct. |
| R2 URL is stored in Invoice record and persists across page reloads | CONT-03 | Requires live R2 credentials | Generate invoice; reload engagement detail page; verify "Download Invoice" button is present and URL resolves to PDF. |
| Finance user sees "Download Invoice" (read-only) after invoice generated | CONT-03 | Role-gated UI | Switch to Finance user; navigate to invoiced engagement; verify "Download Invoice" is visible, "Generate Invoice" is not. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
