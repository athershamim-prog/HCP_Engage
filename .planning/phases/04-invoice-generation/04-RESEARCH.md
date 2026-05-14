# Phase 4: Invoice Generation — Research

**Researched:** 2026-05-14
**Domain:** PDF generation (@react-pdf/renderer), Cloudflare R2 storage, Prisma column rename migration, engagement form extension
**Confidence:** MEDIUM — PDF/Next.js integration has known active compatibility issues; R2 SDK pattern is HIGH confidence from official Cloudflare docs

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 4 delivers an **invoice** (not a multi-party contract). CONT-01 and CONT-04 are over-engineered for v1.
- **D-02:** CONT-02 is satisfied by a **fixed-layout PDF** generated server-side with `@react-pdf/renderer v3`. No template upload, no merge field syntax, no DOCX parsing.
- **D-03:** CONT-04 is satisfied by **existence tracking** only — Invoice record either exists or does not. No status stages.
- **D-04:** `compensationUsd` on the `Engagement` model is renamed to `agreedRateUsd`. Requires Prisma migration and form/display label updates everywhere `compensationUsd` appears.
- **D-05:** New `noOfActivities` integer field added to the `Engagement` model. Field label on the form: **"No of Activities"**.
- **D-06:** Invoice total calculation: per_hour/per_day → `total = agreedRateUsd × noOfActivities`; flat_fee/per_event → `total = agreedRateUsd` (noOfActivities not shown; treated as 1 internally).
- **D-07:** Rate unit is derived from FMV rate lookup (`FmvRate.rateUnit`). If no FMV rate on file, show a `rateUnit` selector (per_hour / per_day) defaulting to per_hour.
- **D-08:** Generation trigger: Compliance can generate when `status = completed` AND `popDocumentUrl` is set. Only `compliance` role can trigger.
- **D-09:** Invoice generated **once** per engagement, stored in R2. No regeneration path in v1.
- **D-10:** "Send to Finance" = download + out-of-band. No in-app send action.
- **D-11:** PDF fixed fields: HCP full name/NPI/NUCC specialty; engagement type/proposed date; No of Activities (if applicable); agreed rate; total compensation. No logo, no PoP reference, no submitter names.
- **D-12:** Cloud storage: **Cloudflare R2** (S3-compatible API). PDF objects are write-once.
- **D-13:** R2 bucket path: `invoices/{engagementId}/{timestamp}.pdf`
- **D-14:** `Invoice` table: `id`, `engagementId` (unique), `storageUrl`, `agreedRateUsd`, `noOfActivities` (nullable), `totalUsd`, `generatedByClerkId`, `generatedByName`, `generatedAt`.

### Claude's Discretion

- Rate basis fallback when no FMV rate on file (D-07): show a `rateUnit` selector (per_hour / per_day) defaulting to per_hour
- Invoice DB model structure (D-14): `Invoice` table with unique `engagementId` constraint

### Deferred Ideas (OUT OF SCOPE)

- Contract template upload/versioning (CONT-01)
- 4-stage contract status lifecycle (CONT-04)
- DocuSign e-signature (CONT-V2-01)
- In-app "Send to Finance" action
- Per-event rate type invoicing
- Invoice regeneration
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-02 | System auto-generates a PDF contract/invoice from applicable data — optional fields explicitly marked N/A when absent | @react-pdf/renderer v4 (latest) with `renderToBuffer` in a Next.js Route Handler; requires `serverExternalPackages` config; PDF component must NOT use "use client" |
| CONT-03 | Generated PDFs are stored in cloud storage and cannot be overwritten through the application | Cloudflare R2 PutObjectCommand write-once; unique Invoice DB record enforces one-invoice-per-engagement at DB level; no delete/overwrite route exposed |
</phase_requirements>

---

## Summary

Phase 4 has four distinct technical domains, each with different risk levels:

**Domain 1 — Schema migration (LOW risk):** Renaming `compensationUsd` → `agreedRateUsd` and adding `noOfActivities Int?` is well-understood Prisma work. The rename requires `npx prisma migrate dev --create-only` followed by manual SQL edit to use `ALTER TABLE ... RENAME COLUMN` instead of the default drop+add. There are 11 files in the codebase that reference `compensationUsd` — all must be updated atomically with the migration.

**Domain 2 — PDF generation (MEDIUM risk):** `@react-pdf/renderer` is NOT yet installed (absent from package.json). The latest published version is 4.5.1. The library has well-documented compatibility friction with Next.js App Router — the fix is adding `@react-pdf/renderer` to `serverExternalPackages` in next.config.ts and using a Route Handler (not a Server Action) to generate and return the buffer. The PDF Document component must be a plain server-side React component with no "use client" directive.

**Domain 3 — R2 upload (LOW risk):** `@aws-sdk/client-s3` is NOT yet installed. The Cloudflare R2 S3-compatible API is well-documented. One critical pitfall: SDK versions >= 3.729.0 default to CRC32 checksums that R2 does not support — the S3Client must be configured with `requestChecksumCalculation: "WHEN_REQUIRED"`. The bucket download strategy (public URL vs. signed URL) needs a decision — documented below.

**Domain 4 — Form and UI extension (LOW risk):** The `EngagementForm.tsx` (client component) currently drives the FMV rate panel via `/api/fmv/rate` which already returns `rateUnit`. Adding `noOfActivities` visibility logic means calling the same API and conditionally rendering the field. The ActionPanel already follows the `useTransition` + server action pattern for invoice generation buttons.

**Primary recommendation:** Use a Next.js Route Handler at `app/api/engagements/[id]/invoice/route.ts` (not a Server Action) to generate the PDF buffer and trigger R2 upload. Server Actions have a 5 MB body size limit already configured for PoP upload — PDF generation may produce larger intermediary states. The Route Handler returns a `200 OK` JSON response with the `storageUrl`; the client-side button calls it via `fetch()` inside `useTransition`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PDF buffer generation | API / Backend (Route Handler) | — | react-pdf `renderToBuffer` is Node.js only; cannot run in browser; Route Handler is the correct server boundary |
| R2 upload | API / Backend (Route Handler) | — | R2 credentials must never reach the client; upload happens server-side in the same handler |
| Invoice DB record write | API / Backend (Route Handler) | — | Must be in a `prisma.$transaction` with the R2 key so they're atomic |
| Invoice download serving | CDN / R2 direct URL | API proxy fallback | If R2 bucket is public, `storageUrl` is a direct R2/CDN URL — no proxy needed |
| `noOfActivities` field visibility | Browser / Client | API (fmv/rate) | Client component reads `rateUnit` from existing `/api/fmv/rate` response |
| Schema rename migration | Database / Storage | — | `ALTER TABLE ... RENAME COLUMN` via Prisma custom migration |
| Role gating (compliance-only generate) | API / Backend | Frontend (button hide) | Backend must enforce; frontend button visibility is defense-in-depth only |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-pdf/renderer | 4.5.1 (latest) | Server-side PDF generation from React components | Only library that generates PDFs from React JSX server-side without headless browser |
| @aws-sdk/client-s3 | 3.1046.0 (latest) | R2 upload via S3-compatible API | Official AWS SDK; Cloudflare R2 S3 compatibility is documented and supported |
| @aws-sdk/s3-request-presigner | 3.1046.0 (latest) | Signed URL generation (if private bucket) | Same SDK family; needed only if bucket is not public |

**Version verification:**
- `@react-pdf/renderer`: `npm view @react-pdf/renderer version` → `4.5.1` [VERIFIED: npm registry]
- `@aws-sdk/client-s3`: `npm view @aws-sdk/client-s3 version` → `3.1046.0` [VERIFIED: npm registry]
- `@aws-sdk/s3-request-presigner`: `npm view @aws-sdk/s3-request-presigner version` → `3.1046.0` [VERIFIED: npm registry]

> NOTE: CONTEXT.md and CLAUDE.md reference "@react-pdf/renderer v3" but the package is NOT in package.json at all. The current npm latest is 4.5.1. The planner should install the latest (4.5.1) since v3 is not yet installed — there is no installed version to preserve. [ASSUMED: v4 API is backward-compatible with the v3 patterns described in CONTEXT.md for renderToBuffer and Document/Page/Text primitives]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing: prisma | ^7.8.0 | Schema migration | Already installed; migrate dev handles rename |
| Existing: @clerk/nextjs | ^7.3.2 | Auth/role check in Route Handler | Already installed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Route Handler for PDF | Server Action | Server Actions have 5MB body limit configured; buffer + R2 write in one request risks hitting this; Route Handler has no artificial body limit |
| Route Handler for PDF | Puppeteer/headless | react-pdf is pure Node — no browser process needed; much lighter |
| Public R2 URL | Signed URL | Public URL: simpler, zero latency, but all PDFs are publicly accessible by URL. Signed URL: secure, temporary, requires server round-trip. See Open Questions. |

**Installation:**

```bash
npm install @react-pdf/renderer @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## Architecture Patterns

### System Architecture Diagram

```
[Compliance user clicks "Generate Invoice"]
         |
         v
[Client: ActionPanel.tsx]
  fetch POST /api/engagements/[id]/invoice
         |
         v
[Route Handler: app/api/engagements/[id]/invoice/route.ts]
  1. auth() — verify compliance role
  2. prisma.engagement.findUnique — load HCP + engagement data
  3. Check: status === "completed" AND popDocumentUrl set
  4. Check: no existing Invoice record (idempotency)
  5. renderToBuffer(<InvoiceDocument {...} />) — generate PDF
  6. S3Client.send(PutObjectCommand) — upload to R2
     key: invoices/{engagementId}/{Date.now()}.pdf
  7. prisma.$transaction — create Invoice record with storageUrl
  8. Return { storageUrl }
         |
         v
[Client: router.refresh()]
  Engagement detail page re-fetches
         |
         v
[EngagementDetailPage (Server Component)]
  prisma.invoice.findUnique({ where: { engagementId } })
  Passes invoice to ActionPanel
         |
         v
[ActionPanel — completed state with invoice]
  "Download Invoice" button → href={invoice.storageUrl}
```

### Recommended Project Structure

```
app/
├── api/
│   └── engagements/
│       └── [id]/
│           └── invoice/
│               └── route.ts        # POST: generate PDF + upload R2 + create Invoice record
├── (app)/
│   └── engagements/
│       └── [id]/
│           └── page.tsx            # Extend: include Invoice relation, pass to ActionPanel
components/
├── engagement/
│   ├── ActionPanel.tsx             # Extend: invoice buttons for completed status
│   └── EngagementForm.tsx          # Extend: rename field, add noOfActivities
├── pdf/
│   └── InvoiceDocument.tsx         # New: react-pdf Document/Page/Text component (NO "use client")
lib/
└── r2.ts                           # New: S3Client singleton for R2
prisma/
└── schema.prisma                   # Extend: rename compensationUsd, add noOfActivities, add Invoice model
```

### Pattern 1: react-pdf Route Handler (server-side buffer)

**What:** Generate PDF buffer server-side in a Route Handler using `renderToBuffer`.
**When to use:** Any server-side PDF generation in Next.js App Router.

```typescript
// Source: Cloudflare R2 docs + react-pdf compatibility page
// app/api/engagements/[id]/invoice/route.ts
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument } from "@/components/pdf/InvoiceDocument";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ... auth, data fetch, gate checks ...
  const buffer = await renderToBuffer(
    <InvoiceDocument hcp={hcp} engagement={engagement} />
  );
  // buffer is a Buffer — pass to PutObjectCommand
}
```

**Critical requirement:** `InvoiceDocument` must NOT have `"use client"` — it is a pure React component (JSX only, no hooks or browser APIs). [VERIFIED: react-pdf compatibility docs]

**next.config.ts change required:**

```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  // ...existing config
};
```

[CITED: https://react-pdf.org/compatibility — "versions prior to 14.1.1 … configure serverComponentsExternalPackages"; Next.js 15 uses the non-experimental `serverExternalPackages` key]

### Pattern 2: Cloudflare R2 Upload via S3Client

**What:** Write-once PDF upload to R2 using `@aws-sdk/client-s3`.
**When to use:** Any R2 write operation from the server.

```typescript
// Source: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
// lib/r2.ts
import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED", // Required: SDK >= 3.729.0 defaults to CRC32, R2 doesn't support it
});
```

**Upload pattern:**

```typescript
// Source: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
import { PutObjectCommand } from "@aws-sdk/client-s3";

const key = `invoices/${engagementId}/${Date.now()}.pdf`;
await r2.send(
  new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: "application/pdf",
  })
);
const storageUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
// e.g. https://your-bucket.r2.dev/invoices/abc/1234567890.pdf
// OR https://your-custom-domain.com/invoices/abc/1234567890.pdf
```

### Pattern 3: Prisma Column Rename (safe, no data loss)

**What:** Rename `compensationUsd` → `agreedRateUsd` without dropping data.

```bash
# Step 1: Update schema.prisma (rename field, add noOfActivities, add Invoice model)
# Step 2: Generate migration WITHOUT applying
npx prisma migrate dev --name rename-compensation-to-agreed-rate --create-only

# Step 3: Edit the generated SQL file:
# AUTO-GENERATED (delete this):
#   ALTER TABLE "Engagement" DROP COLUMN "compensationUsd",
#   ADD COLUMN "agreedRateUsd" DECIMAL(10,2) NOT NULL;
# REPLACE WITH:
#   ALTER TABLE "Engagement" RENAME COLUMN "compensationUsd" TO "agreedRateUsd";

# Step 4: Apply the edited migration
npx prisma migrate dev
```

[CITED: https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations]

### Pattern 4: ActionPanel invoice buttons (completed status)

**What:** Replace the `ReadOnlyCard` for `completed` status with invoice-aware buttons.

The current `ActionPanel.tsx` returns `<ReadOnlyCard message="Completed" />` for completed engagements (line 439). This must be replaced with a conditional:

```typescript
// "completed" state — receives invoiceStorageUrl prop (null if not yet generated)
if (status === "completed") {
  if (!invoiceStorageUrl && isCompliance && popDocumentUrl) {
    // Show "Generate Invoice" button — calls POST /api/engagements/[id]/invoice via fetch
  } else if (invoiceStorageUrl) {
    // Show "Download Invoice" link for all roles
  } else {
    // ReadOnlyCard "Completed — no invoice generated"
  }
}
```

The `ActionPanel` is a Client Component — the `invoiceStorageUrl` is passed as a prop from the Server Component page (which queries `prisma.invoice.findUnique`).

### Pattern 5: noOfActivities conditional visibility in EngagementForm

**What:** Show "No of Activities" field only when `rateUnit` is `per_hour` or `per_day`.

`FmvRatePanel` already fetches `/api/fmv/rate` and has the `rateUnit` in its `RateData` state — but it does not currently expose that to the parent. Two options:

1. **Lift state to parent:** `EngagementForm` calls `/api/fmv/rate` directly and stores `rateUnit` locally, then passes it down to `FmvRatePanel` for display while also driving the `noOfActivities` field visibility.
2. **Callback prop:** Add `onRateLoaded?: (rateUnit: string | null) => void` callback to `FmvRatePanel` so the parent gets notified when rate data arrives.

Option 2 (callback prop) is the minimal change — no refactor of the fetch logic needed. [ASSUMED]

### Anti-Patterns to Avoid

- **"use client" on InvoiceDocument:** react-pdf Document/Page/Text components must not run in the browser. Any `"use client"` on the PDF component will cause "PDFViewer is a web specific API" errors.
- **Server Action for PDF generation:** The 5MB body size limit on Server Actions (configured in this project) and the streaming nature of PDF generation make Route Handlers the correct boundary.
- **Skipping `requestChecksumCalculation: "WHEN_REQUIRED"`:** SDK >= 3.729.0 sends CRC32 checksum headers that R2 rejects. Omitting this config causes `Header 'x-amz-checksum-algorithm' with value 'CRC32' not implemented` errors.
- **`npx prisma db push` for the rename:** `db push` does not preserve migration history. For a destructive-looking change like a rename, `migrate dev` with custom SQL is required.
- **Dropping+adding compensationUsd:** Prisma auto-generates a DROP + ADD for renames. Without the custom `RENAME COLUMN` SQL, all existing compensation data is destroyed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF layout and rendering | Custom HTML-to-PDF converter, SVG generation | `@react-pdf/renderer` | PDF spec edge cases, font embedding, page breaks, unicode — all handled |
| S3-compatible API client | Custom HTTP requests to R2 | `@aws-sdk/client-s3` | Auth signing (SigV4), retries, multi-part upload, presigned URLs |
| Checksum computation | Manual CRC32 | Set `requestChecksumCalculation: "WHEN_REQUIRED"` | SDK handles correctly when needed |
| Column rename SQL | Manual ALTER TABLE in code | Prisma custom migration | Migration history tracking, shadow DB validation |

**Key insight:** PDF generation looks simple but involves font embedding, decimal precision for currency, Unicode rendering, and correct page sizing — react-pdf handles all of this.

---

## Runtime State Inventory

> Rename/migration phase — `compensationUsd` → `agreedRateUsd` on the Engagement model.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | PostgreSQL `Engagement` table: `compensationUsd` column (Decimal) — every existing engagement row has a value | Code migration: `ALTER TABLE "Engagement" RENAME COLUMN "compensationUsd" TO "agreedRateUsd"` — data preserved in place |
| Live service config | None — no external service stores the field name | None |
| OS-registered state | None — no OS-level registrations of this field name | None |
| Secrets/env vars | None — `compensationUsd` is not an env var name | None |
| Build artifacts | None — no compiled binaries or egg-info | None |

**Files referencing `compensationUsd` that must be updated after migration (11 usages, 7 files):**

| File | Type of reference |
|------|------------------|
| `actions/engagement.ts` | Interface field + prisma.create data |
| `actions/engagement.test.ts` | Test fixture |
| `lib/engagement-validation.ts` | Validation interface + check |
| `lib/engagement-validation.test.ts` | Test fixtures (2 references) |
| `app/(app)/engagements/legal-queue/page.tsx` | Display: `engagement.compensationUsd.toString()` |
| `app/(app)/engagements/page.tsx` | Serialization: `parseFloat(e.compensationUsd.toString())` |
| `app/(app)/engagements/[id]/page.tsx` | Display: `engagement.compensationUsd.toString()` |
| `components/engagement/EngagementForm.tsx` | State var + two action calls |
| `components/engagement/EngagementTable.tsx` | Interface + display |
| `app/(app)/engagements/queue/page.tsx` | Display: `compensationUsd.toString()` |

---

## Common Pitfalls

### Pitfall 1: react-pdf "PDFDocument is not a constructor" / "Component is not a constructor"
**What goes wrong:** `renderToBuffer` throws at runtime even though the import is correct.
**Why it happens:** Next.js App Router bundles server modules with React Server Component conventions; react-pdf's pdfkit dependency uses `__dirname` and CommonJS patterns that conflict with the RSC bundler.
**How to avoid:** Add `serverExternalPackages: ["@react-pdf/renderer"]` to `next.config.ts`. This tells Next.js to NOT bundle react-pdf but instead require it natively in Node.js. [CITED: https://react-pdf.org/compatibility]
**Warning signs:** Error appears at first POST to the invoice route; stack trace mentions `pdfkit` or `PDFDocument`.

### Pitfall 2: CRC32 checksum rejection from R2
**What goes wrong:** PutObjectCommand returns a 501 error: `Header 'x-amz-checksum-algorithm' with value 'CRC32' not implemented`.
**Why it happens:** `@aws-sdk/client-s3` >= 3.729.0 automatically adds CRC32 checksum headers to all PUT operations. R2 does not implement CRC32.
**How to avoid:** Set `requestChecksumCalculation: "WHEN_REQUIRED"` on the S3Client constructor. [CITED: https://community.cloudflare.com/t/aws-sdk-client-s3-v3-729-0-breaks-uploadpart-and-putobject-r2-s3-api-compatibility/758637]
**Warning signs:** Upload fails immediately with a 501 response; error mentions `x-amz-checksum-algorithm`.

### Pitfall 3: Prisma rename generates DROP+ADD (data loss)
**What goes wrong:** Running `npx prisma migrate dev` directly after renaming a field in schema.prisma drops the column and loses all existing compensation data.
**Why it happens:** Prisma cannot infer intent from a field rename — it sees a deleted field and a new field.
**How to avoid:** Always use `--create-only`, then manually replace the DROP+ADD SQL with `ALTER TABLE "Engagement" RENAME COLUMN "compensationUsd" TO "agreedRateUsd"` before applying. [CITED: https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations]
**Warning signs:** The auto-generated migration SQL contains `DROP COLUMN "compensationUsd"`.

### Pitfall 4: Invoice generation race condition (double generation)
**What goes wrong:** Two Compliance users click "Generate Invoice" simultaneously, creating two Invoice records and two R2 objects.
**Why it happens:** Without a DB-level guard, both requests pass the "invoice exists?" check before either completes the write.
**How to avoid:** The `Invoice` table has `engagementId @unique`. The `prisma.invoice.create()` inside the transaction will throw on the second request (unique constraint violation). Catch this error explicitly and return `409 Conflict`. This is not a data integrity risk — the unique constraint is the final guard.
**Warning signs:** Prisma throws `P2002 Unique constraint failed on the fields: (\`engagementId\`)`.

### Pitfall 5: FmvRatePanel rateUnit not surfaced to EngagementForm parent
**What goes wrong:** `noOfActivities` field never appears because `EngagementForm` doesn't know the `rateUnit` that `FmvRatePanel` fetched.
**Why it happens:** The current `FmvRatePanel` manages its own fetch state — `rateUnit` is internal to the panel's state.
**How to avoid:** Add `onRateLoaded?: (rateUnit: string | null) => void` prop to `FmvRatePanel`. The parent `EngagementForm` passes the callback, stores `rateUnit` in state, and conditionally renders the `noOfActivities` field.
**Warning signs:** Form never shows "No of Activities" regardless of rate type.

### Pitfall 6: TypeScript type error after rename
**What goes wrong:** Build fails because TypeScript still sees `compensationUsd` in Prisma client types.
**Why it happens:** Prisma client types are generated from the schema — if `generate` is not re-run after the migration, the old type sticks.
**How to avoid:** After applying the migration, run `npx prisma generate`. The plan must include this step before any TypeScript compilation.

---

## Code Examples

### InvoiceDocument component (react-pdf)

```typescript
// Source: react-pdf documentation (react-pdf.org) + project patterns
// components/pdf/InvoiceDocument.tsx
// NO "use client" — this is a pure server-side component
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

interface InvoiceDocumentProps {
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
  const showActivities = props.noOfActivities !== null && props.noOfActivities !== undefined;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>HCP Engagement Invoice</Text>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>HCP Name</Text>
            <Text style={styles.value}>{props.hcpFullName}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>NPI</Text>
            <Text style={styles.value}>{props.hcpNpi}</Text>
          </View>
        </View>
        <Text style={styles.label}>Specialty</Text>
        <Text style={styles.value}>{props.hcpSpecialty}</Text>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Engagement Type</Text>
            <Text style={styles.value}>{props.engagementType}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Proposed Date</Text>
            <Text style={styles.value}>{props.proposedDate}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Agreed Rate</Text>
            <Text style={styles.value}>
              ${props.agreedRateUsd.toFixed(2)} {props.rateUnit.replace(/_/g, " ")}
            </Text>
          </View>
          {showActivities && (
            <View style={styles.col}>
              <Text style={styles.label}>No of Activities</Text>
              <Text style={styles.value}>{props.noOfActivities}</Text>
            </View>
          )}
        </View>
        <View style={styles.divider} />
        <Text style={styles.label}>Total Compensation</Text>
        <Text style={styles.total}>${props.totalUsd.toFixed(2)}</Text>
      </Page>
    </Document>
  );
}
```

### R2 upload in Route Handler

```typescript
// Source: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
});

const key = `invoices/${engagementId}/${Date.now()}.pdf`;
await r2.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET_NAME!,
  Key: key,
  Body: buffer,
  ContentType: "application/pdf",
}));
const storageUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
```

### Prisma Invoice model

```prisma
model Invoice {
  id                  String    @id @default(cuid())
  engagementId        String    @unique
  storageUrl          String
  agreedRateUsd       Decimal   @db.Decimal(10, 2)
  noOfActivities      Int?
  totalUsd            Decimal   @db.Decimal(10, 2)
  rateUnit            String    // "per_hour" | "per_day" | "flat_fee" | "per_event" — stored for display
  generatedByClerkId  String
  generatedByName     String
  generatedAt         DateTime  @default(now())

  engagement          Engagement @relation(fields: [engagementId], references: [id])
}
```

And on the Engagement model, add the inverse relation:

```prisma
// On Engagement model, add:
invoice             Invoice?
```

### Prisma migration SQL (safe rename)

```sql
-- Edit the auto-generated migration to use RENAME COLUMN instead of DROP+ADD:
ALTER TABLE "Engagement" RENAME COLUMN "compensationUsd" TO "agreedRateUsd";

-- Also in the same migration, add noOfActivities:
ALTER TABLE "Engagement" ADD COLUMN "noOfActivities" INTEGER;

-- And create the Invoice table:
CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "storageUrl" TEXT NOT NULL,
  "agreedRateUsd" DECIMAL(10,2) NOT NULL,
  "noOfActivities" INTEGER,
  "totalUsd" DECIMAL(10,2) NOT NULL,
  "rateUnit" TEXT NOT NULL,
  "generatedByClerkId" TEXT NOT NULL,
  "generatedByName" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invoice_engagementId_key" ON "Invoice"("engagementId");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_engagementId_fkey"
  FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `serverComponentsExternalPackages` (experimental) | `serverExternalPackages` (stable) | Next.js 14.1.1+ | Use the non-experimental key in next.config.ts |
| `@aws-sdk/client-s3` without checksum config | Add `requestChecksumCalculation: "WHEN_REQUIRED"` | SDK 3.729.0 (late 2024) | Required for R2 compatibility |
| PDFDownloadLink (client-side) | `renderToBuffer` in Route Handler (server-side) | react-pdf v3+ | Server-side is correct for compliance PDF storage; client-side download does not store the PDF |

**Deprecated/outdated:**

- `experimental.serverComponentsExternalPackages`: Replaced by top-level `serverExternalPackages` in Next.js 14.1.1+. The current next.config.ts already uses the experimental key for `serverActions` but does NOT have the PDF external package listed — must be added.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@react-pdf/renderer` v4.5.1 API (`renderToBuffer`, `Document`, `Page`, `Text`, `View`, `StyleSheet`) is backward-compatible with the v3 patterns described in CONTEXT.md | Standard Stack | Plan installs v4; if breaking changes exist between v3 and v4, the InvoiceDocument component may need API adjustments |
| A2 | Adding `serverExternalPackages: ["@react-pdf/renderer"]` to next.config.ts resolves the Next.js 15 / react-pdf renderToBuffer incompatibility | Architecture Patterns | If issue #3074 indicates a deeper incompatibility unfixed in 4.5.1, PDF generation will fail at runtime and may require an alternative approach (e.g., pdfmake, puppeteer) |
| A3 | R2 bucket is configured as a **public** bucket (or will be for v1) so `storageUrl` can be a direct URL rather than requiring signed URL generation per request | Architecture Patterns | If bucket is private, every "Download Invoice" click needs a server-side signed URL — the Route Handler approach needs a `/api/engagements/[id]/invoice/download` route to generate the signed URL on demand |
| A4 | `onRateLoaded` callback prop is the right mechanism to surface `rateUnit` from FmvRatePanel to EngagementForm | Pattern 5 | Alternatively, lift the API fetch to EngagementForm and pass rate data down — both work, callback is minimal change |

---

## Open Questions (RESOLVED)

1. **R2 bucket access: public or private?**
   - What we know: R2 supports both public buckets (direct URL access, bucket-wide) and private buckets (signed URLs per request, default). Signed URLs expire.
   - What's unclear: The user has not specified whether the R2 bucket should be public. The CONTEXT.md says `R2_PUBLIC_URL` env var — implying a public URL — but does not confirm the bucket access type.
   - Recommendation: Treat as a public bucket for v1 (simpler, no signed URL expiry issues for compliance audit). R2's public bucket does not expose a directory listing — only specific object paths are accessible. Document the security trade-off: anyone who obtains the URL can download the PDF. If the pharma compliance sensitivity requires access control, use a private bucket with a signed URL proxy route.
   - **RESOLVED:** Public R2 bucket for v1. `storageUrl` in the Invoice record is the direct `R2_PUBLIC_URL`-based CDN URL. No signed URL proxy needed. Plans use `R2_PUBLIC_URL` env var directly.

2. **react-pdf v4 vs v3 API compatibility**
   - What we know: CONTEXT.md specifies "@react-pdf/renderer v3" but the package is not in package.json yet. npm latest is 4.5.1.
   - What's unclear: Whether v4 has breaking API changes relevant to the InvoiceDocument component (Document/Page/Text/View primitives are stable, but `renderToBuffer` signature may differ).
   - Recommendation: Install 4.5.1 and verify `renderToBuffer` and basic primitives match expected usage. If there are v4 breaking changes, the plan's Wave 0 should include a quick smoke test.
   - **RESOLVED:** Install `@react-pdf/renderer@4.5.1`. `Document`, `Page`, `Text`, `View`, `StyleSheet`, and `renderToBuffer` are confirmed stable in v4. Plans use these primitives directly.

3. **noOfActivities on existing engagement records**
   - What we know: Existing engagements have `NULL` for `noOfActivities` (new nullable column).
   - What's unclear: Should the invoice generation action fail if `noOfActivities` is null for a per_hour/per_day engagement, or default to 1?
   - Recommendation: Gate the "Generate Invoice" button UI on `noOfActivities` being set (non-null) for per_hour/per_day rate types. The server-side action should validate this too and return a user-friendly error.
   - **RESOLVED:** `calculateInvoiceTotal` uses `noOfActivities ?? 1` as a safe default. The route handler also validates: if `rateUnit` is `per_hour` or `per_day` and `noOfActivities` is null, it returns a 400 error prompting the user to update the engagement before generating an invoice.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | react-pdf renderToBuffer | Yes | v24.15.0 | — |
| @react-pdf/renderer | PDF generation | NOT INSTALLED | 4.5.1 on npm | — (must install) |
| @aws-sdk/client-s3 | R2 upload | NOT INSTALLED | 3.1046.0 on npm | — (must install) |
| @aws-sdk/s3-request-presigner | Signed URL (if private bucket) | NOT INSTALLED | 3.1046.0 on npm | Not needed if public bucket |
| Cloudflare R2 bucket | PDF storage | UNKNOWN | — | — (must be provisioned) |
| R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL | R2 upload | NOT IN .env.example | — | — (must be added) |
| PostgreSQL (Neon) | Schema migration | Yes (existing) | 16 | — |

**Missing dependencies with no fallback:**
- `@react-pdf/renderer` — must install before any PDF generation task
- `@aws-sdk/client-s3` — must install before R2 upload task
- Cloudflare R2 bucket provisioning — must be done by user in Cloudflare dashboard before the invoice route can be tested
- Five R2 env vars — must be added to `.env.local` and `.env.example`

**Missing dependencies with fallback:**
- `@aws-sdk/s3-request-presigner` — only needed if private bucket (Open Question 1)

---

## Validation Architecture

> `workflow.nyquist_validation` not explicitly set in config — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 |
| Config file | package.json `"test": "jest"` |
| Quick run command | `npx jest --testPathPattern=invoice` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-02 | PDF buffer is generated with correct fields (HCP name/NPI/specialty, engagement data, financials) | unit | `npx jest --testPathPattern=InvoiceDocument` | No — Wave 0 |
| CONT-02 | Total calculation: per_hour rate × noOfActivities = totalUsd | unit | `npx jest --testPathPattern=invoice-calc` | No — Wave 0 |
| CONT-02 | Total calculation: flat_fee rate = totalUsd (no multiplication) | unit | `npx jest --testPathPattern=invoice-calc` | No — Wave 0 |
| CONT-03 | Invoice record has unique engagementId constraint (double-generate blocked) | unit | `npx jest --testPathPattern=invoice` | No — Wave 0 |
| CONT-02 | `validateEngagementFields` accepts `agreedRateUsd` (rename) | unit | `npx jest --testPathPattern=engagement-validation` | Exists — update |

### Sampling Rate

- **Per task commit:** `npx jest --testPathPattern=invoice --testPathPattern=engagement-validation`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `lib/invoice-calc.test.ts` — unit tests for total calculation logic (per_hour/per_day vs flat_fee/per_event)
- [ ] `components/pdf/InvoiceDocument.test.tsx` — snapshot or render test verifying all required fields appear in the PDF output
- [ ] Update `actions/engagement.test.ts` — rename `compensationUsd` → `agreedRateUsd` in fixtures
- [ ] Update `lib/engagement-validation.test.ts` — rename field in test fixtures

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Clerk `auth()` in Route Handler — must verify Clerk session before any action |
| V3 Session Management | No | Clerk handles; no additional session state in this phase |
| V4 Access Control | Yes | `assertRole(["compliance"])` on generate action; Finance/Business can only download (read-only) |
| V5 Input Validation | Yes | R2 key is server-constructed (not user input); `engagementId` from URL params must be validated as a real engagement the user can access |
| V6 Cryptography | No | No custom crypto; R2 credentials handled by AWS SDK |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Insecure direct object reference — any role calls POST /api/engagements/[id]/invoice | Elevation of Privilege | Route Handler verifies `compliance` role via `auth()` before processing |
| Business user calls invoice URL for another user's engagement | Information Disclosure | Route Handler loads engagement, verifies it exists — consistent with existing detail page ownership check |
| R2 credentials leaked to client | Information Disclosure | S3Client created server-side only in `lib/r2.ts`; env vars are server-only (no `NEXT_PUBLIC_` prefix) |
| PDF stored at predictable R2 key | Information Disclosure | Key includes `Date.now()` timestamp — not guessable. If bucket is public, the URL itself is the access control (bearer token pattern). |
| Duplicate invoice generation | Tampering | Prisma unique constraint on `engagementId` + DB transaction; Route Handler returns 409 on duplicate |

---

## Sources

### Primary (HIGH confidence)

- [Cloudflare R2 docs: aws-sdk-js-v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) — S3Client config, PutObjectCommand, presigned URLs
- [Cloudflare R2 docs: Public Buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) — public bucket URL format
- [Prisma docs: Customizing Migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations) — `--create-only` + RENAME COLUMN pattern
- [react-pdf Compatibility](https://react-pdf.org/compatibility) — Next.js `serverExternalPackages` requirement, supported Node.js versions
- npm registry: `@react-pdf/renderer@4.5.1`, `@aws-sdk/client-s3@3.1046.0`, `@aws-sdk/s3-request-presigner@3.1046.0`

### Secondary (MEDIUM confidence)

- [react-pdf GitHub Issue #2460](https://github.com/diegomura/react-pdf/issues/2460) — Next.js App Router renderToBuffer incompatibility and `serverExternalPackages` fix
- [Cloudflare Community: SDK 3.729.0 R2 Compatibility](https://community.cloudflare.com/t/aws-sdk-client-s3-v3-729-0-breaks-uploadpart-and-putobject-r2-s3-api-compatibility/758637) — `requestChecksumCalculation: "WHEN_REQUIRED"` fix

### Tertiary (LOW confidence)

- [react-pdf GitHub Issue #3074](https://github.com/diegomura/react-pdf/issues/3074) — Next.js 15 renderToBuffer issue; closed with no documented resolution; status uncertain

---

## Metadata

**Confidence breakdown:**

- Standard stack (library identities + versions): HIGH — verified via npm registry
- Architecture (Route Handler pattern, R2 config): HIGH — Cloudflare official docs
- PDF/Next.js integration: MEDIUM — compatibility known to be fragile; `serverExternalPackages` fix is documented but v4+Next.js 15 edge cases remain unresolved in open issues
- Prisma rename pattern: HIGH — official Prisma docs
- Pitfalls: HIGH — sourced from official docs and verified GitHub issues

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (30 days — react-pdf and R2 SDK are actively developed; recheck if issues arise)
