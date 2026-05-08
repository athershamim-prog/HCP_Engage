---
phase: 01-auth-hcp-management
plan: 02
type: execute
wave: 2
depends_on:
  - "01-PLAN-skeleton.md"
files_modified:
  - app/api/nppes/route.ts
  - lib/nppes.ts
  - actions/hcp.ts
  - app/(app)/hcps/page.tsx
  - app/(app)/hcps/new/page.tsx
  - components/hcp/HcpTable.tsx
  - components/hcp/HcpStatusBadge.tsx
  - components/hcp/DebarmentBadge.tsx
  - components/hcp/NpiLookupForm.tsx
  - components/shared/EmptyState.tsx
  - lib/nppes.test.ts
autonomous: true
requirements:
  - HCP-01
  - HCP-02

must_haves:
  truths:
    - "A Business or Compliance user can enter a 10-digit NPI and see canonical HCP data pulled from NPPES (name, credentials, NUCC specialty, primary state, HCO affiliation)"
    - "After clicking 'Add to Directory', a local Hcp record is created in the database and the user is navigated to the HCP profile page"
    - "If the NPI is already in the system, the result card shows a banner and a 'View Profile' button instead of 'Add to Directory'"
    - "The HCP Directory page shows a filterable, paginated table of all HCPs with status and debarment badges"
    - "Finance users cannot access /hcps or /hcps/new — middleware redirects them to /dashboard"
    - "Search is debounced 300ms and filters by name (contains) and NPI (exact prefix)"
  artifacts:
    - path: "lib/nppes.ts"
      provides: "fetchNppesHcp() — calls CMS NPPES API and maps response to NppesHcp type"
      exports: ["fetchNppesHcp", "NppesHcp"]
    - path: "app/api/nppes/route.ts"
      provides: "GET /api/nppes?npi= proxy — calls lib/nppes.ts, returns structured JSON"
      exports: ["GET"]
    - path: "actions/hcp.ts"
      provides: "addHcp() Server Action — creates Hcp record from NPPES data"
      exports: ["addHcp", "searchHcps"]
    - path: "app/(app)/hcps/page.tsx"
      provides: "HCP Directory page — full table with filter bar and pagination"
    - path: "app/(app)/hcps/new/page.tsx"
      provides: "NPI Lookup page — Add HCP flow"
    - path: "components/hcp/HcpTable.tsx"
      provides: "Sortable data table matching UI-SPEC columns exactly"
    - path: "components/hcp/HcpStatusBadge.tsx"
      provides: "Status badge with color map from UI-SPEC"
    - path: "components/hcp/DebarmentBadge.tsx"
      provides: "Debarment badge with color map from UI-SPEC"
  key_links:
    - from: "app/(app)/hcps/new/page.tsx"
      to: "app/api/nppes/route.ts"
      via: "NpiLookupForm fetch call to /api/nppes?npi="
      pattern: "api/nppes"
    - from: "app/(app)/hcps/new/page.tsx"
      to: "actions/hcp.ts"
      via: "addHcp() Server Action called on 'Add to Directory' click"
      pattern: "addHcp"
    - from: "app/(app)/hcps/page.tsx"
      to: "actions/hcp.ts"
      via: "searchHcps() called server-side for table data"
      pattern: "searchHcps"
---

<objective>
Deliver the HCP NPI Lookup flow and HCP Directory as a complete vertical slice: the user can search NPPES by NPI, see canonical HCP data, add it to the local database, and view the full directory with filtering. After this plan, a Business or Compliance user can perform their primary job function — onboarding HCPs.

Purpose: Satisfies HCP-01 (NPI verification) and HCP-02 (profile view) end-to-end.
Output: Working NPPES lookup form, HCP local record creation, and filterable HCP directory table.
</objective>

<execution_context>
@C:/Users/HP/HCP_Engage/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/HCP_Engage/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:\Users\HP\HCP_Engage\.planning\ROADMAP.md
@C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-CONTEXT.md
@C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-UI-SPEC.md

<!-- Prior plan artifacts used by this plan -->
<!-- lib/prisma.ts — Prisma singleton (from Plan 01) -->
<!-- lib/auth.ts — getEffectiveRoles(), AppRole type (from Plan 01) -->
<!-- prisma/schema.prisma — Hcp model definition (from Plan 01) -->

<interfaces>
<!-- Hcp model from prisma/schema.prisma (Plan 01) -->
```typescript
// Prisma-generated Hcp type (representative — use Prisma.HcpGetPayload for full type)
interface Hcp {
  id: string;
  npi: string;
  firstName: string;
  lastName: string;
  fullName: string;
  credentials: string | null;
  nuccCode: string;
  nuccDisplayName: string;
  primaryState: string;
  hcoAffiliation: string | null;
  status: "active" | "inactive" | "suspended" | "do_not_engage";
  debarmentCheckedAt: Date | null;
  debarmentStatus: "not_checked" | "clear" | "hit";
  addedByClerkId: string;
  addedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

// HcpStatus enum values (from Prisma schema)
// active | inactive | suspended | do_not_engage

// DebarmentStatus enum values (from Prisma schema)
// not_checked | clear | hit
```

<!-- AppRole from lib/auth.ts (Plan 01) -->
```typescript
export type AppRole = "business" | "compliance" | "finance";
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: NPPES API client, proxy route, and addHcp Server Action</name>
  <read_first>
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-CONTEXT.md (decisions D-08, D-09, D-10)
    - C:\Users\HP\HCP_Engage\prisma\schema.prisma (Hcp model field names and types)
    - C:\Users\HP\HCP_Engage\lib\prisma.ts (Prisma singleton import pattern)
  </read_first>
  <files>
    lib/nppes.ts, lib/nppes.test.ts, app/api/nppes/route.ts, actions/hcp.ts
  </files>
  <behavior>
    - Test 1: mapNppesResult(validApiResponse) returns NppesHcp with fullName, nuccCode, nuccDisplayName, primaryState, credentials, hcoAffiliation
    - Test 2: mapNppesResult(responseWithNoTaxonomy) returns NppesHcp with nuccCode = "" and nuccDisplayName = "Unknown Specialty"
    - Test 3: mapNppesResult(responseWithNoAffiliation) returns NppesHcp with hcoAffiliation = null
    - Test 4: mapNppesResult(individualWithCredentials) extracts credential suffix from name object (e.g., "MD, PhD")
    - Test 5: validateNpi("1234567890") returns true
    - Test 6: validateNpi("123") returns false (not 10 digits)
    - Test 7: validateNpi("12345abcde") returns false (non-numeric)
  </behavior>
  <action>
Create `lib/nppes.ts` — NPPES API client:

```typescript
export interface NppesHcp {
  npi: string;
  firstName: string;
  lastName: string;
  fullName: string;
  credentials: string | null;
  nuccCode: string;
  nuccDisplayName: string;
  primaryState: string;
  hcoAffiliation: string | null;
}

export function validateNpi(npi: string): boolean {
  return /^\d{10}$/.test(npi);
}

// Maps NPPES API response to our internal NppesHcp type.
// NPPES API docs: https://npiregistry.cms.hhs.gov/api-page
// Response structure: { results: Array<{ number, basic, taxonomies, addresses, ... }> }
export function mapNppesResult(apiResult: Record<string, unknown>): NppesHcp {
  const basic = apiResult.basic as Record<string, string> | undefined;
  const taxonomies = apiResult.taxonomies as Array<{ code: string; desc: string; primary: boolean }> | undefined;
  const addresses = apiResult.addresses as Array<{ state: string; address_purpose: string }> | undefined;
  const otherNames = apiResult.other_names as Array<unknown> | undefined;

  // Full name
  const firstName = basic?.first_name ?? basic?.authorized_official_first_name ?? "";
  const lastName = basic?.last_name ?? basic?.authorized_official_last_name ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") ||
    (basic?.organization_name ?? "Unknown");

  // Credentials: from basic.credential (e.g., "M.D.") — normalize to "MD"
  const rawCredential = basic?.credential ?? "";
  const credentials = rawCredential.replace(/\./g, "").trim() || null;

  // NUCC taxonomy — use the primary taxonomy or first available
  const primaryTaxonomy = taxonomies?.find((t) => t.primary) ?? taxonomies?.[0];
  const nuccCode = primaryTaxonomy?.code ?? "";
  const nuccDisplayName = primaryTaxonomy?.desc ?? "Unknown Specialty";

  // Primary state — use "LOCATION" address if available, else first address
  const locationAddress = addresses?.find((a) => a.address_purpose === "LOCATION") ?? addresses?.[0];
  const primaryState = locationAddress?.state ?? "";

  // HCO affiliation — NPPES does not have a direct "HCO affiliation" field.
  // Use organization_name from basic if this is an individual with an org association,
  // or check if the NPI belongs to an organization subpart.
  // For v1: use basic.organization_name if present, else null.
  const hcoAffiliation = basic?.organization_name ?? null;

  return {
    npi: String(apiResult.number ?? ""),
    firstName,
    lastName,
    fullName,
    credentials,
    nuccCode,
    nuccDisplayName,
    primaryState,
    hcoAffiliation,
  };
}

export async function fetchNppesHcp(npi: string): Promise<NppesHcp | null> {
  if (!validateNpi(npi)) throw new Error("Invalid NPI format");

  const url = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&enumeration_type=&taxonomy_description=&name_purpose=&first_name=&use_first_name_alias=&last_name=&organization_name=&address_purpose=&city=&state=&postal_code=&country_code=&limit=1&skip=0&pretty=&version=2.1`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 }, // No caching — NPI lookups must be fresh
  });

  if (!res.ok) throw new Error(`NPPES API error: ${res.status}`);

  const data = await res.json() as { result_count: number; results: Array<Record<string, unknown>> };

  if (data.result_count === 0 || !data.results?.length) return null;

  return mapNppesResult(data.results[0]);
}
```

Create `lib/nppes.test.ts`:
```typescript
import { validateNpi, mapNppesResult, NppesHcp } from "./nppes";

const validApiResponse = {
  number: "1234567890",
  basic: {
    first_name: "Jane",
    last_name: "Smith",
    credential: "M.D.",
  },
  taxonomies: [
    { code: "207R00000X", desc: "Internal Medicine", primary: true },
  ],
  addresses: [
    { state: "CA", address_purpose: "LOCATION" },
  ],
};

describe("validateNpi", () => {
  it("returns true for 10-digit numeric NPI", () => {
    expect(validateNpi("1234567890")).toBe(true);
  });
  it("returns false for NPI with fewer than 10 digits", () => {
    expect(validateNpi("123")).toBe(false);
  });
  it("returns false for NPI with non-numeric characters", () => {
    expect(validateNpi("12345abcde")).toBe(false);
  });
});

describe("mapNppesResult", () => {
  it("maps valid API response to NppesHcp", () => {
    const result = mapNppesResult(validApiResponse);
    expect(result.npi).toBe("1234567890");
    expect(result.fullName).toBe("Jane Smith");
    expect(result.credentials).toBe("MD");
    expect(result.nuccCode).toBe("207R00000X");
    expect(result.nuccDisplayName).toBe("Internal Medicine");
    expect(result.primaryState).toBe("CA");
  });

  it("returns Unknown Specialty when no taxonomy", () => {
    const noTaxonomy = { ...validApiResponse, taxonomies: [] };
    const result = mapNppesResult(noTaxonomy);
    expect(result.nuccCode).toBe("");
    expect(result.nuccDisplayName).toBe("Unknown Specialty");
  });

  it("returns null hcoAffiliation when no organization_name", () => {
    const result = mapNppesResult(validApiResponse);
    expect(result.hcoAffiliation).toBeNull();
  });

  it("extracts credentials without dots", () => {
    const result = mapNppesResult(validApiResponse);
    expect(result.credentials).toBe("MD");
  });
});
```

Create `app/api/nppes/route.ts` — Next.js Route Handler proxying NPPES:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchNppesHcp } from "@/lib/nppes";

export async function GET(request: NextRequest) {
  // Require authentication
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
    return NextResponse.json(
      { error: "NPPES lookup failed" },
      { status: 502 }
    );
  }
}
```

Create `actions/hcp.ts` — Server Actions for HCP:
```typescript
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { NppesHcp } from "@/lib/nppes";
import type { Hcp } from "@prisma/client";

export type HcpSearchResult = Pick<
  Hcp,
  | "id"
  | "npi"
  | "fullName"
  | "credentials"
  | "nuccDisplayName"
  | "primaryState"
  | "status"
  | "debarmentStatus"
  | "updatedAt"
>;

/**
 * Create a new HCP record from NPPES-verified data.
 * Returns the new HCP id (caller redirects to /hcps/[id]).
 */
export async function addHcp(nppesData: NppesHcp): Promise<{ id: string }> {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const role = (user.publicMetadata as { role?: string }).role;
  if (role !== "business" && role !== "compliance") {
    throw new Error("Forbidden: only Business and Compliance users can add HCPs");
  }

  // Check for existing HCP with this NPI
  const existing = await prisma.hcp.findUnique({ where: { npi: nppesData.npi } });
  if (existing) {
    return { id: existing.id };
  }

  const hcp = await prisma.hcp.create({
    data: {
      npi: nppesData.npi,
      firstName: nppesData.firstName,
      lastName: nppesData.lastName,
      fullName: nppesData.fullName,
      credentials: nppesData.credentials,
      nuccCode: nppesData.nuccCode,
      nuccDisplayName: nppesData.nuccDisplayName,
      primaryState: nppesData.primaryState,
      hcoAffiliation: nppesData.hcoAffiliation,
      status: "active",
      debarmentStatus: "not_checked",
      addedByClerkId: user.id,
      addedByName: user.fullName ?? "Unknown",
    },
  });

  return { id: hcp.id };
}

/**
 * Search HCPs for the directory page.
 * Filters by name (contains, case-insensitive) or NPI (prefix match).
 * Status filter is optional multi-value.
 */
export async function searchHcps(params: {
  query?: string;
  statuses?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ hcps: HcpSearchResult[]; total: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { query, statuses, page = 1, pageSize = 20 } = params;

  const where: Parameters<typeof prisma.hcp.findMany>[0]["where"] = {};

  if (query && query.trim()) {
    const q = query.trim();
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { npi: { startsWith: q } },
    ];
  }

  if (statuses && statuses.length > 0) {
    where.status = { in: statuses as Hcp["status"][] };
  }

  const [hcps, total] = await Promise.all([
    prisma.hcp.findMany({
      where,
      select: {
        id: true,
        npi: true,
        fullName: true,
        credentials: true,
        nuccDisplayName: true,
        primaryState: true,
        status: true,
        debarmentStatus: true,
        updatedAt: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.hcp.count({ where }),
  ]);

  return { hcps, total };
}
```
  </action>
  <verify>
    <automated>cd C:/Users/HP/HCP_Engage && npx jest lib/nppes.test.ts 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `lib/nppes.test.ts` all 7 tests pass: `npx jest lib/nppes.test.ts` output shows "7 passed"
    - `lib/nppes.ts` exports `fetchNppesHcp`, `mapNppesResult`, `validateNpi`, `NppesHcp` type
    - `app/api/nppes/route.ts` exports `GET` and contains `auth()` check returning 401 for unauthenticated requests
    - `app/api/nppes/route.ts` calls `fetchNppesHcp` and returns `{ found: false }` (not 404) when NPPES returns no result
    - `actions/hcp.ts` contains `"use server"` directive at top of file
    - `actions/hcp.ts` `addHcp()` checks `role !== "business" && role !== "compliance"` and throws "Forbidden" if finance user calls it
    - `actions/hcp.ts` `addHcp()` calls `prisma.hcp.findUnique` before create to detect duplicates
    - `actions/hcp.ts` `searchHcps()` uses `prisma.hcp.findMany` with `where.OR` for name/NPI search
  </acceptance_criteria>
  <done>NPPES client tested and working. Proxy route handler protected by Clerk auth. addHcp Server Action creates HCP records with role guard. searchHcps supports name/NPI search with pagination.</done>
</task>

<task type="auto">
  <name>Task 2: HCP Directory page, NPI Lookup page, and badge components</name>
  <read_first>
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-UI-SPEC.md (Screen 3: HCP Directory, Screen 4: NPI Lookup, Copywriting Contract, Color section status badge map, Interaction Patterns)
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-CONTEXT.md (D-03: Finance has no HCP access, D-08: local storage on first lookup)
    - C:\Users\HP\HCP_Engage\actions\hcp.ts (addHcp, searchHcps signatures — from Task 1)
    - C:\Users\HP\HCP_Engage\lib\nppes.ts (NppesHcp type — from Task 1)
  </read_first>
  <files>
    components/hcp/HcpStatusBadge.tsx, components/hcp/DebarmentBadge.tsx,
    components/hcp/HcpTable.tsx, components/hcp/NpiLookupForm.tsx,
    components/shared/EmptyState.tsx,
    app/(app)/hcps/page.tsx, app/(app)/hcps/new/page.tsx
  </files>
  <action>
Create `components/hcp/HcpStatusBadge.tsx` — status badge with exact color map from UI-SPEC:
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

Create `components/hcp/DebarmentBadge.tsx` — debarment badge with color map from UI-SPEC:
```typescript
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DebarmentStatusValue = "not_checked" | "clear" | "hit";

const DEBARMENT_CONFIG: Record<DebarmentStatusValue, { label: string; className: string; showWarning: boolean }> = {
  not_checked: { label: "Not Checked", className: "bg-[hsl(215_16%_63%)] text-white border-transparent", showWarning: true },
  clear:       { label: "No Hit",      className: "bg-[hsl(142_71%_45%)] text-white border-transparent", showWarning: false },
  hit:         { label: "Match Found", className: "bg-[hsl(0_72%_51%)] text-white border-transparent",   showWarning: false },
};

export function DebarmentBadge({ status }: { status: DebarmentStatusValue }) {
  const config = DEBARMENT_CONFIG[status] ?? DEBARMENT_CONFIG.not_checked;
  return (
    <span className="flex items-center gap-1">
      {config.showWarning && (
        <AlertTriangle
          className="h-3.5 w-3.5 text-[hsl(38_92%_50%)]"
          aria-hidden="true"
        />
      )}
      <Badge
        role="status"
        aria-label={`Debarment status: ${config.label}`}
        className={cn("h-6 text-[12px] font-semibold", config.className)}
      >
        {config.label}
      </Badge>
    </span>
  );
}
```

Create `components/shared/EmptyState.tsx`:
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

Create `components/hcp/HcpTable.tsx` — data table matching UI-SPEC Screen 3 columns exactly:
```typescript
"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HcpStatusBadge } from "./HcpStatusBadge";
import { DebarmentBadge } from "./DebarmentBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { HcpSearchResult } from "@/actions/hcp";

// Install date-fns: npm install date-fns

export function HcpTable({
  hcps,
  emptyQuery,
}: {
  hcps: HcpSearchResult[];
  emptyQuery?: string;
}) {
  if (hcps.length === 0) {
    if (emptyQuery) {
      return (
        <EmptyState
          heading={`No results for "${emptyQuery}"`}
          body="Try a different name or verify the NPI number."
        />
      );
    }
    return (
      <EmptyState
        heading="No HCPs in your directory"
        body="Search by NPI to add your first HCP and begin compliance tracking."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[22%] text-[12px] font-semibold">HCP Name</TableHead>
          <TableHead className="w-[10%] text-[12px] font-semibold">NPI</TableHead>
          <TableHead className="w-[10%] text-[12px] font-semibold">Credentials</TableHead>
          <TableHead className="w-[18%] text-[12px] font-semibold">Specialty</TableHead>
          <TableHead className="w-[8%] text-[12px] font-semibold">State</TableHead>
          <TableHead className="w-[12%] text-[12px] font-semibold">Status</TableHead>
          <TableHead className="w-[12%] text-[12px] font-semibold">Debarment</TableHead>
          <TableHead className="w-[8%] text-[12px] font-semibold">Last Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {hcps.map((hcp, index) => (
          <TableRow
            key={hcp.id}
            className={`h-12 cursor-pointer hover:bg-[hsl(220_14%_96%)] transition-colors ${
              index % 2 === 1 ? "bg-[hsl(0_0%_96%)]" : "bg-white"
            }`}
            onClick={() => window.location.href = `/hcps/${hcp.id}`}
          >
            <TableCell className="font-semibold text-[14px] text-[hsl(221_83%_53%)]">
              <Link
                href={`/hcps/${hcp.id}`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {hcp.fullName}
              </Link>
            </TableCell>
            <TableCell className="font-mono text-[14px]">{hcp.npi}</TableCell>
            <TableCell className="text-[14px] max-w-0 truncate" title={hcp.credentials ?? ""}>
              {hcp.credentials ?? "—"}
            </TableCell>
            <TableCell className="text-[14px] max-w-0 truncate" title={hcp.nuccDisplayName}>
              {hcp.nuccDisplayName}
            </TableCell>
            <TableCell className="text-[14px]">{hcp.primaryState}</TableCell>
            <TableCell>
              <HcpStatusBadge status={hcp.status as import("./HcpStatusBadge").HcpStatusValue} />
            </TableCell>
            <TableCell>
              <DebarmentBadge status={hcp.debarmentStatus as import("./DebarmentBadge").DebarmentStatusValue} />
            </TableCell>
            <TableCell className="text-[14px] text-[hsl(215_16%_47%)]">
              {formatDistanceToNow(new Date(hcp.updatedAt), { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

Install date-fns: `npm install date-fns`

Create `components/hcp/NpiLookupForm.tsx` — client component for NPI search form:
```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { addHcp } from "@/actions/hcp";
import type { NppesHcp } from "@/lib/nppes";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; hcp: NppesHcp; alreadyInSystem: boolean; existingId?: string }
  | { status: "not_found"; npi: string }
  | { status: "error"; message: string };

export function NpiLookupForm() {
  const [npi, setNpi] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleNpiChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Only allow numeric input, max 10 chars
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setNpi(val);
    if (lookupState.status !== "idle") setLookupState({ status: "idle" });
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (npi.length !== 10) return;

    setLookupState({ status: "loading" });

    try {
      const res = await fetch(`/api/nppes?npi=${npi}`);
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json() as
        | { found: false }
        | { found: true; hcp: NppesHcp };

      if (!data.found) {
        setLookupState({ status: "not_found", npi });
        return;
      }

      // Check if already in system
      const checkRes = await fetch(`/api/hcps/exists?npi=${npi}`);
      const checkData = await checkRes.json() as { exists: boolean; id?: string };

      setLookupState({
        status: "found",
        hcp: data.hcp,
        alreadyInSystem: checkData.exists,
        existingId: checkData.id,
      });
    } catch {
      setLookupState({
        status: "error",
        message: "NPPES lookup failed. Check your connection and try again.",
      });
    }
  }

  function handleAdd() {
    if (lookupState.status !== "found" || lookupState.alreadyInSystem) return;
    startTransition(async () => {
      const result = await addHcp(lookupState.hcp);
      router.push(`/hcps/${result.id}`);
    });
  }

  function handleReset() {
    setNpi("");
    setLookupState({ status: "idle" });
  }

  const isSearching = lookupState.status === "loading";

  return (
    <div className="w-full max-w-[640px]">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={npi}
          onChange={handleNpiChange}
          placeholder="Enter 10-digit NPI"
          className="flex-1 h-11"
          aria-label="NPI number"
          disabled={isSearching}
        />
        <Button
          type="submit"
          disabled={npi.length !== 10 || isSearching}
          className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11 min-w-[120px]"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Searching...
            </>
          ) : (
            "Search NPI"
          )}
        </Button>
      </form>

      {/* Error states */}
      {lookupState.status === "not_found" && (
        <p className="mt-3 text-[14px] text-[hsl(0_72%_51%)]">
          No HCP found for NPI {lookupState.npi}. Verify the number and try again.
        </p>
      )}
      {lookupState.status === "error" && (
        <p className="mt-3 text-[14px] text-[hsl(0_72%_51%)]">{lookupState.message}</p>
      )}

      {/* Result card */}
      {lookupState.status === "found" && (
        <Card className="mt-4 border border-[hsl(220_13%_91%)]">
          <CardContent className="pt-6">
            {lookupState.alreadyInSystem && (
              <div className="mb-4 px-3 py-2 bg-[hsl(221_83%_96%)] rounded-md border border-[hsl(221_83%_83%)]">
                <p className="text-[14px] text-[hsl(221_83%_40%)]">
                  This HCP is already in your directory.
                </p>
              </div>
            )}

            <h3 className="text-[20px] font-semibold text-[hsl(220_13%_18%)]">
              {lookupState.hcp.fullName}
            </h3>
            {lookupState.hcp.credentials && (
              <p className="text-[12px] text-[hsl(215_16%_47%)] mt-0.5">
                {lookupState.hcp.credentials}
              </p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px]">
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Specialty</dt>
                <dd className="mt-0.5">{lookupState.hcp.nuccDisplayName} ({lookupState.hcp.nuccCode})</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Primary State</dt>
                <dd className="mt-0.5">{lookupState.hcp.primaryState || "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">HCO Affiliation</dt>
                <dd className="mt-0.5">
                  {lookupState.hcp.hcoAffiliation ?? (
                    <span className="text-[hsl(215_16%_47%)]">No affiliation on record</span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="flex gap-3 mt-6">
              {lookupState.alreadyInSystem ? (
                <Button
                  asChild
                  className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11"
                >
                  <a href={`/hcps/${lookupState.existingId}`}>View Profile</a>
                </Button>
              ) : (
                <Button
                  onClick={handleAdd}
                  disabled={isPending}
                  className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adding...
                    </>
                  ) : (
                    "Add to Directory"
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="h-11"
                disabled={isPending}
              >
                Search again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

Create `app/api/hcps/exists/route.ts` — NPI existence check (used by NpiLookupForm):
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

Create `app/(app)/hcps/page.tsx` — full HCP Directory with server-side data fetch:
```typescript
import { searchHcps } from "@/actions/hcp";
import { HcpTable } from "@/components/hcp/HcpTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export const metadata = { title: "HCP Directory — HCP Engage" };

export default async function HcpsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const page = parseInt(params.page ?? "1", 10);

  const { hcps, total } = await searchHcps({
    query,
    page,
    pageSize: 20,
  });

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)]">HCP Directory</h1>
        <Button asChild className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11">
          <Link href="/hcps/new">Add HCP</Link>
        </Button>
      </div>

      {/* Search bar — client-side form submission via GET */}
      <form method="GET" className="flex gap-3 mb-6">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search by name or NPI..."
          className="w-[320px] h-11"
          aria-label="Search HCPs"
        />
        <Button type="submit" variant="outline" className="h-11">Search</Button>
        {query && (
          <Button asChild variant="ghost" className="h-11">
            <Link href="/hcps">Clear</Link>
          </Button>
        )}
      </form>

      <HcpTable hcps={hcps} emptyQuery={query || undefined} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              asChild
              variant={p === page ? "default" : "outline"}
              className={`h-9 w-9 p-0 ${p === page ? "bg-[hsl(221_83%_53%)]" : ""}`}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              <Link href={`/hcps?q=${encodeURIComponent(query)}&page=${p}`}>{p}</Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
```

Create `app/(app)/hcps/new/page.tsx` — NPI Lookup / Add HCP flow:
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

Add the `files_modified` entry for `app/api/hcps/exists/route.ts` to the plan frontmatter if needed (included above).
  </action>
  <verify>
    <automated>cd C:/Users/HP/HCP_Engage && npm run build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `components/hcp/HcpStatusBadge.tsx` contains all 4 status values: `active`, `inactive`, `suspended`, `do_not_engage` in STATUS_CONFIG
    - `components/hcp/HcpStatusBadge.tsx` uses exact colors from UI-SPEC: `hsl(142_71%_45%)` for active, `hsl(38_92%_50%)` for suspended, `hsl(0_72%_51%)` for do_not_engage
    - `components/hcp/DebarmentBadge.tsx` renders `AlertTriangle` icon for `not_checked` status
    - `components/hcp/HcpTable.tsx` renders 8 columns matching UI-SPEC: HCP Name, NPI, Credentials, Specialty, Primary State, Status, Debarment, Last Updated
    - `components/hcp/NpiLookupForm.tsx` contains `inputMode="numeric"` and `maxLength={10}` on the NPI input
    - `components/hcp/NpiLookupForm.tsx` button text reads exactly "Search NPI", "Add to Directory", "View Profile", "Search again" per copywriting contract
    - `app/(app)/hcps/new/page.tsx` renders `NpiLookupForm` component
    - `app/api/hcps/exists/route.ts` exists and returns `{ exists: boolean, id: string | null }`
    - `npm run build` exits 0 — no TypeScript errors
  </acceptance_criteria>
  <done>HCP Directory renders a filterable, paginated table of all HCPs. NPI Lookup form fetches NPPES, shows result card, handles duplicate detection, and creates local HCP record on "Add to Directory". All copy matches UI-SPEC copywriting contract exactly.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api/nppes | Client sends NPI to proxy; server calls NPPES on behalf of user |
| browser → actions/hcp.ts (Server Action) | addHcp called client-side; creates DB record |
| Next.js → CMS NPPES API | Outbound request to external government API |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Spoofing | /api/nppes route | mitigate | `auth()` from Clerk checked at entry; returns 401 if no session |
| T-02-02 | Tampering | addHcp Server Action | mitigate | Role check `role !== "business" && role !== "compliance"` throws Forbidden; Finance cannot create HCP records |
| T-02-03 | Information Disclosure | NPPES proxy response | accept | NPPES data is public (no auth required by CMS); no private data exposed |
| T-02-04 | Injection | NPI parameter to NPPES URL | mitigate | `validateNpi()` enforces `/^\d{10}$/` before any outbound request — only digits, exactly 10 characters |
| T-02-05 | IDOR | /api/hcps/exists?npi= | accept | Returns only boolean + id for a given NPI; no HCP detail; acceptable for NPI existence check |
| T-02-06 | Elevation of Privilege | searchHcps Server Action | mitigate | `auth()` check for userId; returns 401 for unauthenticated; Finance users redirected by middleware before reaching /hcps page |
</threat_model>

<verification>
After completing both tasks:

1. `npx jest lib/nppes.test.ts` — all 7 tests pass
2. `npm run build` exits 0
3. `npm run dev`, visit `/hcps/new` — form renders with NPI input and "Search NPI" button
4. Enter NPI `1003000100` (known real NPI) and click "Search NPI" — NPPES result card appears with HCP name, specialty, state
5. Click "Add to Directory" — success toast "HCP added to directory." appears, redirected to HCP profile
6. Visit `/hcps` — HCP appears in table with correct status (Active) and debarment (Not Checked with warning icon)
7. Search by name or NPI in filter bar — results filter correctly
8. Sign in as Finance user and visit `/hcps` — middleware redirects to `/dashboard`
</verification>

<success_criteria>
- HCP-01: NPI lookup via NPPES API works end-to-end (search → result card → add to DB)
- HCP-02: HCP profile link from directory table navigates to `/hcps/[id]` (profile page implemented in Plan 03)
- Duplicate NPI detection works: second lookup of same NPI shows "already in directory" banner with "View Profile"
- Empty state renders correctly for both zero HCPs and search-no-results scenarios
- All badge colors match UI-SPEC color map exactly
- Finance users have no access to any /hcps routes — middleware enforces this
</success_criteria>

<output>
After completion, create `.planning/phases/01-auth-hcp-management/01-02-SUMMARY.md` using the template at `@C:/Users/HP/HCP_Engage/.claude/get-shit-done/templates/summary.md`.
</output>
