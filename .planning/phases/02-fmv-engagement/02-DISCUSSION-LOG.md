# Phase 2: FMV + Engagement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 02-fmv-engagement
**Areas discussed:** Rate card data shape

---

## Rate card data shape

### Geography granularity

| Option | Description | Selected |
|--------|-------------|----------|
| National only | One rate per specialty + engagement type, applies everywhere | |
| State-level | Rate varies by US state — most common in real pharma rate cards | ✓ |
| Region-level | Rate varies by region (Northeast, Southeast, etc.) | |
| All three | Suggested initially, then walked back | |

**User's choice:** State-level (national fallback via `state = null`)
**Notes:** User initially said "all three" but clarified on follow-up they only wanted one level. Recommended state-level as the standard pharma practice; user agreed. National fallback: when both a state and national rate exist for the same specialty + type, state-level wins.

---

### Column layout

| Option | Description | Selected |
|--------|-------------|----------|
| Flat rows | One row per rate: specialty_code, state, engagement_type, rate_usd, rate_unit | ✓ |
| Pivot table | Specialty rows × engagement type columns, one sheet per state | |

**User's choice:** Flat rows
**Notes:** Simpler to parse and validate; SheetJS handles it cleanly. Pivot tables are common in Excel-native rate cards but add parsing complexity.

---

### Rate unit

| Option | Description | Selected |
|--------|-------------|----------|
| Single rate_usd column | Just store the number; unit left to context | |
| rate_usd + rate_unit column | Store both amount and unit (per_hour, per_day, per_event, flat_fee) | ✓ (Claude's discretion) |
| You decide | Let Claude pick | ✓ |

**User's choice:** You decide
**Notes:** Claude chose `rate_usd + rate_unit` — makes rate cards self-describing, avoids ambiguity when displaying the rate at engagement creation (e.g., "$350/hour" vs "$2,500/event").

---

### NUCC taxonomy source

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-seeded NuccTaxonomy table | Same fixture pattern as OIG LEIE / SAM.gov from Phase 1 | ✓ |
| Hardcoded list in code | Static array of valid NUCC codes | |
| Skip validation | Accept any specialty value (deviates from FMV-01 and FMV-02) | Initially suggested, then reversed |

**User's choice:** Pre-seeded NuccTaxonomy table
**Notes:** User initially said "skip this validation for now." Claude flagged that FMV-01 and FMV-02 both require NUCC validation and that skipping it deviates from both requirements. Proposed lightweight alternative: pre-seeded fixture table, same pattern as Phase 1 debarment tables. User agreed ("ok do it").

---

## Claude's Discretion

- **Rate unit column:** `rate_usd + rate_unit` (per_hour / per_day / per_event / flat_fee) — user deferred
- **Activation model:** Explicit activate-after-preview wizard (upload → parse → preview → activate). Admin must confirm before card goes live.
- **Version immutability:** Parsed rows stored; raw file not retained. Historical versions accessible via version list.
- **Engagement form:** Unified form for all 5 types in v1; no type-specific fields. FMV rate shown as read-only reference panel.
- **Draft behavior:** Save without submitting; submitter can edit and return. Submission locks the record.
- **Approval queue:** Shared among all Compliance + Finance users; no assignment in v1.
- **Completed transition:** Manual trigger by submitter after engagement has occurred.

## Deferred Ideas

- FMV enforcement/blocking (proposed compensation > rate ceiling) — v2 (FMV-V2-01)
- FMV rate snapshot immutably onto engagement at creation — v2 (FMV-V2-02)
- Multi-step Compliance → Finance sequential approval — v2 (ENG-V2-01)
- Per-type configurable engagement form fields — v2 (ENG-V2-03, ENG-V2-05)
- Raw uploaded rate card file storage — not stored in v1
