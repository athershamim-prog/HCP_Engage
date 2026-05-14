# Phase 4: Invoice Generation — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/schema.prisma` | model/migration | CRUD | `prisma/schema.prisma` (self — extend Engagement, add Invoice) | exact |
| `lib/r2.ts` | utility/config | file-I/O | `lib/prisma.ts` (singleton client instantiation pattern) | role-match |
| `lib/invoice-calc.ts` | utility | transform | `lib/engagement-validation.ts` (pure function, no "use server", injectable, testable) | role-match |
| `components/pdf/InvoiceDocument.tsx` | component | transform | `components/fmv/FmvRatePanel.tsx` (data display component — props-in, rendered output) | partial-match |
| `app/api/engagements/[id]/invoice/route.ts` | route handler | request-response + file-I/O | `app/api/engagements/pop-upload/route.ts` (auth + buffer + file write + JSON response) | exact |
| `lib/invoice-calc.test.ts` | test | — | `lib/engagement-validation.test.ts` (pure function unit test, describe/it/expect) | exact |
| `app/(app)/engagements/[id]/page.tsx` | page (server component) | request-response | self — extend existing file | exact |
| `components/engagement/ActionPanel.tsx` | component (client) | request-response | self — extend existing file; `pop-upload` fetch pattern for the generate call | exact |
| `components/engagement/EngagementForm.tsx` | component (client) | request-response | self — extend existing file; `FmvRatePanel.tsx` for callback-prop pattern | exact |
| `.env.example` / `next.config.ts` | config | — | self — extend existing files | exact |

---

## Pattern Assignments

### `prisma/schema.prisma` (model/migration — extend Engagement, add Invoice)

**Analog:** `prisma/schema.prisma` — existing `FmvRate` model (Decimal field + enum FK pattern) and `EngagementStatusHistory` model (FK to Engagement with cascade)

**Existing Decimal + enum FK pattern** (lines 256–270):
```prisma
model FmvRate {
  id              String         @id @default(cuid())
  rateCardId      String
  nuccCode        String
  nuccDisplayName String
  state           String?
  engagementType  EngagementType
  rateUsd         Decimal        @db.Decimal(10, 2)
  rateUnit        RateUnit

  rateCard        FmvRateCard    @relation(fields: [rateCardId], references: [id], onDelete: Cascade)

  @@index([rateCardId])
  @@index([rateCardId, nuccCode, engagementType, state])
}
```

**Engagement model field to rename** (line 282 — current):
```prisma
  compensationUsd     Decimal          @db.Decimal(10, 2)
```
Must become `agreedRateUsd` via `ALTER TABLE "Engagement" RENAME COLUMN "compensationUsd" TO "agreedRateUsd"` (custom migration — never drop+add).

**New Invoice model to add** (after Engagement model, before closing brace):
```prisma
model Invoice {
  id                  String     @id @default(cuid())
  engagementId        String     @unique
  storageUrl          String
  agreedRateUsd       Decimal    @db.Decimal(10, 2)
  noOfActivities      Int?
  totalUsd            Decimal    @db.Decimal(10, 2)
  rateUnit            String     // "per_hour" | "per_day" | "flat_fee" | "per_event"
  generatedByClerkId  String
  generatedByName     String
  generatedAt         DateTime   @default(now())

  engagement          Engagement @relation(fields: [engagementId], references: [id])
}
```

**Inverse relation to add on Engagement model** (after existing `statusHistory` line):
```prisma
  invoice             Invoice?
```

**Migration SQL approach** (use `--create-only` then hand-edit):
```sql
-- Replace Prisma's auto-generated DROP+ADD with:
ALTER TABLE "Engagement" RENAME COLUMN "compensationUsd" TO "agreedRateUsd";
ALTER TABLE "Engagement" ADD COLUMN "noOfActivities" INTEGER;
-- Then the auto-generated Invoice CREATE TABLE block (acceptable as-is)
```

---

### `lib/r2.ts` (utility — S3Client singleton for Cloudflare R2)

**Analog:** `lib/prisma.ts` — singleton instantiation pattern with env var validation and global caching

**Singleton pattern from `lib/prisma.ts`** (lines 1–29):
```typescript
// Pattern: create once, cache in globalThis, env var validated at init
import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  // ... construct client
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Apply to `lib/r2.ts`:** Export a named `r2` singleton. Do NOT cache in globalThis (S3Client is lightweight and stateless). Critical config to copy exactly:
```typescript
import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED", // REQUIRED: SDK >= 3.729.0 sends CRC32, R2 rejects it
});
```

**Env var names to use** (from `04-CONTEXT.md` canonical refs):
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

---

### `lib/invoice-calc.ts` (utility — pure total calculation function)

**Analog:** `lib/engagement-validation.ts` — pure TypeScript module, no "use server", no framework imports, exported named functions, injectable params, returns typed result

**Module structure from `lib/engagement-validation.ts`** (lines 1–57):
```typescript
/**
 * Pure validation helpers for engagement server actions.
 * No "use server" — exported as standalone module for testability.
 * Pattern: lib/hcp-validation.ts
 */

// Named types at top
// Exported pure functions — no side effects, no DB, no imports from framework

export function validateEngagementFields(params: {
  hcpId: string;
  // ...
}): { valid: boolean; error?: string } {
  // guard clauses returning early on failure
  // ...
  return { valid: true };
}
```

**Apply to `lib/invoice-calc.ts`:**
```typescript
/**
 * Pure calculation helpers for invoice generation.
 * No "use server" — exported as standalone module for testability.
 */

export type RateUnit = "per_hour" | "per_day" | "flat_fee" | "per_event";

export interface InvoiceCalcParams {
  agreedRateUsd: number;
  rateUnit: RateUnit;
  noOfActivities: number | null;
}

export interface InvoiceCalcResult {
  totalUsd: number;
  noOfActivitiesApplied: number; // 1 for flat_fee/per_event; actual value for per_hour/per_day
}

export function calculateInvoiceTotal(params: InvoiceCalcParams): InvoiceCalcResult {
  const { agreedRateUsd, rateUnit, noOfActivities } = params;
  if (rateUnit === "per_hour" || rateUnit === "per_day") {
    const activities = noOfActivities ?? 1;
    return { totalUsd: agreedRateUsd * activities, noOfActivitiesApplied: activities };
  }
  // flat_fee and per_event: total = agreedRateUsd regardless of activities
  return { totalUsd: agreedRateUsd, noOfActivitiesApplied: 1 };
}
```

---

### `components/pdf/InvoiceDocument.tsx` (component — react-pdf Document/Page layout)

**Analog:** `components/fmv/FmvRatePanel.tsx` for the props-in / rendered-output component structure. However, this file must NOT have `"use client"` — it is a pure Node.js-side JSX component rendered by `renderToBuffer`.

**Critical difference from all other components:** No `"use client"` directive. No hooks. No browser APIs. Props-only rendering.

**Props-in pattern from `FmvRatePanel.tsx`** (lines 22–36):
```typescript
interface RateData {
  nuccCode: string;
  nuccDisplayName: string;
  state: string | null;
  engagementType: string;
  rateUsd: number;
  rateUnit: string;
}

interface FmvRatePanelProps {
  hcpId: string | null;
  engagementType: string | null;
}

export function FmvRatePanel({ hcpId, engagementType }: FmvRatePanelProps) {
  // ...
}
```

**Apply to `components/pdf/InvoiceDocument.tsx`:**
```typescript
// NO "use client" — this file runs in Node.js via renderToBuffer only
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  title: { fontSize: 20, marginBottom: 16 },
  label: { fontSize: 9, color: "#666", marginBottom: 2 },
  value: { fontSize: 12, marginBottom: 10 },
  row: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 12 },
  total: { fontSize: 14, fontWeight: "bold" },
});

export interface InvoiceDocumentProps {
  hcpFullName: string;
  hcpNpi: string;
  hcpSpecialty: string;
  engagementType: string;
  proposedDate: string;
  agreedRateUsd: number;
  rateUnit: string;
  noOfActivities: number | null;
  totalUsd: number;
}

export function InvoiceDocument(props: InvoiceDocumentProps) {
  // Pure JSX — no hooks, no browser APIs, no useEffect
}
```

---

### `app/api/engagements/[id]/invoice/route.ts` (route handler — PDF generation + R2 upload)

**Analog:** `app/api/engagements/pop-upload/route.ts` — exact match: auth check, buffer handling, file write, JSON response. Extended with prisma transaction and role gating.

**Auth pattern from `pop-upload/route.ts`** (lines 15–18):
```typescript
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ...
}
```

**Dynamic route param pattern from `app/api/fmv/rate/route.ts`** (lines 6–15):
```typescript
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hcpId = request.nextUrl.searchParams.get("hcpId");
  // ...
}
```

**For dynamic segment `[id]` — use Next.js 15 async params pattern:**
```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ...
}
```

**Role gating — copy from `actions/engagement.ts` pattern** (lines 3–6, 24–35):
```typescript
import { auth, currentUser } from "@clerk/nextjs/server";
import { getEffectiveRoles, assertRole } from "@/lib/auth";

// In handler body:
const user = await currentUser();
const roles = getEffectiveRoles({
  role: (user.publicMetadata as { role?: string }).role,
  grants: userGrant?.grantedRoles ?? [],
});
// For compliance-only:
assertRole(roles, ["compliance"]);
// Return 403 if assertRole throws
```

**Prisma transaction pattern from `actions/engagement.ts`** (lines 41–65):
```typescript
await prisma.$transaction(async (tx) => {
  // All reads and writes inside transaction
  // Unique constraint on engagementId catches double-generate — return 409
});
```

**Buffer handling + file write from `pop-upload/route.ts`** (lines 34–52):
```typescript
const buffer = Buffer.from(await file.arrayBuffer());
// ... validate ...
await writeFile(join(uploadDir, filename), buffer);
return NextResponse.json({ url: `/api/engagements/pop-file/${filename}`, filename: file.name });
```

**Apply to invoice route:** Replace `writeFile` with `r2.send(new PutObjectCommand(...))`. Return `{ storageUrl }` instead of `{ url }`.

**Error handling pattern:**
```typescript
try {
  // ... all logic ...
  return NextResponse.json({ storageUrl });
} catch (error) {
  // Check for Prisma unique constraint (double-generate)
  if ((error as { code?: string }).code === "P2002") {
    return NextResponse.json({ error: "Invoice already exists for this engagement" }, { status: 409 });
  }
  console.error("Invoice generation failed:", error);
  return NextResponse.json({ error: "Invoice generation failed" }, { status: 500 });
}
```

---

### `lib/invoice-calc.test.ts` (unit test — pure function)

**Analog:** `lib/engagement-validation.test.ts` — exact match: Jest describe/it/expect, valid fixture object, spread to override single field, test both happy path and edge cases

**Test structure from `lib/engagement-validation.test.ts`** (lines 1–49):
```typescript
/**
 * Tests for lib/engagement-validation.ts
 * Requirements: ENG-01, ENG-02, ENG-03
 */

import { validateEngagementFields } from "@/lib/engagement-validation";

const VALID_ENGAGEMENT = {
  hcpId: "hcp-123",
  engagementType: "advisory_board",
  proposedDate: "2026-06-01",
  compensationUsd: 350,
  description: "A twenty-character minimum description for the engagement scope",
};

describe("validateEngagementFields", () => {
  it("returns valid=true for a fully populated engagement with all required fields", () => {
    expect(validateEngagementFields(VALID_ENGAGEMENT).valid).toBe(true);
  });
  it("returns valid=false with error when hcpId is missing", () => {
    const result = validateEngagementFields({ ...VALID_ENGAGEMENT, hcpId: "" });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Select an HCP before saving.");
  });
```

**Apply to `lib/invoice-calc.test.ts`:**
```typescript
/**
 * Tests for lib/invoice-calc.ts
 * Requirements: CONT-02
 */

import { calculateInvoiceTotal } from "@/lib/invoice-calc";

const BASE = { agreedRateUsd: 350, rateUnit: "per_hour" as const, noOfActivities: 2 };

describe("calculateInvoiceTotal", () => {
  it("per_hour: multiplies rate by noOfActivities", () => {
    expect(calculateInvoiceTotal(BASE).totalUsd).toBe(700);
  });
  it("per_day: multiplies rate by noOfActivities", () => {
    expect(calculateInvoiceTotal({ ...BASE, rateUnit: "per_day" }).totalUsd).toBe(700);
  });
  it("flat_fee: total equals agreedRateUsd regardless of noOfActivities", () => {
    expect(calculateInvoiceTotal({ ...BASE, rateUnit: "flat_fee" }).totalUsd).toBe(350);
  });
  it("per_event: total equals agreedRateUsd regardless of noOfActivities", () => {
    expect(calculateInvoiceTotal({ ...BASE, rateUnit: "per_event" }).totalUsd).toBe(350);
  });
  it("per_hour with null noOfActivities: defaults to 1 (total = rate)", () => {
    expect(calculateInvoiceTotal({ ...BASE, noOfActivities: null }).totalUsd).toBe(350);
  });
});
```

---

### `app/(app)/engagements/[id]/page.tsx` (server component — extend to include Invoice)

**Analog:** self (the existing file). Key additions:

**Existing prisma include pattern** (lines 55–92 — `include` block with relations):
```typescript
const engagement = await prisma.engagement.findUnique({
  where: { id },
  include: {
    hcp: { select: { ... } },
    statusHistory: { orderBy: { createdAt: "desc" } },
  },
});
```

**Add invoice include:**
```typescript
// Add to the include block:
invoice: true,  // or: { select: { storageUrl: true } }
```

**Existing detail card pattern** (lines 141–176 — dl/dt/dd grid layout for Engagement Details):
```typescript
<Card>
  <CardHeader>
    <CardTitle className="text-[20px]">Engagement Details</CardTitle>
  </CardHeader>
  <CardContent>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
      <div>
        <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">HCP</dt>
        <dd className="mt-0.5">...</dd>
      </div>
```

**Add Invoice section card** (after PoP card, before Status History card — same pattern):
```typescript
{engagement.invoice && (
  <Card>
    <CardHeader>
      <CardTitle className="text-[20px]">Invoice</CardTitle>
    </CardHeader>
    <CardContent>
      <a
        href={engagement.invoice.storageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[14px] text-[hsl(221_83%_53%)] hover:underline"
      >
        Download Invoice ↗
      </a>
    </CardContent>
  </Card>
)}
```

**Pass invoice to ActionPanel** (lines 308–316 — existing ActionPanel call):
```typescript
<ActionPanel
  engagementId={engagement.id}
  status={engagement.status as EngagementStatusValue}
  submittedByClerkId={engagement.submittedByClerkId}
  currentUserClerkId={user.id}
  effectiveRoles={effectiveRoles}
  rejectionReason={engagement.rejectionReason}
  popDocumentUrl={engagement.popDocumentUrl}
  invoiceStorageUrl={engagement.invoice?.storageUrl ?? null}  // ADD THIS
/>
```

**Rename `compensationUsd` display** (line 110 — existing):
```typescript
// Change:
const compensationDisplay = parseFloat(engagement.compensationUsd.toString()).toFixed(2);
// To:
const agreedRateDisplay = parseFloat(engagement.agreedRateUsd.toString()).toFixed(2);
```

---

### `components/engagement/ActionPanel.tsx` (client component — add invoice buttons)

**Analog:** self (the existing file). The `wrap()` helper and `useTransition` pattern are already established.

**Existing `wrap()` helper pattern** (lines 97–112 — copy exactly):
```typescript
function wrap(fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string, redirect?: string) {
  setError(null);
  startTransition(async () => {
    const result = await fn();
    if (!result.success) {
      setError(result.error ?? "Action failed. Refresh the page and try again.");
    } else {
      toast.success(successMsg);
      if (redirect) {
        router.push(redirect);
      } else {
        router.refresh();
      }
    }
  });
}
```

**Existing file upload via `fetch()` pattern** (lines 75–95 — `handleFileUpload`):
```typescript
async function handleFileUpload(file: File) {
  setUploadStatus("uploading");
  setError(null);
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch("/api/engagements/pop-upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      setUploadStatus("error");
      setError(data.error ?? "Upload failed.");
    } else {
      setPopUrl(data.url);
      setUploadedFileName(file.name);
      setUploadStatus("uploaded");
    }
  } catch {
    setUploadStatus("error");
    setError("Upload failed. Please try again.");
  }
}
```

**Adapt for invoice generation** — use `startTransition` + `fetch` (not `wrap` since the route returns JSON not `{success, error}`):
```typescript
async function handleGenerateInvoice() {
  setError(null);
  startTransition(async () => {
    try {
      const res = await fetch(`/api/engagements/${engagementId}/invoice`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invoice generation failed.");
      } else {
        toast.success("Invoice generated.");
        router.refresh();
      }
    } catch {
      setError("Invoice generation failed. Please try again.");
    }
  });
}
```

**New prop to add to `ActionPanelProps` interface** (lines 35–43):
```typescript
interface ActionPanelProps {
  engagementId: string;
  status: EngagementStatusValue;
  submittedByClerkId: string;
  currentUserClerkId: string;
  effectiveRoles: string[];
  rejectionReason?: string | null;
  popDocumentUrl?: string | null;
  invoiceStorageUrl?: string | null;  // ADD THIS
}
```

**Replace completed branch** (line 439 — currently `return <ReadOnlyCard message="Completed" />`):
```typescript
// ── Completed ──────────────────────────────────────────────────────────────
if (status === "completed") {
  if (invoiceStorageUrl) {
    // All roles see "Download Invoice" once invoice exists
    return (
      <Card>
        <CardHeader><CardTitle className="text-[20px]">Invoice</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <a
            href={invoiceStorageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full"
          >
            <Button variant="outline" className="w-full h-11">Download Invoice</Button>
          </a>
          {error && <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>}
        </CardContent>
      </Card>
    );
  }
  if (isCompliance && popDocumentUrl) {
    // Compliance sees "Generate Invoice" when no invoice yet but PoP is attached
    return (
      <Card>
        <CardHeader><CardTitle className="text-[20px]">Generate Invoice</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={handleGenerateInvoice}
            disabled={isPending}
            className="w-full h-11 bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] text-white"
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</> : "Generate Invoice"}
          </Button>
          {error && <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>}
        </CardContent>
      </Card>
    );
  }
  return <ReadOnlyCard message="Completed" />;
}
```

---

### `components/engagement/EngagementForm.tsx` (client component — rename field, add noOfActivities)

**Analog:** self (existing file). `FmvRatePanel.tsx` for the callback pattern.

**Existing controlled input pattern** (lines 193–215 — Compensation field):
```typescript
{/* Compensation */}
<div>
  <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
    Compensation (USD) <span className="text-[hsl(0_72%_51%)]">*</span>
  </label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[hsl(215_16%_47%)]">$</span>
    <Input
      type="number"
      min="0"
      step="0.01"
      value={compensationUsd}
      onChange={(e) => {
        setCompensationUsd(e.target.value);
        setTouched(true);
      }}
      disabled={isPending}
      className="h-11 pl-7"
      placeholder="0.00"
      aria-label="Compensation in USD"
    />
  </div>
</div>
```

**Rename:** Change state var `compensationUsd` → `agreedRateUsd`, label to "Agreed Rate (USD)", aria-label to "Agreed rate in USD". Update both `createEngagementAction` call sites (lines 74–80, 94–100).

**`noOfActivities` field — conditional visibility.** The `FmvRatePanel` currently keeps `rateUnit` internal (lines 39–40 in FmvRatePanel.tsx). Use the callback-prop pattern:

Add `onRateLoaded` prop to `FmvRatePanel`:
```typescript
// In FmvRatePanel.tsx — add to interface:
interface FmvRatePanelProps {
  hcpId: string | null;
  engagementType: string | null;
  onRateLoaded?: (rateUnit: string | null) => void;  // ADD
}

// In useEffect, after setRate(data.rate); setPanelState("loaded"):
onRateLoaded?.(data.rate.rateUnit);
// When rate not found or panel goes back to initial:
onRateLoaded?.(null);
```

In `EngagementForm.tsx`, track `rateUnit` in state:
```typescript
const [rateUnit, setRateUnit] = useState<string | null>(null);
const [noOfActivities, setNoOfActivities] = useState("");

// Show noOfActivities field only for per_hour or per_day:
const showNoOfActivities = rateUnit === "per_hour" || rateUnit === "per_day";
```

FmvRatePanel call in EngagementForm (lines 289–293) becomes:
```typescript
<FmvRatePanel
  hcpId={selectedHcp?.id ?? null}
  engagementType={engagementType || null}
  onRateLoaded={(unit) => setRateUnit(unit)}
/>
```

**Conditional field block** (same pattern as `isPastDate` warning — lines 186–190):
```typescript
{showNoOfActivities && (
  <div>
    <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
      No of Activities <span className="text-[hsl(0_72%_51%)]">*</span>
    </label>
    <Input
      type="number"
      min="1"
      step="1"
      value={noOfActivities}
      onChange={(e) => { setNoOfActivities(e.target.value); setTouched(true); }}
      disabled={isPending}
      className="h-11"
      placeholder="e.g., 4"
      aria-label="Number of activities"
    />
  </div>
)}
```

---

### `.env.example` (config — add R2 env vars)

**Analog:** self (existing file — lines 1–7). Add after the existing vars:
```
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_NAME="hcp-engage-invoices"
R2_PUBLIC_URL="https://your-bucket.r2.dev"
```

---

### `next.config.ts` (config — add serverExternalPackages)

**Analog:** self (existing file — lines 1–16). Add `serverExternalPackages` at top level alongside `experimental`:

**Existing config** (lines 3–15):
```typescript
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};
```

**Modified config:**
```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],  // ADD THIS LINE
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};
```

---

## Shared Patterns

### Auth — Route Handler pattern
**Source:** `app/api/engagements/pop-upload/route.ts` lines 15–17 + `app/api/fmv/rate/route.ts` lines 6–8
**Apply to:** `app/api/engagements/[id]/invoice/route.ts`
```typescript
import { auth, currentUser } from "@clerk/nextjs/server";

// Minimum auth check (any authenticated user):
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// For role-gated routes — extend with currentUser + assertRole:
const user = await currentUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const roles = getEffectiveRoles({
  role: (user.publicMetadata as { role?: string }).role,
  grants: userGrant?.grantedRoles ?? [],
});
// Throws if role not in list:
assertRole(roles, ["compliance"]);
```

### Prisma Transaction
**Source:** `actions/engagement.ts` lines 41–65
**Apply to:** `app/api/engagements/[id]/invoice/route.ts` (DB write must be atomic with R2 upload key)
```typescript
await prisma.$transaction(async (tx) => {
  await tx.invoice.create({
    data: {
      engagementId,
      storageUrl,
      agreedRateUsd: engagement.agreedRateUsd,
      noOfActivities: engagement.noOfActivities,
      totalUsd,
      rateUnit: fmvRate?.rateUnit ?? selectedRateUnit,
      generatedByClerkId: user.id,
      generatedByName: user.fullName ?? "Unknown",
    },
  });
});
// P2002 unique constraint → return 409 (invoice already exists)
```

### Error Response Pattern
**Source:** `app/api/engagements/pop-upload/route.ts` lines 27–43
**Apply to:** all new route handlers
```typescript
// Validation error:
return NextResponse.json({ error: "descriptive message" }, { status: 400 });
// Auth error:
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// Forbidden:
return NextResponse.json({ error: "Forbidden: only Compliance can generate invoices" }, { status: 403 });
// Not found:
return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
// Conflict (unique constraint):
return NextResponse.json({ error: "Invoice already exists for this engagement" }, { status: 409 });
// Server error:
return NextResponse.json({ error: "Invoice generation failed" }, { status: 500 });
```

### useTransition + router.refresh() — Client Component Action Pattern
**Source:** `components/engagement/ActionPanel.tsx` lines 55–56, 97–112
**Apply to:** invoice generate button in `ActionPanel.tsx`
```typescript
const [isPending, startTransition] = useTransition();
const router = useRouter();

// For fetch-based actions (not server actions):
startTransition(async () => {
  const res = await fetch(`/api/engagements/${engagementId}/invoice`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    setError(data.error ?? "Action failed.");
  } else {
    toast.success("Invoice generated.");
    router.refresh();
  }
});
```

### Decimal Serialization for Display
**Source:** `app/(app)/engagements/[id]/page.tsx` line 110
**Apply to:** invoice total and rate display anywhere Decimal fields from Prisma are rendered
```typescript
// Prisma Decimal → display string:
const agreedRateDisplay = parseFloat(engagement.agreedRateUsd.toString()).toFixed(2);
const totalDisplay = parseFloat(invoice.totalUsd.toString()).toFixed(2);
```

---

## Files to Update for `compensationUsd` → `agreedRateUsd` Rename

Per RESEARCH.md Runtime State Inventory — all 11 usages across 7 files must be updated atomically with the migration:

| File | Current Reference | Change To |
|------|-------------------|-----------|
| `actions/engagement.ts` | `compensationUsd: params.compensationUsd` (line 49) + interface field (line 14) | `agreedRateUsd` |
| `actions/engagement.test.ts` | fixture field | `agreedRateUsd` |
| `lib/engagement-validation.ts` | `compensationUsd: number` param + check (lines 39, 50–52) | `agreedRateUsd` |
| `lib/engagement-validation.test.ts` | `compensationUsd: 350` in `VALID_ENGAGEMENT` (line 16) | `agreedRateUsd` |
| `app/(app)/engagements/legal-queue/page.tsx` | `engagement.compensationUsd.toString()` | `engagement.agreedRateUsd.toString()` |
| `app/(app)/engagements/page.tsx` | `parseFloat(e.compensationUsd.toString())` | `parseFloat(e.agreedRateUsd.toString())` |
| `app/(app)/engagements/[id]/page.tsx` | `engagement.compensationUsd.toString()` (line 110) | `engagement.agreedRateUsd.toString()` |
| `components/engagement/EngagementForm.tsx` | state var + two action calls (lines 48, 75, 97) | `agreedRateUsd` |
| `components/engagement/EngagementTable.tsx` | interface + display | `agreedRateUsd` |
| `app/(app)/engagements/queue/page.tsx` | `compensationUsd.toString()` | `agreedRateUsd.toString()` |

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

| File | Closest Analog Limitation |
|------|--------------------------|
| `components/pdf/InvoiceDocument.tsx` | No existing react-pdf component — use RESEARCH.md `InvoiceDocument` code example as starting point; `FmvRatePanel` supplies only the props-in structure |
| `lib/r2.ts` | No existing cloud storage client — `lib/prisma.ts` supplies the singleton structure only; use RESEARCH.md for S3Client config |

---

## Metadata

**Analog search scope:** `actions/`, `lib/`, `app/api/`, `app/(app)/engagements/`, `components/engagement/`, `components/fmv/`, `prisma/`
**Files scanned:** 18
**Pattern extraction date:** 2026-05-14
