# Phase 2: FMV + Engagement - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 26 (21 new + 5 modified)
**Analogs found:** 25 / 26

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `actions/fmv.ts` | service/action | CRUD + file-I/O | `actions/debarment.ts` | role-match |
| `actions/engagement.ts` | service/action | CRUD + event-driven | `actions/hcp.ts` | role-match |
| `lib/fmv-parser.ts` | utility | transform | `lib/debarment.ts` (normalizeName, matchOigRecord) | role-match |
| `lib/fmv-lookup.ts` | utility | request-response | `lib/nppes.ts` (mapNppesResult + fetchNppesHcp) | role-match |
| `lib/engagement-validation.ts` | utility | transform | `lib/hcp-validation.ts` | exact |
| `app/(app)/fmv/page.tsx` | page (Server Component) | request-response | `app/(app)/hcps/page.tsx` | exact |
| `app/(app)/fmv/upload/page.tsx` | page (Client Component) | file-I/O | `app/(app)/hcps/new/page.tsx` + `components/hcp/NpiLookupForm.tsx` | role-match |
| `app/(app)/fmv/[id]/page.tsx` | page (Server Component) | request-response | `app/(app)/hcps/[id]/page.tsx` | exact |
| `app/(app)/engagements/page.tsx` | page (Server Component) | request-response | `app/(app)/hcps/page.tsx` | exact |
| `app/(app)/engagements/new/page.tsx` | page (Client Component) | request-response | `app/(app)/hcps/new/page.tsx` | role-match |
| `app/(app)/engagements/queue/page.tsx` | page (Server Component) | request-response | `app/(app)/hcps/page.tsx` | role-match |
| `app/(app)/engagements/[id]/page.tsx` | page (Server Component) | request-response | `app/(app)/hcps/[id]/page.tsx` | exact |
| `app/api/hcps/search/route.ts` | API route | request-response | `app/api/hcps/exists/route.ts` | exact |
| `app/api/fmv/rate/route.ts` | API route | request-response | `app/api/nppes/route.ts` | exact |
| `components/fmv/RateCardTable.tsx` | component | transform | `components/hcp/HcpTable.tsx` | role-match |
| `components/fmv/FmvRatePanel.tsx` | component | request-response | `components/hcp/DebarmentCheckPanel.tsx` (card panel) | role-match |
| `components/engagement/EngagementStatusBadge.tsx` | component | transform | `components/hcp/HcpStatusBadge.tsx` | exact |
| `components/engagement/EngagementTable.tsx` | component | transform | `components/hcp/HcpTable.tsx` | exact |
| `components/engagement/EngagementForm.tsx` | component | request-response | `components/hcp/HcpStatusPanel.tsx` | role-match |
| `components/engagement/HcpSearchInput.tsx` | component | request-response | `components/hcp/NpiLookupForm.tsx` | role-match |
| `components/engagement/ActionPanel.tsx` | component | event-driven | `components/hcp/HcpStatusPanel.tsx` | role-match |
| `prisma/schema.prisma` | config | — | existing `prisma/schema.prisma` | exact (extension) |
| `prisma/seed.ts` | config | batch | existing `prisma/seed.ts` | exact (extension) |
| `lib/auth.ts` | config | — | existing `lib/auth.ts` | exact (extension) |
| `next.config.ts` | config | — | existing `next.config.ts` | exact (extension) |
| `components/shell/Sidebar.tsx` | component | — | existing `components/shell/Sidebar.tsx` | exact (extension) |

---

## Pattern Assignments

### `actions/fmv.ts` (service/action, file-I/O + CRUD)

**Analog:** `actions/debarment.ts` (role guard + `prisma.$transaction` + `revalidatePath` pattern)

**Imports pattern** (lines 1-6 of `actions/debarment.ts`):
```typescript
"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { runDebarmentCheck } from "@/lib/debarment";
```

**For `actions/fmv.ts`, adapt to:**
```typescript
"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseRateCardBuffer } from "@/lib/fmv-parser";
import { getEffectiveRoles, assertRole } from "@/lib/auth";
```

**Role guard pattern** (lines 20-26 of `actions/debarment.ts`):
```typescript
const user = await currentUser();
if (!user) return { success: false, error: "Unauthorized" };

const role = (user.publicMetadata as { role?: string }).role;
if (role !== "compliance") {
  return { success: false, error: "Forbidden: only Compliance users can run debarment checks" };
}
```

**Atomic transaction pattern** (lines 41-61 of `actions/debarment.ts`):
```typescript
const [check] = await prisma.$transaction([
  prisma.debarmentCheck.create({
    data: {
      hcpId,
      checkedByClerkId: user.id,
      checkedByName: user.fullName ?? "Unknown",
      // ...
    },
  }),
  prisma.hcp.update({
    where: { id: hcpId },
    data: { debarmentCheckedAt: new Date(), debarmentStatus: hasHit ? "hit" : "clear" },
  }),
]);

revalidatePath(`/hcps/${hcpId}`);
return { success: true, checkId: check.id };
```

**Error handling pattern** (lines 64-71 of `actions/debarment.ts`):
```typescript
} catch (error) {
  console.error("Debarment check failed:", error);
  return {
    success: false,
    error: "Debarment check failed. Try again or contact your system administrator.",
  };
}
```

**Return type convention** — all actions return `{ success: boolean; error?: string }`. Never throw to the client.

---

### `actions/engagement.ts` (service/action, CRUD + event-driven)

**Analog:** `actions/hcp.ts` (Prisma create + role guard) AND `actions/debarment.ts` (transaction + error handling)

**Imports pattern** (lines 1-8 of `actions/hcp.ts`):
```typescript
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Hcp, Prisma } from "@prisma/client";
```

**For `actions/engagement.ts`, adapt to:**
```typescript
"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles, assertRole } from "@/lib/auth";
import { validateEngagementFields } from "@/lib/engagement-validation";
```

**Role guard with `getEffectiveRoles` pattern** (lines 39-46 of `actions/hcp.ts`):
```typescript
const user = await currentUser();
if (!user) throw new Error("Unauthorized");

const role = (user.publicMetadata as { role?: string }).role;
if (role !== "business" && role !== "compliance") {
  throw new Error("Forbidden: only Business and Compliance users can add HCPs");
}
```

**For engagement actions use `assertRole` from `lib/auth.ts` instead** (lines 66-73 of `lib/auth.ts`):
```typescript
export function assertRole(effectiveRoles: AppRole[], requiredRoles: AppRole[]): void {
  const hasRole = effectiveRoles.some((r) => requiredRoles.includes(r));
  if (!hasRole) {
    throw new Error(
      `Access denied. Required roles: ${requiredRoles.join(", ")}. User has: ${effectiveRoles.join(", ")}`
    );
  }
}
```

**Prisma create pattern** (lines 41-58 of `actions/hcp.ts`):
```typescript
const hcp = await prisma.hcp.create({
  data: {
    npi: nppesData.npi,
    // ... fields
    addedByClerkId: user.id,
    addedByName: user.fullName ?? "Unknown",
  },
});
return { id: hcp.id };
```

**State machine transition with `updateMany` guard** — use this pattern for submit/approve/reject/complete (from RESEARCH.md Pattern 4):
```typescript
await prisma.$transaction(async (tx) => {
  const updated = await tx.engagement.updateMany({
    where: { id: engagementId, status: "submitted" },  // atomic status guard
    data: { status: "approved", reviewedByClerkId: user.id, reviewedByName: user.fullName ?? "" },
  });
  if (updated.count === 0) throw new Error("Engagement is not in submitted state");

  await tx.engagementStatusHistory.create({
    data: { engagementId, status: "approved", actorClerkId: user.id, actorName: user.fullName ?? "" },
  });
});
revalidatePath(`/engagements/${engagementId}`);
```

---

### `lib/fmv-parser.ts` (utility, transform)

**Analog:** `lib/debarment.ts` — pure functions with typed interfaces; no "use server"; no DB imports

**Interface + pure function pattern** (lines 1-24 of `lib/debarment.ts`):
```typescript
import { prisma } from "@/lib/prisma";

export interface DebarmentResult {
  oigHit: boolean;
  samHit: boolean;
  oigMatch: { ... } | null;
  samMatch: { ... } | null;
}

export function normalizeName(name: string): string {
  return name.trim().toUpperCase();
}
```

**For `lib/fmv-parser.ts` — same pure-function module shape, no "use server":**
```typescript
import * as XLSX from "xlsx";

export interface ParsedRateRow {
  specialty_code: string;
  state: string | null;
  engagement_type: string;
  rate_usd: number;
  rate_unit: string;
  rowIndex: number;
}

export interface ValidatedRateRow extends ParsedRateRow {
  nuccValid: boolean;
  nuccDisplayName: string | null;
}

export function parseRateCardBuffer(buffer: Buffer): ParsedRateRow[] {
  // ... SheetJS parse; normalize codes to uppercase
}
```

**No DB in this file** — NUCC validation is a separate step in the Server Action that calls this parser, then queries `NuccTaxonomy` using the returned codes.

---

### `lib/fmv-lookup.ts` (utility, request-response)

**Analog:** `lib/nppes.ts` — thin function wrapping an external call (here: wrapping a Prisma query). Pure interface, typed return.

**Interface-first pattern** (lines 1-11 of `lib/nppes.ts`):
```typescript
export interface NppesHcp {
  npi: string;
  firstName: string;
  // ...
}
```

**For `lib/fmv-lookup.ts`:**
```typescript
// No "use server" — pure async function, injectable Prisma client for testability
export async function getFmvRate(params: {
  nuccCode: string;
  state: string;
  engagementType: string;
  prisma: PrismaClient;
}): Promise<FmvRateResult | null>
```

Accept Prisma as a parameter (not importing from `@/lib/prisma` directly) so tests can inject a mock client — same testability approach used in `lib/debarment.test.ts`.

---

### `lib/engagement-validation.ts` (utility, transform)

**Analog:** `lib/hcp-validation.ts` — exact pattern match

**Complete file content of `lib/hcp-validation.ts`:**
```typescript
/**
 * Pure validation helpers for HCP server actions.
 * Exported as a standalone module (no "use server") for testability.
 */

export function validateSetStatusParams(params: {
  reason: string;
  currentStatus: string;
  newStatus: string;
}): { valid: boolean; error?: string } {
  if (params.reason.trim().length < 10) {
    return { valid: false, error: "Reason must be at least 10 characters." };
  }
  if (params.currentStatus === params.newStatus) {
    return {
      valid: false,
      error: `HCP is already ${params.newStatus.replace(/_/g, " ")}`,
    };
  }
  return { valid: true };
}
```

**`lib/engagement-validation.ts` must follow this exact shape:** no imports, no "use server", pure functions returning `{ valid: boolean; error?: string }`. One function per validation concern: `validateEngagementFields`, `validateRejectionReason`, `validateStateTransition`.

---

### `app/(app)/fmv/page.tsx` (page, Server Component, request-response)

**Analog:** `app/(app)/hcps/page.tsx` — exact pattern

**Full page pattern** (lines 1-82 of `app/(app)/hcps/page.tsx`):
```typescript
import { searchHcps } from "@/actions/hcp";
import { HcpTable } from "@/components/hcp/HcpTable";
// ...

export const metadata = { title: "HCP Directory — HCP Engage" };

export default async function HcpsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const page = parseInt(params.page ?? "1", 10);

  const { hcps, total } = await searchHcps({ query, page, pageSize: 20 });
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)]">HCP Directory</h1>
        // ...
      </div>
      // ... form + table + pagination
    </div>
  );
}
```

**Key conventions:**
- `searchParams` is typed as `Promise<{...}>` and awaited (Next.js 15 async searchParams)
- `metadata` export for `<title>`
- Default `async function` named after the page

---

### `app/(app)/fmv/upload/page.tsx` (page, Client Component, file-I/O)

**Analog:** `app/(app)/hcps/new/page.tsx` (thin Server Component wrapper) + `components/hcp/NpiLookupForm.tsx` (interactive Client Component inside)

**Thin Server Component wrapper pattern** (lines 1-15 of `app/(app)/hcps/new/page.tsx`):
```typescript
import { NpiLookupForm } from "@/components/hcp/NpiLookupForm";

export const metadata = { title: "Add HCP — HCP Engage" };

export default function NewHcpPage() {
  return (
    <div>
      <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)] mb-1">Add HCP</h1>
      <p className="text-[14px] text-[hsl(215_16%_47%)] mb-8">
        Search by NPI to pull verified HCP data from NPPES
      </p>
      <NpiLookupForm />
    </div>
  );
}
```

The upload wizard component follows the multi-step state machine pattern from `NpiLookupForm.tsx`:

**Multi-step state machine pattern** (lines 13-17 of `NpiLookupForm.tsx`):
```typescript
type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; hcp: NppesHcp; alreadyInSystem: boolean; existingId?: string }
  | { status: "not_found"; npi: string }
  | { status: "error"; message: string };
```

**For the FMV upload wizard:**
```typescript
type UploadState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "preview"; rows: ValidatedRateRow[]; hasErrors: boolean }
  | { status: "activating" }
  | { status: "done"; rateCardId: string }
  | { status: "error"; message: string };
```

**Fetch-then-render pattern** (lines 33-66 of `NpiLookupForm.tsx`):
```typescript
async function handleSearch(e: React.FormEvent) {
  e.preventDefault();
  setLookupState({ status: "loading" });
  try {
    const res = await fetch(`/api/nppes?npi=${npi}`);
    // ... handle response
  } catch {
    setLookupState({ status: "error", message: "..." });
  }
}
```

**`useTransition` for Server Action calls** (lines 68-74 of `NpiLookupForm.tsx`):
```typescript
function handleAdd() {
  if (lookupState.status !== "found") return;
  startTransition(async () => {
    const result = await addHcp(lookupState.hcp);
    router.push(`/hcps/${result.id}`);
  });
}
```

---

### `app/(app)/fmv/[id]/page.tsx` (page, Server Component, request-response)

**Analog:** `app/(app)/hcps/[id]/page.tsx` — exact pattern

**Dynamic route + notFound pattern** (lines 30-64 of `app/(app)/hcps/[id]/page.tsx`):
```typescript
export default async function HcpProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) notFound();

  // ... role resolution
  const hcp = await prisma.hcp.findUnique({
    where: { id },
    include: { statusHistory: { orderBy: { createdAt: "desc" } } },
  });

  if (!hcp) notFound();

  return (
    <div className="flex gap-8">
      {/* Left column (65%) */}
      <div className="flex-[65] min-w-0 space-y-6">
```

**`generateMetadata` pattern** (lines 13-28 of `app/(app)/hcps/[id]/page.tsx`):
```typescript
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hcp = await prisma.hcp.findUnique({ where: { id }, select: { fullName: true } });
  return {
    title: hcp ? `${hcp.fullName} — HCP Engage` : "HCP Not Found — HCP Engage",
  };
}
```

**Two-column layout** — `flex-[65]` left / `flex-[35]` right, `space-y-6` vertical rhythm with `Card` components.

---

### `app/(app)/engagements/page.tsx` (page, Server Component, request-response)

**Analog:** `app/(app)/hcps/page.tsx` — exact pattern

Same `searchParams: Promise<{...}>`, `metadata`, async data fetch + `EngagementTable` + pagination pattern. Add role-based query filter: Business users get `where: { submittedByClerkId: userId }`; Compliance/Finance see all.

---

### `app/(app)/engagements/new/page.tsx` (page, Client Component, request-response)

**Analog:** `app/(app)/hcps/new/page.tsx` (thin wrapper) + `HcpStatusPanel.tsx` (form with useTransition)

Same thin-wrapper pattern. The `EngagementForm` client component inside uses `useState` + `useTransition` + Server Action call — matching `HcpStatusPanel.tsx`.

---

### `app/(app)/engagements/queue/page.tsx` (page, Server Component, request-response)

**Analog:** `app/(app)/hcps/page.tsx`

Same Server Component page pattern. No search form. Query: `prisma.engagement.findMany({ where: { status: "submitted" }, orderBy: { createdAt: "asc" }, include: { hcp: true } })`.

---

### `app/(app)/engagements/[id]/page.tsx` (page, Server Component, request-response)

**Analog:** `app/(app)/hcps/[id]/page.tsx` — exact pattern

Same `generateMetadata`, `notFound()`, two-column layout with Cards. Right sidebar contains `ActionPanel` (Client Component) rendered conditionally based on `effectiveRoles` and `engagement.status` — mirrors how `HcpStatusPanel` is conditionally rendered on lines 196-202:

```typescript
{isCompliance && (
  <HcpStatusPanel
    hcpId={hcp.id}
    currentStatus={hcp.status}
  />
)}
```

Business user ownership check before render:
```typescript
// From RESEARCH.md Pitfall 5 — return 404 not 403
if (isBusinessRole && engagement.submittedByClerkId !== user.id) notFound();
```

---

### `app/api/hcps/search/route.ts` (API route, request-response)

**Analog:** `app/api/hcps/exists/route.ts` — exact pattern

**Full analog file** (all 18 lines of `app/api/hcps/exists/route.ts`):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const npi = request.nextUrl.searchParams.get("npi");
  if (!npi) return NextResponse.json({ error: "npi required" }, { status: 400 });

  const hcp = await prisma.hcp.findUnique({
    where: { npi },
    select: { id: true },
  });

  return NextResponse.json({ exists: !!hcp, id: hcp?.id ?? null });
}
```

**For `app/api/hcps/search/route.ts`:** swap `npi` param for `q`, change `findUnique` to `findMany` with OR filter, return `{ results: hcps }`. Auth guard `auth()` pattern is identical.

---

### `app/api/fmv/rate/route.ts` (API route, request-response)

**Analog:** `app/api/nppes/route.ts` — try/catch + 502 error pattern

**Full analog file** (all 30 lines of `app/api/nppes/route.ts`):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchNppesHcp } from "@/lib/nppes";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const npi = request.nextUrl.searchParams.get("npi");
  if (!npi) {
    return NextResponse.json({ error: "npi parameter required" }, { status: 400 });
  }

  try {
    const hcp = await fetchNppesHcp(npi);
    if (!hcp) {
      return NextResponse.json({ found: false }, { status: 200 });
    }
    return NextResponse.json({ found: true, hcp }, { status: 200 });
  } catch (error) {
    console.error("NPPES lookup error:", error);
    return NextResponse.json({ error: "NPPES lookup failed" }, { status: 502 });
  }
}
```

**For `app/api/fmv/rate/route.ts`:** same auth guard; params are `hcpId` + `type`; calls `getFmvRate()` from `lib/fmv-lookup.ts`; return `{ rate: FmvRateResult | null }`.

---

### `components/fmv/RateCardTable.tsx` (component, transform)

**Analog:** `components/hcp/HcpTable.tsx` — exact table pattern

**Imports + structure pattern** (lines 1-18 of `HcpTable.tsx`):
```typescript
"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { HcpStatusBadge } from "./HcpStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { HcpSearchResult } from "@/actions/hcp";
```

**Empty state + table pattern** (lines 20-43 of `HcpTable.tsx`):
```typescript
export function HcpTable({ hcps, emptyQuery }: { hcps: HcpSearchResult[]; emptyQuery?: string }) {
  if (hcps.length === 0) {
    return <EmptyState heading="No HCPs in your directory" body="..." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[22%] text-[12px] font-semibold">HCP Name</TableHead>
          // ...
        </TableRow>
      </TableHeader>
      <TableBody>
        {hcps.map((hcp, index) => (
          <TableRow key={hcp.id} className={`h-12 cursor-pointer ... ${index % 2 === 1 ? "bg-[hsl(0_0%_96%)]" : "bg-white"}`}>
```

**For `RateCardTable.tsx`:** same structure; columns are: row index, specialty code, NUCC display name, state, engagement type, rate USD, rate unit, NUCC validation badge (valid/unrecognized). No click navigation — it's a preview table.

---

### `components/fmv/FmvRatePanel.tsx` (component, request-response)

**Analog:** `components/ui/card.tsx` usage pattern from `app/(app)/hcps/[id]/page.tsx` (lines 91-139)

**Card read-only display pattern:**
```typescript
<Card>
  <CardHeader>
    <CardTitle className="text-[20px]">Verified HCP Data</CardTitle>
    <p className="text-[12px] text-[hsl(215_16%_47%)]">Source: NPPES — ...</p>
  </CardHeader>
  <CardContent>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
      <div>
        <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">NUCC Specialty</dt>
        <dd className="mt-0.5">{hcp.nuccDisplayName}</dd>
      </div>
```

`FmvRatePanel` is a Client Component that receives `hcpId` + `engagementType` props and calls `/api/fmv/rate` via `fetch` (triggered by `useEffect` on prop changes) to display the rate in a Card.

---

### `components/engagement/EngagementStatusBadge.tsx` (component, transform)

**Analog:** `components/hcp/HcpStatusBadge.tsx` — exact pattern

**Full analog file** (all 24 lines):
```typescript
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type HcpStatusValue = "active" | "inactive" | "suspended" | "do_not_engage";

const STATUS_CONFIG: Record<HcpStatusValue, { label: string; className: string }> = {
  active:        { label: "Active",        className: "bg-[hsl(142_71%_45%)] text-white border-transparent" },
  inactive:      { label: "Inactive",      className: "bg-[hsl(215_16%_63%)] text-white border-transparent" },
  suspended:     { label: "Suspended",     className: "bg-[hsl(38_92%_50%)] text-white border-transparent" },
  do_not_engage: { label: "Do Not Engage", className: "bg-[hsl(0_72%_51%)] text-white border-transparent" },
};

export function HcpStatusBadge({ status }: { status: HcpStatusValue }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.inactive;
  return (
    <Badge
      role="status"
      aria-label={`HCP status: ${config.label}`}
      className={cn("h-6 text-[12px] font-semibold", config.className)}
    >
      {config.label}
    </Badge>
  );
}
```

**For `EngagementStatusBadge.tsx`:** replace `HcpStatusValue` with `EngagementStatusValue = "draft" | "submitted" | "approved" | "rejected" | "completed"` and define the `STATUS_CONFIG` color map. Suggested colors:
- `draft` → `hsl(215_16%_63%)` (grey)
- `submitted` → `hsl(38_92%_50%)` (amber)
- `approved` → `hsl(142_71%_45%)` (green)
- `rejected` → `hsl(0_72%_51%)` (red)
- `completed` → `hsl(221_83%_53%)` (blue)

---

### `components/engagement/EngagementTable.tsx` (component, transform)

**Analog:** `components/hcp/HcpTable.tsx` — exact pattern

Copy the full structure. Columns: HCP name (link), engagement type, proposed date, compensation, status badge, submitter name, last updated. Same alternating row color, `h-12 cursor-pointer`, `EmptyState` fallback.

---

### `components/engagement/EngagementForm.tsx` (component, request-response)

**Analog:** `components/hcp/HcpStatusPanel.tsx` — Client Component with `useTransition` + Server Action call

**Full client form pattern** (lines 1-45 of `HcpStatusPanel.tsx`):
```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setHcpStatus } from "@/actions/hcp";
```

**State + validation + submit pattern** (lines 42-86 of `HcpStatusPanel.tsx`):
```typescript
const [isPending, startTransition] = useTransition();
const [selectedStatus, setSelectedStatus] = useState<StatusValue | "">("");
const [reason, setReason] = useState("");
const [error, setError] = useState<string | null>(null);

const isValid = selectedStatus !== "" && reasonLength >= 10 && !isSameStatus;

function handleSave() {
  if (!isValid || !selectedStatus) return;
  setError(null);
  startTransition(async () => {
    const result = await setHcpStatus({ hcpId, status: selectedStatus, reason });
    if (!result.success) {
      setError(result.error ?? "Status could not be saved.");
    } else {
      setSelectedStatus("");
      setReason("");
      router.refresh();
    }
  });
}
```

**Spinner in button pattern** (lines 185-194 of `HcpStatusPanel.tsx`):
```typescript
{isPending ? (
  <>
    <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
    Saving...
  </>
) : (
  "Set Status"
)}
```

---

### `components/engagement/HcpSearchInput.tsx` (component, request-response)

**Analog:** `components/hcp/NpiLookupForm.tsx` — Client Component with `fetch` + state machine

**Debounce with `useEffect` + `useRef`** (derive from `NpiLookupForm.tsx` pattern, lines 32-66):
```typescript
// NpiLookupForm uses synchronous search on submit; HcpSearchInput uses debounce on keystroke
// Pattern: useRef for debounce timer, useEffect on query change
import { useState, useEffect, useRef } from "react";

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
```

**Error display pattern** (lines 113-120 of `NpiLookupForm.tsx`):
```typescript
{lookupState.status === "error" && (
  <p className="mt-3 text-[14px] text-[hsl(0_72%_51%)]">{lookupState.message}</p>
)}
```

---

### `components/engagement/ActionPanel.tsx` (component, event-driven)

**Analog:** `components/hcp/HcpStatusPanel.tsx` — Client Component with conditional actions + `useTransition`

Same imports pattern. ActionPanel receives `engagement` (id, status, submittedByClerkId) and `effectiveRoles`. Shows the correct action button(s) based on current status:
- `submitted` + Compliance/Finance role → Approve / Reject buttons
- `approved` + submitter is current user → Mark as Completed button
- `draft` + submitter is current user → Submit / Delete buttons

Each button calls the corresponding Server Action via `startTransition`. Same `Loader2` spinner in pending state, same `error` state display.

---

## Shared Patterns

### Authentication Guard
**Source:** `lib/auth.ts` lines 66-73
**Apply to:** All write Server Actions in `actions/fmv.ts` and `actions/engagement.ts`
```typescript
export function assertRole(effectiveRoles: AppRole[], requiredRoles: AppRole[]): void {
  const hasRole = effectiveRoles.some((r) => requiredRoles.includes(r));
  if (!hasRole) {
    throw new Error(
      `Access denied. Required roles: ${requiredRoles.join(", ")}. User has: ${effectiveRoles.join(", ")}`
    );
  }
}
```

### Role Resolution in Server Components
**Source:** `app/(app)/hcps/[id]/page.tsx` lines 39-47
**Apply to:** All dynamic route Server Components
```typescript
const role = (user.publicMetadata as { role?: string }).role;
const userGrant = await prisma.userGrant.findUnique({
  where: { clerkUserId: user.id },
});
const effectiveRoles = getEffectiveRoles({
  role,
  grants: userGrant?.grantedRoles ?? [],
});
const isCompliance = effectiveRoles.includes("compliance");
```

### API Route Auth Guard
**Source:** `app/api/hcps/exists/route.ts` lines 5-7
**Apply to:** `app/api/hcps/search/route.ts` and `app/api/fmv/rate/route.ts`
```typescript
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### Action Return Convention
**Source:** `actions/hcp.ts` line 125, `actions/debarment.ts` line 13
**Apply to:** All Server Actions
```typescript
// All actions return { success: boolean; error?: string } — never throw to the client
return { success: false, error: "Reason must be at least 10 characters." };
return { success: true };
```

### Prisma Transaction for Atomic Multi-Table Writes
**Source:** `actions/debarment.ts` lines 41-61
**Apply to:** `activateRateCard` in `actions/fmv.ts`, all engagement transitions in `actions/engagement.ts`
```typescript
await prisma.$transaction([
  prisma.tableA.create({ data: { ... } }),
  prisma.tableB.update({ where: { id }, data: { ... } }),
]);
```
Use interactive transaction form (`async (tx) => { ... }`) when you need to read the result of one operation before performing the next (e.g., checking `updated.count === 0`).

### Error Handling in Actions
**Source:** `actions/debarment.ts` lines 64-71
**Apply to:** All Server Actions
```typescript
} catch (error) {
  console.error("[action name] failed:", error);
  return {
    success: false,
    error: "Operation failed. Try again or contact your system administrator.",
  };
}
```

### `revalidatePath` After Mutation
**Source:** `actions/hcp.ts` line 174, `actions/debarment.ts` line 63
**Apply to:** All write Server Actions
```typescript
revalidatePath(`/engagements/${engagementId}`);
revalidatePath("/engagements");  // also revalidate list pages when needed
```

### `useTransition` + `router.refresh()` in Client Components
**Source:** `components/hcp/HcpStatusPanel.tsx` lines 42-43, 68-84
**Apply to:** All Client Component forms that call Server Actions
```typescript
const [isPending, startTransition] = useTransition();
const router = useRouter();

startTransition(async () => {
  const result = await someAction(params);
  if (!result.success) {
    setError(result.error ?? "...");
  } else {
    router.refresh();  // re-fetch Server Component data
  }
});
```

### EmptyState Component
**Source:** `components/shared/EmptyState.tsx` lines 1-8
**Apply to:** `RateCardTable.tsx`, `EngagementTable.tsx`, all list pages with zero results
```typescript
export function EmptyState({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h3 className="text-[20px] font-semibold text-[hsl(220_13%_18%)] mb-2">{heading}</h3>
      <p className="text-[14px] text-[hsl(215_16%_47%)] max-w-sm">{body}</p>
    </div>
  );
}
```

### `createMany` + `skipDuplicates` Seed Pattern
**Source:** `prisma/seed.ts` lines 17-49
**Apply to:** `NuccTaxonomy` seed block in `prisma/seed.ts`
```typescript
await prisma.oigLeieRecord.createMany({
  data: [ ... ],
  skipDuplicates: true,
});
```

### Sidebar NAV_ITEMS Extension
**Source:** `components/shell/Sidebar.tsx` lines 10-29
**Apply to:** Adding FMV and Engagement nav items to `Sidebar.tsx`
```typescript
const NAV_ITEMS = [
  {
    label: "HCP Directory",
    href: "/hcps",
    icon: Users,
    allowedRoles: ["business", "compliance"] as AppRole[],
  },
  // ADD:
  {
    label: "FMV Rates",
    href: "/fmv",
    icon: DollarSign,           // from lucide-react
    allowedRoles: ["compliance"] as AppRole[],
  },
  {
    label: "Engagements",
    href: "/engagements",
    icon: FileText,             // from lucide-react
    allowedRoles: ["business", "compliance", "finance"] as AppRole[],
  },
  {
    label: "Approval Queue",
    href: "/engagements/queue",
    icon: ClipboardList,        // from lucide-react
    allowedRoles: ["compliance", "finance"] as AppRole[],
  },
];
```

### Pure Validation Module Pattern
**Source:** `lib/hcp-validation.ts` (entire file — 25 lines)
**Apply to:** `lib/fmv-parser.ts`, `lib/engagement-validation.ts`
- No `"use server"` directive
- No imports from Prisma or Clerk
- Pure functions only — accept plain objects, return `{ valid: boolean; error?: string }`
- Exported directly for use in test files

### Test File Pattern
**Source:** `actions/hcp.test.ts` (entire file — 47 lines)
**Apply to:** All `*.test.ts` files for Phase 2
```typescript
// Imports validation helper directly — no "use server" functions
import { validateSetStatusParams } from "@/lib/hcp-validation";

describe("validateSetStatusParams", () => {
  it("returns error when ...", () => {
    const result = validateSetStatusParams({ ... });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("...");
  });

  it("returns valid for ...", () => {
    const result = validateSetStatusParams({ ... });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
```

---

## Modified File Patterns

### `prisma/schema.prisma` (extension)

**Analog:** Existing `prisma/schema.prisma` — follow existing enum and model conventions

**Existing enum pattern** (lines 172-189 of schema):
```prisma
enum HcpStatus {
  active
  inactive
  suspended
  do_not_engage
}
```
All new enums follow this snake_case value convention.

**Existing model pattern** — `Hcp` model uses:
- `@id @default(cuid())` for all PKs
- `@@index([fieldName])` for query-path fields
- `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt` for mutable tables
- String actor fields (`addedByClerkId`, `addedByName`) NOT FK-only — self-contained audit trail
- `onDelete: Cascade` on child relations (see `HcpStatusHistory`)

Add `engagements Engagement[]` relation field to the existing `Hcp` model.

### `prisma/seed.ts` (extension)

**Analog:** `prisma/seed.ts` lines 16-49 — `createMany` + `skipDuplicates`

Add `NuccTaxonomy` seed block after existing OIG LEIE and SAM.gov blocks. Same pattern:
```typescript
await prisma.nuccTaxonomy.createMany({
  data: nuccRows.map((row) => ({
    code: row.Code.trim().toUpperCase(),
    grouping: row.Grouping ?? null,
    classification: row.Classification ?? null,
    specialization: row.Specialization ?? null,
    displayName: [row.Classification, row.Specialization].filter(Boolean).join(" — ") || row.Grouping,
  })),
  skipDuplicates: true,
});
```

### `lib/auth.ts` (extension)

**Analog:** `lib/auth.ts` lines 1-7 — `ROUTE_PERMISSIONS` record

**Current state:**
```typescript
export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  "/hcps": ["business", "compliance"],
  "/hcps/new": ["business", "compliance"],
  "/dashboard": ["finance"],
};
```

**Add Phase 2 routes:**
```typescript
"/fmv": ["compliance"],
"/fmv/upload": ["compliance"],
"/engagements": ["business", "compliance", "finance"],
"/engagements/new": ["business", "compliance"],
"/engagements/queue": ["compliance", "finance"],
```

### `next.config.ts` (extension)

**Analog:** `next.config.ts` lines 1-11 — minimal config object

**Current state:**
```typescript
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }],
  },
};
```

**Add `experimental.serverActions.bodySizeLimit`:**
```typescript
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }],
  },
};
```

### `components/shell/Sidebar.tsx` (extension)

**Analog:** `components/shell/Sidebar.tsx` lines 10-29 — `NAV_ITEMS` array

Add new items to `NAV_ITEMS` array following the existing `{ label, href, icon, allowedRoles }` shape. Import new Lucide icons at line 5 alongside `Users`, `UserPlus`, `LayoutDashboard`.

---

## No Analog Found

All 26 files have analogs in the existing codebase. No files require relying solely on RESEARCH.md reference patterns.

---

## Metadata

**Analog search scope:** `actions/`, `lib/`, `app/(app)/`, `app/api/`, `components/`, `prisma/`, `next.config.ts`
**Files scanned:** 22 source files
**Pattern extraction date:** 2026-05-08
