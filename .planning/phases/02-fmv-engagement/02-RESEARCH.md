# Phase 2: FMV + Engagement - Research

**Researched:** 2026-05-08
**Domain:** FMV rate card upload (SheetJS/xlsx), NUCC taxonomy seeding, Prisma state machine, HCP search popover, engagement lifecycle
**Confidence:** HIGH (core patterns verified against official docs and existing codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Rate card uses state-level geography with national fallback. Rows with `state = null` apply nationwide. State-level rate wins when both exist for the same specialty + engagement type (most specific wins).
- **D-02:** Excel/CSV layout is flat rows. Columns: `specialty_code`, `state`, `engagement_type`, `rate_usd`, `rate_unit`. Parsed with SheetJS server-side.
- **D-03:** Rate unit is stored as a separate `rate_unit` column: `per_hour | per_day | per_event | flat_fee`.
- **D-04:** NUCC validation uses a pre-seeded `NuccTaxonomy` table (same fixture pattern as OIG LEIE/SAM.gov). Upload rejected if any `specialty_code` cannot be matched.
- **D-09:** V1 uses a single approver — any Compliance or Finance user can approve or reject a Submitted engagement.

### Claude's Discretion

- **D-05:** Upload wizard: upload → server-side parse → preview table with per-row NUCC validation → explicit Activate button. No auto-activation.
- **D-06:** Rate card immutable once activated. Raw file NOT stored — only parsed rows persisted.
- **D-07:** All 5 engagement types share a common base form (no type-specific fields in v1).
- **D-08:** Draft = saved but not submitted. Only creating user can edit their own Draft.
- **D-10:** Approval queue is shared/unassigned — all Compliance and Finance users see all Submitted engagements.
- **D-11:** Completed transition is triggered manually by the submitting user after approval.

### Deferred Ideas (OUT OF SCOPE)

- FMV enforcement/blocking (FMV-V2-01) — display only in v1
- FMV rate snapshot onto engagement record (FMV-V2-02) — v2
- Multi-step Compliance → Finance sequential approval (ENG-V2-01) — v2
- Approval delegation (ENG-V2-02) — v2
- Configurable per-type engagement form fields (ENG-V2-03, ENG-V2-05) — v2
- Raw rate card file storage — v2

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FMV-01 | Admin uploads FMV rate card (Excel/CSV) with parsed preview; rejected if specialty values can't match NUCC taxonomy codes | SheetJS Buffer→read pattern; Server Action with bodySizeLimit; NUCC seed table lookup |
| FMV-02 | Rate card upload validates all specialty values against local NUCC taxonomy reference before activation | NuccTaxonomy table; per-row validation in parse action; Activate button disabled if any row invalid |
| FMV-03 | Rate cards versioned with effective date ranges; activating new version supersedes prior | FmvRateCard effectiveFrom/effectiveTo; Prisma transaction to atomically close prior active card |
| FMV-04 | System displays applicable FMV rate at engagement creation by NUCC specialty + geography + engagement type — reference only | Rate lookup function: specialty + state/national fallback; read-only reference panel in UI |
| FMV-05 | User can view all rate card versions | FmvRateCard list page with version history table |
| ENG-01 | User can submit engagement request for 5 types: advisory board, speaker program, investigator/research, meal/TOV, training | EngagementType enum; unified form; createEngagement Server Action |
| ENG-02 | Engagement status tracks Draft → Submitted → Approved / Rejected → Completed | EngagementStatus enum + state machine guard in Server Actions |
| ENG-03 | Single approver (Compliance or Finance) approves or rejects; rejection requires reason | assertRole guard; approveEngagement / rejectEngagement actions; reason min-length validation |

</phase_requirements>

---

## Summary

Phase 2 extends the Phase 1 codebase with two new capabilities: FMV rate card management and engagement lifecycle. The Phase 1 patterns — Server Actions in `actions/`, validation helpers in `lib/`, role enforcement via `getEffectiveRoles()`, Prisma transactions for atomic writes — apply directly to all Phase 2 work. No new architectural patterns are introduced; Phase 2 is an expansion of established conventions.

The most technically novel area is the SheetJS server-side file parsing pipeline. SheetJS 0.20.3 (installed from the official CDN, not the stale npm registry) accepts a `Buffer` or `Uint8Array` from a Next.js Server Action's `FormData.get("file").arrayBuffer()` call. The parse happens entirely server-side in the Server Action; no file is written to disk. The `next.config.ts` must set `experimental.serverActions.bodySizeLimit` to `'5mb'` to accept the rate card files (the default is 1 MB).

The engagement state machine is implemented without a third-party library. Each transition (submit, approve, reject, complete) is a separate Server Action that validates the current status before performing the update using Prisma's `$transaction` with an `updateMany` where clause scoped to the expected current status — giving an atomic guard-and-update. The `EngagementStatusHistory` table records every transition with actor identity stored as strings (matching the Phase 1 audit pattern from `HcpStatusHistory`).

The HCP search popover in the New Engagement form uses a dedicated GET API route (`/api/hcps/search`) combined with client-side debounce (300 ms via `setTimeout` in a `useEffect`). This pattern matches how the existing `/api/nppes` route is structured, and avoids streaming Server Action complexity for a simple search response.

**Primary recommendation:** Follow Phase 1 patterns exactly — actions in `actions/`, validation helpers in `lib/`, role guards via `assertRole()`. Add SheetJS parsing as a new `lib/fmv-parser.ts` utility. Implement engagement transitions as named Server Actions, each with its own status guard.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rate card file upload + parse | API / Backend (Server Action) | Browser / Client (file input, drop zone) | SheetJS parsing is CPU-bound and must not run client-side; file is sent as multipart form data to the Server Action |
| NUCC validation on upload | API / Backend (Server Action) | — | Requires DB lookup against NuccTaxonomy; no client-side equivalent |
| Rate card activation | API / Backend (Server Action) | — | Atomic DB transaction to supersede prior version; no client state needed |
| FMV rate lookup at engagement creation | API / Backend (API Route GET) | Browser / Client (skeleton loader during fetch) | Triggered when HCP + type are selected; needs sub-100 ms response; thin DB query |
| Engagement form (new/edit) | Browser / Client | API / Backend (Server Action for save) | Form state (draft autosave, HCP selection, field validation) lives in client component |
| HCP search popover | Browser / Client (debounce input) | API / Backend (GET /api/hcps/search) | Autocomplete with debounce is inherently client-side; data fetched from server |
| Engagement state transitions | API / Backend (Server Action per transition) | — | Each named transition validates current status atomically in DB |
| Engagement list / approval queue | Frontend Server (Server Component) | — | URL-param driven filtering; read-only page render |
| Rate card version list | Frontend Server (Server Component) | — | Read-only; no client interactivity |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SheetJS (xlsx) | 0.20.3 | Parse .xlsx, .xls, .csv files server-side | Already in project stack; official CDN version (npm registry is stale at 0.18.5) |
| Prisma | 7.8.0 | ORM for all new tables; state transitions via `$transaction` | Already installed; used throughout Phase 1 |
| Next.js | 16.2.5 | Server Actions for mutations; Server Components for list pages; API Routes for search | Already installed |
| date-fns | 4.1.0 | Format `effectiveFrom`/`effectiveTo` dates in UI | Already installed |

**Version verification:** [VERIFIED: npm list — Prisma 7.8.0, Next.js 16.2.5, date-fns 4.1.0 installed. SheetJS: not yet installed — see installation below.]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn Skeleton | latest (via shadcn CLI) | Loading state in FMV rate reference panel | Add when implementing the New Engagement form's FMV reference panel |
| shadcn AlertDialog | latest (via shadcn CLI) | Delete draft confirmation modal | Add for the single modal in Phase 2 (irreversible draft deletion) |
| shadcn Combobox | latest (via shadcn CLI) | HCP search popover on New Engagement form | Add when implementing the engagement form |
| shadcn Popover | latest (via shadcn CLI) | Wrapper for HCP search suggestion list | Required by Combobox |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SheetJS 0.20.3 from CDN | `read-excel-file` npm package | SheetJS handles all 3 file types (.xlsx, .xls, .csv) in one API; read-excel-file only handles .xlsx |
| API Route for HCP search | Server Action called from useTransition | API Route follows existing `/api/hcps/exists` and `/api/nppes` patterns; Server Actions are better suited to mutations than query responses |
| Manual state machine guards | `xstate` or `robot` library | Overkill for 4 states and 5 named transitions; inline guard pattern is explicit and testable |

**Installation:**
```bash
# SheetJS from official CDN (npm registry version 0.18.5 is stale and contains CVEs)
npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

# shadcn components not yet added
npx shadcn@latest add skeleton
npx shadcn@latest add alert-dialog
npx shadcn@latest add combobox
npx shadcn@latest add popover
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser                     Next.js Server                    PostgreSQL (Neon)
  │                              │                                    │
  │  FMV Upload Flow             │                                    │
  ├─(file input + FormData)──→  parseRateCardAction()                │
  │                              ├─ SheetJS.read(Buffer)              │
  │                              ├─ NuccTaxonomy lookup ────────────→ │
  │                              ├─ per-row validation status         │
  │                              └─→ preview data to client           │
  │                                                                    │
  ├─(Activate button)─────────→ activateRateCardAction()             │
  │                              ├─ tx: close prior FmvRateCard       │
  │                              ├─ tx: create FmvRateCard (active)   │
  │                              └─ tx: createMany FmvRate rows ────→ │
  │                                                                    │
  │  Engagement Creation         │                                    │
  ├─(HCP + type selected)──────→ GET /api/fmv/rate?hcpId&type        │
  │  (debounced fetch)           ├─ FmvRate lookup by                 │
  │                              │  nuccCode + state (then national)  │
  │                              └─→ rate or null ──────────────────→ │
  │                                                                    │
  ├─(HCP search typed)──────→   GET /api/hcps/search?q=              │
  │  (debounce 300ms)            ├─ Hcp.findMany fullName/npi match   │
  │                              └─→ up to 8 results                  │
  │                                                                    │
  ├─(Save Draft)──────────────→ createEngagementAction(status:draft)  │
  │                              ├─ assertRole([business,compliance])  │
  │                              └─→ Engagement.create ─────────────→ │
  │                                                                    │
  ├─(Submit for Approval)─────→ submitEngagementAction(id)            │
  │                              ├─ assertRole([business,compliance])  │
  │                              ├─ updateMany where status=draft     │
  │                              └─→ EngagementStatusHistory.create → │
  │                                                                    │
  ├─(Approve / Reject)────────→ approveEngagementAction(id)           │
  │                             rejectEngagementAction(id, reason)    │
  │                              ├─ assertRole([compliance,finance])  │
  │                              ├─ updateMany where status=submitted │
  │                              └─→ EngagementStatusHistory.create → │
  │                                                                    │
  └─(Mark Completed)──────────→ completeEngagementAction(id)          │
                                 ├─ verify submittedByClerkId == self  │
                                 ├─ updateMany where status=approved  │
                                 └─→ EngagementStatusHistory.create → │
```

### Recommended Project Structure

```
actions/
├── hcp.ts              # Phase 1 — unchanged
├── fmv.ts              # NEW: parseRateCard, activateRateCard
└── engagement.ts       # NEW: createEngagement, submitEngagement,
                        #      approveEngagement, rejectEngagement, completeEngagement, deleteEngagement

lib/
├── auth.ts             # Phase 1 — add /fmv and /engagements routes to ROUTE_PERMISSIONS
├── fmv-parser.ts       # NEW: pure SheetJS parse + NUCC validation logic (testable)
├── fmv-lookup.ts       # NEW: getFmvRate(nuccCode, state, engagementType) — pure function
├── engagement-validation.ts # NEW: pure validation helpers for engagement form fields
└── ...                 # Phase 1 files unchanged

app/(app)/
├── fmv/
│   ├── page.tsx            # Screen 2: Rate card list (Server Component)
│   ├── upload/
│   │   └── page.tsx        # Screen 3: Upload wizard (Client Component — file drop zone)
│   └── [id]/
│       └── page.tsx        # Screen 4: Rate card detail (Server Component)
└── engagements/
    ├── page.tsx            # Screen 5: Engagement list (Server Component)
    ├── new/
    │   └── page.tsx        # Screen 6: New engagement form (Client Component)
    ├── queue/
    │   └── page.tsx        # Screen 8: Approval queue (Server Component)
    └── [id]/
        └── page.tsx        # Screen 7: Engagement detail (Server Component; action panel is Client Component)

app/api/
├── hcps/
│   ├── search/
│   │   └── route.ts        # NEW: GET /api/hcps/search?q= (HCP popover autocomplete)
│   └── exists/             # Phase 1 — unchanged
└── fmv/
    └── rate/
        └── route.ts        # NEW: GET /api/fmv/rate?hcpId=&type= (FMV rate reference panel)

components/
├── fmv/
│   ├── RateCardTable.tsx   # Upload preview table + per-row validation badges
│   └── FmvRatePanel.tsx    # FMV reference panel for New Engagement form
├── engagement/
│   ├── EngagementStatusBadge.tsx
│   ├── EngagementTable.tsx
│   ├── EngagementForm.tsx  # Client Component: unified form for all 5 types
│   ├── HcpSearchInput.tsx  # Client Component: search-with-popover
│   └── ActionPanel.tsx     # Client Component: approve/reject/complete actions
└── ...                     # Phase 1 components unchanged
```

---

### Pattern 1: SheetJS Server-Side File Parse (Server Action)

**What:** Parse an Excel or CSV file uploaded via `<form>` in a Next.js Server Action. No file written to disk. Returns rows as plain objects.

**When to use:** `parseRateCardAction` — receives the uploaded file, returns parsed rows with NUCC validation status.

**Prerequisite — next.config.ts change:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions [VERIFIED: WebFetch 2026-05-08]
// Default bodySizeLimit is 1MB. Rate cards can be up to 5MB.
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }] },
};
```

**Server Action pattern:**
```typescript
// Source: SheetJS docs + Next.js Server Action pattern [VERIFIED: WebFetch 2026-05-08]
"use server";
import * as XLSX from "xlsx";

export async function parseRateCardAction(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  // File → Buffer → XLSX workbook
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // sheet_to_json returns one object per row with header keys
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: false,  // coerce all values to strings
  });

  // Validate and map rows...
  return { rows };
}
```

**ESM note:** SheetJS docs recommend CommonJS in Node.js. For ESM/TypeScript in Next.js, use `import * as XLSX from 'xlsx'` and set the fs adapter if reading files from disk (not needed here since we use `Buffer.from(arrayBuffer)` directly). [VERIFIED: docs.sheetjs.com/docs/getting-started/installation/nodejs/]

---

### Pattern 2: NUCC Taxonomy Fixture Seed (same pattern as OIG LEIE / SAM.gov)

**What:** Pre-seed the `NuccTaxonomy` table with the NUCC CSV data. Lookup during rate card upload to validate `specialty_code` values.

**NUCC CSV structure** (6 columns) [VERIFIED: WebFetch nucc.org CSV sample]:
```
Code | Grouping | Classification | Specialization | Definition | Notes
```
The `Code` column (10-character alphanumeric) is the `specialty_code` used in rate cards.

**Seed pattern** (matches `prisma/seed.ts` for OIG LEIE):
```typescript
// prisma/seed.ts addition — same createMany + skipDuplicates pattern
await prisma.nuccTaxonomy.createMany({
  data: nuccRows.map((row) => ({
    code: row.Code,
    grouping: row.Grouping ?? null,
    classification: row.Classification ?? null,
    specialization: row.Specialization ?? null,
    displayName: [row.Classification, row.Specialization]
      .filter(Boolean).join(" — ") || row.Grouping,
  })),
  skipDuplicates: true,
});
```

**NUCC licensing note:** NUCC taxonomy requires a license for commercial use. For v1, seed with a static fixture subset (100–200 most common pharma-relevant codes from the freely-available NPPES taxonomy reference). The codes embedded in NPPES HCP records are public domain; seeding the codes from actual HCP records avoids direct redistribution of the full NUCC dataset. [ASSUMED — licensing specifics not verified with NUCC directly; legal review recommended before full dataset seed]

---

### Pattern 3: FMV Rate Lookup (most-specific-wins)

**What:** Given HCP `nuccCode`, `primaryState`, and `engagementType`, find the best-matching `FmvRate` row in the active rate card. State-level beats national.

**When to use:** `/api/fmv/rate` route handler; also unit-testable as a pure function in `lib/fmv-lookup.ts`.

```typescript
// lib/fmv-lookup.ts [ASSUMED — pattern derived from D-01 decision]
export async function getFmvRate(params: {
  nuccCode: string;
  state: string;       // 2-letter abbreviation
  engagementType: string;
  prisma: PrismaClient;
}): Promise<FmvRate | null> {
  const { nuccCode, state, engagementType, prisma } = params;

  // Get active rate card
  const activeCard = await prisma.fmvRateCard.findFirst({
    where: { status: "active" },
    select: { id: true },
  });
  if (!activeCard) return null;

  // Try state-level match first, then national fallback
  const rate = await prisma.fmvRate.findFirst({
    where: {
      rateCardId: activeCard.id,
      nuccCode,
      engagementType,
      state: state,      // exact state match
    },
  });

  if (rate) return rate;

  // National fallback: state = null in the DB
  return prisma.fmvRate.findFirst({
    where: {
      rateCardId: activeCard.id,
      nuccCode,
      engagementType,
      state: null,
    },
  });
}
```

---

### Pattern 4: Engagement State Machine (named transitions only)

**What:** Each status transition is a separate Server Action. Uses Prisma `updateMany` with a `where` clause on current status as an atomic guard — the update only succeeds if the record is in the expected state.

**When to use:** `submitEngagement`, `approveEngagement`, `rejectEngagement`, `completeEngagement`.

```typescript
// actions/engagement.ts [VERIFIED pattern: Prisma $transaction docs, WebFetch 2026-05-08]
"use server";

export async function approveEngagement(
  engagementId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = await getEffectiveRolesForUser(user);
  assertRole(roles, ["compliance", "finance"]);

  const result = await prisma.$transaction(async (tx) => {
    // Guard: only update if currently submitted (atomic check + update)
    const updated = await tx.engagement.updateMany({
      where: { id: engagementId, status: "submitted" },
      data: {
        status: "approved",
        reviewedByClerkId: user.id,
        reviewedByName: user.fullName ?? "Unknown",
        reviewedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new Error("Engagement is not in submitted state");
    }

    await tx.engagementStatusHistory.create({
      data: {
        engagementId,
        status: "approved",
        actorClerkId: user.id,
        actorName: user.fullName ?? "Unknown",
      },
    });

    return { success: true };
  });

  revalidatePath(`/engagements/${engagementId}`);
  return result;
}
```

**Valid state transitions:**
```
Draft  ──submit──→  Submitted  ──approve──→  Approved  ──complete──→  Completed
                               └──reject──→  Rejected  (terminal)
Draft  ──delete──→  (deleted)
```
No other transitions are permitted. Actions that receive a record in the wrong state return `{ success: false, error: "..." }` (never throw to the client).

---

### Pattern 5: HCP Search API Route (for Popover)

**What:** GET endpoint that returns up to 8 HCPs matching a name/NPI query. Client component calls this with a 300 ms debounce.

**Why API Route not Server Action:** Server Actions are designed for mutations (POST). A search endpoint is a read-only query that benefits from caching semantics, follows the existing `/api/nppes` pattern, and is simpler to call from a `useEffect` with `fetch()`.

```typescript
// app/api/hcps/search/route.ts [VERIFIED: matches /api/nppes pattern in codebase]
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const hcps = await prisma.hcp.findMany({
    where: {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { npi: { startsWith: q } },
      ],
    },
    select: { id: true, fullName: true, npi: true, nuccDisplayName: true, primaryState: true, status: true },
    take: 8,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ results: hcps });
}
```

**Client debounce pattern:**
```typescript
// components/engagement/HcpSearchInput.tsx (Client Component)
"use client";
import { useState, useEffect, useRef } from "react";

export function HcpSearchInput({ onSelect }: { onSelect: (hcp: HcpResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HcpResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/hcps/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // ... render Popover with results
}
```

---

### Pattern 6: Rate Card Activation (atomic version transition)

**What:** Activating a new rate card sets its `effectiveFrom` and marks the prior active card's `effectiveTo` in a single Prisma transaction.

```typescript
// actions/fmv.ts [VERIFIED: Prisma $transaction pattern]
export async function activateRateCard(rateCardId: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Close the currently active card (if any)
    await tx.fmvRateCard.updateMany({
      where: { status: "active" },
      data: { status: "superseded", effectiveTo: now },
    });

    // Activate the new card
    const updated = await tx.fmvRateCard.updateMany({
      where: { id: rateCardId, status: "pending" },
      data: { status: "active", effectiveFrom: now },
    });

    if (updated.count === 0) {
      throw new Error("Rate card not found or not in pending state");
    }
  });
}
```

---

### Pattern 7: Prisma Schema Additions

**What:** New tables for Phase 2. Extends the existing `prisma/schema.prisma`.

```prisma
// New enums
enum FmvRateCardStatus {
  pending
  active
  superseded
}

enum RateUnit {
  per_hour
  per_day
  per_event
  flat_fee
}

enum EngagementType {
  advisory_board
  speaker_program
  investigator_research
  meal_tov
  training
}

enum EngagementStatus {
  draft
  submitted
  approved
  rejected
  completed
}

// NuccTaxonomy — pre-seeded reference table (same pattern as OigLeieRecord)
model NuccTaxonomy {
  id              String   @id @default(cuid())
  code            String   @unique  // 10-char NUCC taxonomy code
  grouping        String?
  classification  String?
  specialization  String?
  displayName     String   // Derived at seed time: "Classification — Specialization" or Grouping

  @@index([code])
}

// FmvRateCard — one record per uploaded version
model FmvRateCard {
  id              String             @id @default(cuid())
  version         Int                // Sequential: 1, 2, 3...
  status          FmvRateCardStatus  @default(pending)
  uploadedByClerkId String
  uploadedByName  String
  effectiveFrom   DateTime?          // Set at activation
  effectiveTo     DateTime?          // Set when superseded
  rowCount        Int                @default(0)
  createdAt       DateTime           @default(now())

  rates           FmvRate[]

  @@index([status])
}

// FmvRate — individual rows of a rate card version
model FmvRate {
  id             String        @id @default(cuid())
  rateCardId     String
  nuccCode       String        // FK-like but not constrained (NUCC code validated at upload)
  nuccDisplayName String       // Resolved at parse time for display
  state          String?       // 2-letter abbreviation; null = national
  engagementType EngagementType
  rateUsd        Decimal       @db.Decimal(10, 2)
  rateUnit       RateUnit

  rateCard       FmvRateCard   @relation(fields: [rateCardId], references: [id], onDelete: Cascade)

  @@index([rateCardId])
  @@index([rateCardId, nuccCode, engagementType, state])
}

// Engagement — one per engagement request
model Engagement {
  id                  String           @id @default(cuid())
  hcpId               String
  engagementType      EngagementType
  status              EngagementStatus @default(draft)
  proposedDate        DateTime
  compensationUsd     Decimal          @db.Decimal(10, 2)
  description         String           // Min 20 chars enforced at app layer
  submittedByClerkId  String
  submittedByName     String
  reviewedByClerkId   String?          // Set on approve/reject
  reviewedByName      String?
  reviewedAt          DateTime?
  rejectionReason     String?          // Required when status = rejected
  completedAt         DateTime?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  hcp                 Hcp              @relation(fields: [hcpId], references: [id])
  statusHistory       EngagementStatusHistory[]

  @@index([status])
  @@index([submittedByClerkId])
  @@index([hcpId])
}

// EngagementStatusHistory — append-only transition log
model EngagementStatusHistory {
  id             String           @id @default(cuid())
  engagementId   String
  status         EngagementStatus
  actorClerkId   String
  actorName      String
  reason         String?          // For rejection events
  createdAt      DateTime         @default(now())

  engagement     Engagement       @relation(fields: [engagementId], references: [id], onDelete: Cascade)

  @@index([engagementId])
}
```

**Notes on schema design:**
- `Hcp` model needs a new relation field: `engagements Engagement[]` added to the existing `Hcp` model [VERIFIED: existing schema has no such relation yet]
- `FmvRate.nuccCode` is a string match against `NuccTaxonomy.code` — not a DB foreign key. Validation happens at upload time in the Server Action. This avoids cascade issues if taxonomy codes are ever refreshed.
- `Decimal` type for monetary values avoids IEEE 754 float rounding errors [ASSUMED — standard practice for financial data in PostgreSQL/Prisma]
- `EngagementStatus` enum intentionally omits `under_review` and `contracted` — those are ENG-V2-04 states, deferred to v2

---

### Anti-Patterns to Avoid

- **Client-side SheetJS parsing:** Never parse Excel in the browser for this application. The file contains compliance-sensitive rate data; validation must happen server-side where DB lookups are available. [VERIFIED: required by D-02]
- **Direct status field updates:** Never do `prisma.engagement.update({ data: { status: "approved" } })` directly. Always go through a named transition action with the `updateMany where status=expected` guard. [VERIFIED: CLAUDE.md architecture rule — "Engagement state machine — only named transitions permitted"]
- **Storing the raw uploaded file:** D-06 explicitly prohibits this. Only parsed rows are persisted.
- **Activation without preview:** The wizard step pattern (parse → review → explicit activate) is a compliance requirement (FMV-01/FMV-02). Never auto-activate on upload.
- **Floating point for currency:** Use `Decimal` in Prisma and `number` as input; format with `toFixed(2)` at display. Never use `float` for `rateUsd` or `compensationUsd`.
- **Business user accessing all engagements:** The engagement list query must add `where: { submittedByClerkId: userId }` for business users. This is a server-side filter on the Server Component, not a UI filter.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel/CSV parsing | Custom binary parser | SheetJS `XLSX.read(buffer)` | SheetJS handles BIFF8 (.xls), OOXML (.xlsx), and CSV in one API; edge cases in format variants are handled |
| Monetary arithmetic | Float arithmetic | `Decimal` type in Prisma + format at display | IEEE 754 float rounding accumulates errors in financial data |
| File type validation | MIME type header check | Accept attribute + SheetJS parse failure catch | MIME type is spoofable; SheetJS throws a readable error if the file is not a valid workbook |
| State machine library | xstate, robot | Inline `updateMany where status=` guard | 4 states, 5 transitions — the pattern fits in a single file without ceremony |
| Debounce utility | Custom debounce hook | `setTimeout` + `clearTimeout` in `useEffect` | No additional dependency needed; `use-debounce` package adds 1KB for no benefit at this scale |

**Key insight:** SheetJS is the only genuinely novel library in this phase. Everything else builds on Prisma + Next.js patterns already established in Phase 1.

---

## Common Pitfalls

### Pitfall 1: SheetJS not installed (npm registry version is stale)

**What goes wrong:** Running `npm install xlsx` installs version 0.18.5 from the npm registry, which is outdated, unmaintained, and contains known CVEs (Prototype Pollution, DoS).

**Why it happens:** SheetJS stopped publishing to npm; the CDN at `cdn.sheetjs.com` is the authoritative source for 0.20.x.

**How to avoid:** Install from CDN:
```bash
npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

**Warning signs:** `npm list xlsx` shows `0.18.5` or `npm audit` reports SheetJS vulnerabilities.

---

### Pitfall 2: Next.js Server Action 1 MB body size limit

**What goes wrong:** Upload of an Excel file larger than 1 MB silently fails or returns a 413 error with no useful message to the user.

**Why it happens:** Next.js Server Actions default to a 1 MB body limit (documented at next.config.js serverActions). A 200-row rate card in .xlsx can exceed 1 MB.

**How to avoid:** Set `experimental.serverActions.bodySizeLimit: '5mb'` in `next.config.ts` before Phase 2 work starts. [VERIFIED: nextjs.org docs WebFetch 2026-05-08]

**Warning signs:** Upload works for small test files but fails silently for real rate cards.

---

### Pitfall 3: NUCC code case sensitivity

**What goes wrong:** A rate card contains codes like `207Q00000X` but the seed table stores them as-is from the NUCC CSV. If any case transformation occurs during parse, lookups fail and rows are incorrectly marked `unrecognized`.

**Why it happens:** SheetJS `sheet_to_json` with `raw: false` returns string values as-is. If the uploader entered lowercase, the lookup fails.

**How to avoid:** Normalize both sides to uppercase on write and lookup:
```typescript
// In fmv-parser.ts
const code = String(row["specialty_code"] ?? "").trim().toUpperCase();
// In NuccTaxonomy seed
code: row.Code.trim().toUpperCase()
```

**Warning signs:** "Unrecognized" status on codes that exist in the taxonomy table.

---

### Pitfall 4: Race condition on rate card activation

**What goes wrong:** Two Compliance users simultaneously click "Activate" on different pending rate cards, resulting in two active cards simultaneously.

**Why it happens:** If activation is not wrapped in a transaction, the `updateMany(where: active)` and the new `update(status: active)` can interleave.

**How to avoid:** The activation action must use a single Prisma `$transaction`. The `updateMany(where: status=active)` and new card activation happen atomically. [VERIFIED: Prisma $transaction docs]

**Warning signs:** More than one `FmvRateCard` with `status = "active"` in the database.

---

### Pitfall 5: Business user accessing other users' engagements

**What goes wrong:** Business user navigates directly to `/engagements/[id]` of another user's engagement and can see or act on it.

**Why it happens:** The route guard only checks authentication, not ownership.

**How to avoid:** In the Engagement detail Server Component and all write actions, check `submittedByClerkId === userId` for Business users. Return a 404 (not 403) so the record's existence is not leaked. [VERIFIED: UI-SPEC Screen 7 interaction contract]

**Warning signs:** Business user sees engagements they did not create.

---

### Pitfall 6: FMV rate lookup finds multiple matches

**What goes wrong:** A rate card has both a state-level and a national rate for the same specialty + engagement type. The lookup returns both (or the wrong one).

**Why it happens:** `findFirst` without a consistent ordering can return either row depending on DB internals.

**How to avoid:** Always do two sequential lookups (state-first, then national fallback) as in Pattern 3 above — not a single `findMany` with `orderBy`. [VERIFIED: D-01 decision]

**Warning signs:** Rate panel shows a national rate even when a state-specific rate exists.

---

### Pitfall 7: Engagement form "Submit" from the detail page needs same validation as new form

**What goes wrong:** A saved Draft is submitted from the detail page without full validation, resulting in incomplete records.

**Why it happens:** Two submission paths (New Engagement form and Engagement Detail action panel) if each has its own validation.

**How to avoid:** Extract validation into a shared `lib/engagement-validation.ts` module (same pattern as `lib/hcp-validation.ts`). Both the `createEngagementAction` and `submitEngagementAction` call the same validators. [VERIFIED: established Phase 1 pattern]

---

## Code Examples

### SheetJS: parse multipart upload, return rows

```typescript
// lib/fmv-parser.ts
// Source: SheetJS docs.sheetjs.com/docs/getting-started/installation/nodejs/ [VERIFIED]
import * as XLSX from "xlsx";

export interface ParsedRateRow {
  specialty_code: string;
  state: string | null;
  engagement_type: string;
  rate_usd: number;
  rate_unit: string;
  rowIndex: number;
}

export function parseRateCardBuffer(buffer: Buffer): ParsedRateRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: false,
  });

  return rawRows.map((row, i) => ({
    specialty_code: String(row["specialty_code"] ?? "").trim().toUpperCase(),
    state: row["state"] ? String(row["state"]).trim().toUpperCase() : null,
    engagement_type: String(row["engagement_type"] ?? "").trim().toLowerCase(),
    rate_usd: parseFloat(String(row["rate_usd"] ?? "0")),
    rate_unit: String(row["rate_unit"] ?? "").trim().toLowerCase(),
    rowIndex: i + 2, // 1-based row number (row 1 is header)
  }));
}
```

### Prisma: conditional engagement transition (approveEngagement)

```typescript
// Source: Prisma transactions docs [VERIFIED: WebFetch prisma.io/docs/orm/prisma-client/queries/transactions]
await prisma.$transaction(async (tx) => {
  const updated = await tx.engagement.updateMany({
    where: { id: engagementId, status: "submitted" },
    data: { status: "approved", reviewedByClerkId: user.id, reviewedByName: user.fullName ?? "" },
  });
  if (updated.count === 0) throw new Error("Not in submitted state");

  await tx.engagementStatusHistory.create({
    data: { engagementId, status: "approved", actorClerkId: user.id, actorName: user.fullName ?? "" },
  });
});
```

### FMV rate lookup with national fallback

```typescript
// lib/fmv-lookup.ts — two-step lookup, state-first [ASSUMED pattern from D-01]
const stateRate = await prisma.fmvRate.findFirst({
  where: { rateCardId: activeCardId, nuccCode, engagementType, state },
});
if (stateRate) return stateRate;
return prisma.fmvRate.findFirst({
  where: { rateCardId: activeCardId, nuccCode, engagementType, state: null },
});
```

### Route permissions update (lib/auth.ts)

```typescript
// Extend ROUTE_PERMISSIONS to cover new routes [VERIFIED: existing lib/auth.ts pattern]
export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  "/hcps": ["business", "compliance"],
  "/hcps/new": ["business", "compliance"],
  "/dashboard": ["finance"],
  "/fmv": ["compliance"],
  "/fmv/upload": ["compliance"],
  "/engagements": ["business", "compliance", "finance"],
  "/engagements/new": ["business", "compliance"],
  "/engagements/queue": ["compliance", "finance"],
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `XLSX.readFile(path)` (write to disk first) | `XLSX.read(buffer, { type: "buffer" })` (in-memory) | SheetJS 0.17+ | No temp file needed; works in serverless |
| `serverComponentsExternalPackages` (Next.js 14 name) | `serverExternalPackages` (Next.js 15) | Next.js 15 GA | Config key renamed; SheetJS may not need it if using buffer-only API |
| Server Action body size: 1 MB default (hardcoded) | Configurable via `experimental.serverActions.bodySizeLimit` | Next.js 14.1+ | Must be set for file uploads > 1 MB |
| Combobox via Popover + Command components (old shadcn) | New `Combobox` component (built on Base UI) | shadcn 4.x | Use `npx shadcn@latest add combobox`; different component API than the old Popover+Command pattern |

**Deprecated/outdated:**
- `XLSX.readFile()` server-side: Still works but requires disk I/O; buffer approach is preferred for serverless/edge
- Old shadcn combobox pattern (Popover + Command): The new `Combobox` component from shadcn 4.x uses Base UI; both approaches work but the new component is the current recommendation

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | NUCC taxonomy codes from NPPES HCP records are public domain and can be seeded without a commercial license | Pattern 2 (NUCC seed) | May need to restrict seed to only codes already seen in HCP records, or obtain NUCC license |
| A2 | `Decimal` type in Prisma maps to PostgreSQL `numeric(10,2)` and avoids float rounding | Pattern 7 (schema) | Minor: use `Float` + application-layer rounding as fallback; financial data still correct at 2dp |
| A3 | Two-step sequential lookup (state-first, then national) is race-condition-safe in PostgreSQL read-committed isolation | Pattern 3 (FMV lookup) | No write race (rate card is immutable once active); read-only lookup is always consistent |
| A4 | `shadcn add combobox` (new Base UI-based version) works with this project's existing `@base-ui/react` dependency | Standard Stack | If incompatible, fall back to the Popover + Command manual composition pattern |
| A5 | `date-fns` `formatRelative` or `formatDistanceToNow` is sufficient for "3 hours ago" display in engagement list | Architecture Patterns | Minor: swap to `intl.RelativeTimeFormat` if date-fns formatting is wrong locale |

---

## Open Questions

1. **NUCC seed data volume**
   - What we know: Full NUCC taxonomy v25.1 has ~900 codes. Pharma-relevant codes (physicians, nurses, advanced practitioners) are ~150–200.
   - What's unclear: Does the client need all 900 codes or only physician/NP/PA specialties? A 900-row seed is fine for dev; for demo it may be noise.
   - Recommendation: Seed the 20–30 most common pharma engagement specialties as fixture data; add a comment in seed.ts noting the full dataset can replace it.

2. **Rate card CSV column name tolerance**
   - What we know: D-02 specifies column names as `specialty_code | state | engagement_type | rate_usd | rate_unit`.
   - What's unclear: Will real client rate cards use these exact names or common variants (e.g., "Specialty Code", "specialty", "State/Region")?
   - Recommendation: Normalize column names to lowercase + underscores during parse (replace spaces with underscores, strip special chars) so `"Specialty Code"` matches `"specialty_code"`. Add as a note in the upload wizard.

3. **Prisma `Decimal` precision in JS client**
   - What we know: Prisma returns `Decimal` as a special Decimal.js object, not a JS `number`.
   - What's unclear: Are there any display utilities already in the project for formatting currency?
   - Recommendation: Add a `formatCurrency(value: Decimal | number): string` helper to `lib/utils.ts` using `.toFixed(2)` with a `$` prefix.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | SheetJS Buffer parsing | ✓ | v24.15.0 | — |
| PostgreSQL (Neon) | All Prisma queries | ✓ (via DATABASE_URL) | 16 | — |
| npm | SheetJS CDN install | ✓ | 11.12.1 | — |
| SheetJS xlsx 0.20.3 | FMV rate card parsing | ✗ (not yet installed) | — | Must install before Wave 1 |
| shadcn Skeleton | FMV reference panel | ✗ (not yet added) | — | Must add before engagement form Wave |
| shadcn AlertDialog | Delete draft modal | ✗ (not yet added) | — | Must add before engagement detail Wave |
| shadcn Combobox | HCP search popover | ✗ (not yet added) | — | Must add before engagement form Wave |

**Missing dependencies with no fallback:**
- SheetJS 0.20.3 — blocks all rate card parsing. Install in Wave 0 or Wave 1 before any FMV actions.

**Missing dependencies with fallback:**
- shadcn Skeleton, AlertDialog, Combobox — added via `npx shadcn@latest add` as needed per wave. Not blocking until the specific UI component is built.

---

## Validation Architecture

> `workflow.nyquist_validation = true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 + ts-jest 29.4.9 |
| Config file | `jest.config.ts` (exists — `ts-jest` preset, `node` environment) |
| Quick run command | `npm test` |
| Full suite command | `npm test -- --runInBand` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FMV-01 | `parseRateCardBuffer` parses valid .xlsx rows, rejects rows with bad column structure | unit | `npm test -- --testPathPattern=fmv-parser` | ❌ Wave 0 |
| FMV-02 | NUCC validation returns `valid`/`unrecognized` per row; activation blocked if any `unrecognized` | unit | `npm test -- --testPathPattern=fmv-parser` | ❌ Wave 0 |
| FMV-03 | Activating a rate card sets prior card `status=superseded` + `effectiveTo`; new card `status=active` | unit (mock prisma tx) | `npm test -- --testPathPattern=fmv` | ❌ Wave 0 |
| FMV-04 | `getFmvRate()` returns state-level rate when both state and national exist; returns national when state has no match; returns null when no active card | unit | `npm test -- --testPathPattern=fmv-lookup` | ❌ Wave 0 |
| FMV-05 | Rate card version list query returns all versions ordered by `createdAt desc` | manual/visual | — | manual |
| ENG-01 | `createEngagement` with each of 5 engagement types succeeds; invalid type rejected | unit | `npm test -- --testPathPattern=engagement` | ❌ Wave 0 |
| ENG-02 | Each named transition only succeeds from the valid prior state; all other states rejected | unit | `npm test -- --testPathPattern=engagement` | ❌ Wave 0 |
| ENG-03 | `rejectEngagement` requires reason >= 10 chars; `approveEngagement` only accessible to compliance/finance roles | unit | `npm test -- --testPathPattern=engagement` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test` (full suite runs in < 10 s at this test count)
- **Per wave merge:** `npm test -- --runInBand`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `lib/fmv-parser.test.ts` — covers FMV-01, FMV-02 (pure function tests, no Prisma needed)
- [ ] `lib/fmv-lookup.test.ts` — covers FMV-04 (pure function with mocked Prisma client)
- [ ] `actions/fmv.test.ts` — covers FMV-03 activation transaction (mock prisma)
- [ ] `lib/engagement-validation.test.ts` — covers ENG-01, ENG-02, ENG-03 validation rules
- [ ] `actions/engagement.test.ts` — covers state machine transition guards

*(All test files follow the pattern established in `actions/hcp.test.ts` and `lib/auth.test.ts` — pure function tests with no DB required. Prisma interactions are tested via validation helpers, not the raw actions.)*

---

## Security Domain

> `security_enforcement` not set in config — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Clerk (established Phase 1) |
| V3 Session Management | yes | Clerk (established Phase 1) |
| V4 Access Control | yes | `assertRole()` in every write action; role-scoped DB queries for reads |
| V5 Input Validation | yes | `lib/engagement-validation.ts` + `lib/fmv-parser.ts` pure validators; all user input validated server-side before DB write |
| V6 Cryptography | no | No new cryptographic operations in Phase 2 |

### Known Threat Patterns for Phase 2 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized engagement approval (cross-role) | Elevation of Privilege | `assertRole(["compliance", "finance"])` in approve/reject actions; never rely on client-side role check |
| Business user accessing another user's engagement | Information Disclosure | Server-side `submittedByClerkId === userId` check; return 404 not 403 |
| Malformed Excel file (XXE, formula injection) | Tampering | SheetJS does not evaluate formulas by default; `raw: false` in `sheet_to_json` returns string values; no dynamic formula execution |
| Race condition on rate card activation | Tampering | Prisma `$transaction` makes close-prior + activate-new atomic |
| Invalid state transition bypassing status machine | Tampering | `updateMany where status=expectedState` guard — update returns 0 rows if state is wrong; error returned to client |
| File upload exceeding size limit (DoS) | Denial of Service | Client-side 5 MB check + `bodySizeLimit: '5mb'` in next.config.ts |
| Insecure direct object reference (engagement ID in URL) | Information Disclosure | Every engagement query scoped by auth + ownership for Business users |

---

## Sources

### Primary (HIGH confidence)

- Official Next.js docs `nextjs.org/docs/app/api-reference/config/next-config-js/serverActions` — bodySizeLimit configuration verified via WebFetch 2026-05-08
- Official SheetJS docs `docs.sheetjs.com/docs/getting-started/installation/nodejs/` — Buffer parse pattern and install command verified via WebFetch 2026-05-08
- Official Prisma docs `prisma.io/docs/orm/prisma-client/queries/transactions` — `$transaction` interactive transaction pattern verified via WebFetch 2026-05-08
- NUCC taxonomy CSV `nucc.org/images/stories/CSV/nucc_taxonomy_190.csv` — column structure (Code, Grouping, Classification, Specialization, Definition, Notes) verified via WebFetch 2026-05-08
- Existing codebase at `C:/Users/HP/HCP_Engage` — Phase 1 patterns (actions/, lib/, auth.ts, seed.ts, API routes) verified via direct file read

### Secondary (MEDIUM confidence)

- shadcn/ui Combobox docs `ui.shadcn.com/docs/components/radix/combobox` — new Base UI-based Combobox component verified via WebFetch 2026-05-08; install command confirmed
- shadcn/ui Popover docs — sub-components confirmed via WebFetch 2026-05-08
- SheetJS CDN — version 0.20.3 confirmed as current via WebSearch 2026-05-08

### Tertiary (LOW confidence — assumptions)

- NUCC taxonomy licensing terms for pharma compliance tools — not verified; marked [ASSUMED] (A1)
- `Decimal` → PostgreSQL `numeric(10,2)` behavior — standard Prisma behavior; not re-verified in this session (A2)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all versions verified via npm list, official docs, WebFetch
- Architecture: HIGH — all patterns derived from existing Phase 1 codebase + official docs
- Pitfalls: HIGH (SheetJS install, body limit, state machine guard) / MEDIUM (race condition, business user scope — verified but edge cases may exist)
- NUCC licensing: LOW — [ASSUMED]; requires legal review before seeding full dataset

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (30 days — stack is stable; SheetJS version pinned at 0.20.3 from CDN)
