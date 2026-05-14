---
phase: 2
slug: fmv-engagement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.3.0 + ts-jest 29.4.9 |
| **Config file** | `jest.config.ts` (exists — ts-jest preset, node environment) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test -- --runInBand` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test -- --runInBand`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| parse-rate-card | fmv | 1 | FMV-01, FMV-02 | Malformed Excel / formula injection | SheetJS does not eval formulas; raw:false returns strings; invalid rows marked unrecognized, not silently accepted | unit | `npm test -- --testPathPattern=fmv-parser` | ❌ W0 | ⬜ pending |
| fmv-rate-lookup | fmv | 1 | FMV-04 | — | State-level rate wins over national; no data leak across tenants | unit | `npm test -- --testPathPattern=fmv-lookup` | ❌ W0 | ⬜ pending |
| activate-rate-card | fmv | 2 | FMV-03 | Race condition on dual activation | Prisma $transaction makes close-prior + activate-new atomic; race cannot produce two active cards | unit (mock prisma) | `npm test -- --testPathPattern=fmv` | ❌ W0 | ⬜ pending |
| rate-card-list | fmv | 2 | FMV-05 | — | N/A | manual | — | manual | ⬜ pending |
| create-engagement | engagement | 3 | ENG-01 | Unauthorized engagement creation | assertRole([business, compliance]) in createEngagement; Finance role blocked | unit | `npm test -- --testPathPattern=engagement` | ❌ W0 | ⬜ pending |
| engagement-state-machine | engagement | 3 | ENG-02 | Invalid state transition bypass | updateMany where status=expectedState guard; returns 0 rows if wrong state → error | unit | `npm test -- --testPathPattern=engagement` | ❌ W0 | ⬜ pending |
| approve-reject | engagement | 3 | ENG-03 | Cross-role approval; rejection without reason | assertRole([compliance, finance]); rejectionReason min 10 chars enforced; Business role returns 403 | unit | `npm test -- --testPathPattern=engagement` | ❌ W0 | ⬜ pending |
| business-ownership | engagement | 3 | ENG-01 | Business user accessing other users' engagements | submittedByClerkId === userId check; return 404 not 403 on mismatch | unit | `npm test -- --testPathPattern=engagement` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/fmv-parser.test.ts` — covers FMV-01, FMV-02 (pure function tests; no Prisma needed; tests parseRateCardBuffer with valid/invalid rows)
- [ ] `lib/fmv-lookup.test.ts` — covers FMV-04 (state-first, national fallback, no-active-card cases; mocked Prisma client)
- [ ] `actions/fmv.test.ts` — covers FMV-03 activation transaction (mocked Prisma; verifies prior card gets superseded)
- [ ] `lib/engagement-validation.test.ts` — covers ENG-01, ENG-02, ENG-03 validation rules (pure function tests)
- [ ] `actions/engagement.test.ts` — covers state machine transition guards; ownership check; role enforcement

*All test files follow the pattern established in `actions/hcp.test.ts` and `lib/auth.test.ts` — pure function tests with no DB required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FMV rate card version list displays all versions with correct status badges | FMV-05 | Visual table rendering; relative time columns | 1. Upload 2+ rate cards. 2. Navigate to /fmv. 3. Verify both versions appear with correct status badges (active, superseded). 4. Verify effectiveTo populated on superseded version. |
| Upload wizard Step 1 → Step 2 transition with real Excel file | FMV-01 | File input + server parse + preview render | 1. Go to /fmv/upload. 2. Drop a valid .xlsx file. 3. Click "Upload and Parse". 4. Verify Step 2 shows all rows with NUCC validation badges. |
| FMV reference panel updates when HCP + type selected | FMV-04 | Client-side skeleton loader + API fetch + panel render | 1. Go to /engagements/new. 2. Select an HCP. 3. Select engagement type. 4. Verify FMV panel shows correct rate or "No rate on file". |
| Approval queue shows only submitted engagements | ENG-03 | Server-side filter + real data | 1. Create and submit an engagement. 2. Navigate to /engagements/queue as Compliance user. 3. Verify only submitted engagements appear. |
| Business user cannot see other users' engagements | ENG-01 | Ownership server guard | 1. Create engagement as User A. 2. Log in as User B (Business role). 3. Attempt direct URL access to /engagements/[id]. 4. Verify 404. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
