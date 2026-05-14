# Phase 3: Contracts + Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 3-contracts-polish
**Areas discussed:** Scope reframe, compensation model, generation trigger, storage, invoice content, status lifecycle

---

## Scope Reframe

| Option | Description | Selected |
|--------|-------------|----------|
| Full contract system | Template upload, versioning, merge fields, 4-stage lifecycle per CONT-01–04 | |
| Invoice only | Fixed-layout PDF invoice generated when Compliance is ready to send to Finance for payment | ✓ |

**User's choice:** "I just need an invoice when compliance sends this to Finance for payment."
**Notes:** User confirmed CONT-01 (template upload/versioning) and CONT-04 (4-stage status lifecycle) are over-engineered for v1. Fixed-layout invoice is sufficient. This is a scope simplification from the ROADMAP.

---

## Compensation Model

| Option | Description | Selected |
|--------|-------------|----------|
| Keep compensationUsd as total | Current field — user enters the total compensation amount | |
| Rename to agreedRateUsd + add noOfActivities | Rate × activities = total; matches real-world HCP payment calculation | ✓ |

**User's choice:** "That should be rate not compensation. The actual compensation will be calculated by multiplying the agreed rate with HCP by number of engagements. So we need to add number of engagements on the form."
**Follow-up — field label:** "No of Activities"
**Follow-up — applicable rate units:** "Just hours and per day" (flat_fee excluded for now; per_event excluded by implication)
**Notes:** This requires a Prisma migration (rename compensationUsd → agreedRateUsd, add noOfActivities integer). Invoice total = agreedRateUsd × noOfActivities for per_hour and per_day only.

---

## Generation Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| After approval | Compliance approves → invoice can be generated | |
| After completion + PoP attached | Engagement is Completed and PoP document is attached | ✓ |
| After completion only | After engagement is marked Completed | |

**User's choice:** "After compliance has PoP and ready to send it to finance for payment"
**Notes:** PoP = Proof of Performance. `Engagement.popDocumentUrl` already exists on the model from Phase 2. Both `status === "completed"` AND `popDocumentUrl` being set are required gates.

---

## Send to Finance

| Option | Description | Selected |
|--------|-------------|----------|
| Download PDF only | Compliance downloads and emails externally. No in-app send action. | ✓ |
| In-app status change | "Send to Finance" button changes status so Finance sees it in the app | |

**User's choice:** Download PDF only
**Notes:** No in-app notification or status change needed for Finance. PDF is sent out-of-band (email).

---

## Cloud Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare R2 | S3-compatible, no egress fees, simpler pricing for v1 | ✓ |
| AWS S3 | Mature tooling, more IAM complexity | |

**User's choice:** Cloudflare R2

---

## Invoice Content

| Option | Description | Selected |
|--------|-------------|----------|
| Standard fields only | HCP name/NPI/specialty, engagement type, date, No of Activities, agreed rate, total | ✓ |
| Add PoP reference | Standard + PoP document reference | |
| Add submitter + approver | Standard + who submitted/approved | |

**User's choice:** Standard fields only

---

## Status Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Simple — just track if invoice exists | Invoice record exists or not. No stages. | ✓ |
| Basic 2-stage: Pending → Paid | Compliance generates (Pending); Finance marks Paid | |
| Full 4-stage per CONT-04 | Draft → Sent → Executed → Expired (all manual, no DocuSign) | |

**User's choice:** Simple — just track if invoice exists
**Notes:** Existence of an `Invoice` DB record is the only state needed. No status field on the model.

---

## Claude's Discretion

- Rate basis fallback when no FMV rate is on file (D-07): show a `rateUnit` selector (per_hour / per_day) defaulting to per_hour
- Invoice DB model structure (D-14): `Invoice` table with unique `engagementId` FK constraint, fields: id, engagementId, storageUrl, agreedRateUsd, noOfActivities, totalUsd, generatedByClerkId, generatedByName, generatedAt
- R2 bucket key structure: `invoices/{engagementId}/{timestamp}.pdf`

---

## Deferred Ideas

- Contract template upload/versioning (CONT-01) — v2 if clients require custom invoice layouts
- 4-stage status lifecycle (CONT-04: Draft → Sent → Executed → Expired) — v2 if Finance requires formal lifecycle tracking
- DocuSign e-signature (CONT-V2-01) — already in v2 scope per REQUIREMENTS.md
- In-app send-to-Finance action (notification, Finance queue) — v2
- Per-event rate type support for noOfActivities — excluded from v1
