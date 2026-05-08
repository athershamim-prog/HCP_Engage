---
phase: 01-auth-hcp-management
plan: 03
type: execute
wave: 3
depends_on:
  - "01-PLAN-skeleton.md"
  - "01-PLAN-hcp-directory.md"
files_modified:
  - app/(app)/hcps/[id]/page.tsx
  - components/hcp/DebarmentCheckPanel.tsx
  - components/hcp/StatusHistoryTimeline.tsx
  - actions/debarment.ts
  - lib/debarment.ts
  - lib/debarment.test.ts
autonomous: true
requirements:
  - HCP-02
  - HCP-03

must_haves:
  truths:
    - "A Business user viewing an HCP profile sees NPPES data, debarment check section (read-only), and status history — no 'Set HCP Status' panel and no 'Run Debarment Check' button"
    - "A Compliance user can click 'Run Debarment Check' and see OIG LEIE and SAM.gov results displayed in separate labeled rows"
    - "When a debarment match is found, the match details are expandable inline and a 'Record Determination' form appears below the match results"
    - "A Compliance user can save a determination with outcome (Cleared / Confirmed Exclusion / False Positive) and rationale (min 20 chars)"
    - "The determination block shows recorded-by name, timestamp, and outcome badge after saving"
    - "Re-running a check when a prior determination exists shows the prior determination labeled with the check date"
  artifacts:
    - path: "app/(app)/hcps/[id]/page.tsx"
      provides: "Full HCP profile page — two-column layout per UI-SPEC Screen 5"
      contains: "DebarmentCheckPanel"
    - path: "lib/debarment.ts"
      provides: "runDebarmentCheck() — queries OIG LEIE and SAM.gov local tables by NPI and name"
      exports: ["runDebarmentCheck", "DebarmentResult"]
    - path: "actions/debarment.ts"
      provides: "runCheck() Server Action, saveDetermination() Server Action"
      exports: ["runCheck", "saveDetermination"]
    - path: "components/hcp/DebarmentCheckPanel.tsx"
      provides: "Full debarment check UI panel per UI-SPEC Screen 6"
    - path: "components/hcp/StatusHistoryTimeline.tsx"
      provides: "Timeline of HcpStatusHistory entries, most recent at top"
  key_links:
    - from: "components/hcp/DebarmentCheckPanel.tsx"
      to: "actions/debarment.ts"
      via: "runCheck() called on 'Run Debarment Check' button click"
      pattern: "runCheck"
    - from: "components/hcp/DebarmentCheckPanel.tsx"
      to: "actions/debarment.ts"
      via: "saveDetermination() called on 'Save Determination' button click"
      pattern: "saveDetermination"
    - from: "lib/debarment.ts"
      to: "prisma.oigLeieRecord + prisma.samGovRecord"
      via: "local DB queries by NPI and normalized name match"
      pattern: "oigLeieRecord|samGovRecord"
---

<objective>
Deliver the full HCP Profile page and debarment check flow as a complete vertical slice: Compliance users can view all HCP data, run a debarment check against local pre-seeded OIG LEIE and SAM.gov tables, expand match details, and record a determination. Business users see the same profile in read-only mode.

Purpose: Satisfies HCP-02 (full profile view) and HCP-03 (debarment check + determination recording).
Output: Working HCP profile page, debarment check logic against local DB tables, inline determination form.
</objective>

<execution_context>
@C:/Users/HP/HCP_Engage/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/HCP_Engage/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:\Users\HP\HCP_Engage\.planning\ROADMAP.md
@C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-CONTEXT.md
@C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-UI-SPEC.md

<interfaces>
<!-- From prisma/schema.prisma (Plan 01) -->
```typescript
// DebarmentCheck model
interface DebarmentCheck {
  id: string;
  hcpId: string;
  checkedByClerkId: string;
  checkedByName: string;
  oigHit: boolean;
  samHit: boolean;
  oigMatchJson: JsonValue | null;  // Raw OIG match fields
  samMatchJson: JsonValue | null;  // Raw SAM.gov match fields
  createdAt: Date;
  determination?: DebarmentDetermination | null;
}

// DebarmentDetermination model
interface DebarmentDetermination {
  id: string;
  checkId: string;
  outcome: "cleared" | "confirmed_exclusion" | "false_positive";
  rationale: string;
  recordedByClerkId: string;
  recordedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

// HcpStatusHistory model
interface HcpStatusHistory {
  id: string;
  hcpId: string;
  status: "active" | "inactive" | "suspended" | "do_not_engage";
  reason: string;
  setByClerkId: string;
  setByName: string;
  createdAt: Date;
}

// OigLeieRecord (for matching logic)
interface OigLeieRecord {
  id: string;
  lastName: string;
  firstName: string | null;
  npi: string | null;
  exclusionType: string;
  exclusionDate: string;
  specialty: string | null;
  state: string | null;
}

// SamGovRecord (for matching logic)
interface SamGovRecord {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  npi: string | null;
  exclusionType: string;
  activationDate: string;
  stateOrProvince: string | null;
  recordStatus: string;
}
```

<!-- From actions/hcp.ts (Plan 02) — HcpSearchResult type -->
```typescript
export type HcpSearchResult = Pick<
  Hcp,
  | "id" | "npi" | "fullName" | "credentials" | "nuccDisplayName"
  | "primaryState" | "status" | "debarmentStatus" | "updatedAt"
>;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Debarment check logic and Server Actions</name>
  <read_first>
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-CONTEXT.md (decisions D-11, D-11b, D-13)
    - C:\Users\HP\HCP_Engage\prisma\schema.prisma (OigLeieRecord, SamGovRecord, DebarmentCheck, DebarmentDetermination models)
    - C:\Users\HP\HCP_Engage\lib\prisma.ts (Prisma singleton)
  </read_first>
  <files>
    lib/debarment.ts, lib/debarment.test.ts, actions/debarment.ts
  </files>
  <behavior>
    - Test 1: matchOigRecord({ npi: "1234567890", lastName: "SMITH", firstName: "JOHN" }, oigRecordWithMatchingNpi) returns true
    - Test 2: matchOigRecord({ npi: "9999999999", lastName: "SMITH", firstName: "JOHN" }, oigRecordWithMatchingNpi) returns false (NPI mismatch)
    - Test 3: matchOigRecord({ npi: null, lastName: "SMITH", firstName: "JOHN" }, oigRecordWithNoNpi) returns true (name match when no NPI)
    - Test 4: matchOigRecord({ npi: null, lastName: "JONES", firstName: "BOB" }, oigRecordWithNoNpi) returns false (name mismatch)
    - Test 5: normalizeName("Smith") returns "SMITH"
    - Test 6: normalizeName("  smith  ") returns "SMITH" (trims and uppercases)
    - Test 7: matchSamRecord({ npi: "1122334455", lastName: "JOHNSON", firstName: "ROBERT" }, samRecordWithMatchingNpi) returns true
  </behavior>
  <action>
Create `lib/debarment.ts` — debarment matching logic using local DB tables:

```typescript
import { prisma } from "@/lib/prisma";

export interface DebarmentResult {
  oigHit: boolean;
  samHit: boolean;
  oigMatch: {
    lastName: string;
    firstName: string | null;
    npi: string | null;
    exclusionType: string;
    exclusionDate: string;
    specialty: string | null;
    state: string | null;
  } | null;
  samMatch: {
    name: string;
    firstName: string | null;
    lastName: string | null;
    npi: string | null;
    exclusionType: string;
    activationDate: string;
    stateOrProvince: string | null;
  } | null;
}

export function normalizeName(name: string): string {
  return name.trim().toUpperCase();
}

export function matchOigRecord(
  hcp: { npi: string | null; lastName: string; firstName: string },
  record: { npi: string | null; lastName: string; firstName: string | null }
): boolean {
  // NPI match takes priority — if both have NPI, must match
  if (hcp.npi && record.npi) {
    return hcp.npi === record.npi;
  }
  // Fall back to name matching (both last AND first name, normalized)
  const lastMatch = normalizeName(hcp.lastName) === normalizeName(record.lastName);
  const firstMatch =
    record.firstName === null ||
    normalizeName(hcp.firstName) === normalizeName(record.firstName);
  return lastMatch && firstMatch;
}

export function matchSamRecord(
  hcp: { npi: string | null; lastName: string; firstName: string },
  record: { npi: string | null; lastName: string | null; firstName: string | null; name: string }
): boolean {
  if (hcp.npi && record.npi) {
    return hcp.npi === record.npi;
  }
  if (record.lastName && record.firstName) {
    return (
      normalizeName(hcp.lastName) === normalizeName(record.lastName) &&
      normalizeName(hcp.firstName) === normalizeName(record.firstName)
    );
  }
  // Last resort: check if name field contains last name
  return normalizeName(record.name).includes(normalizeName(hcp.lastName));
}

/**
 * Runs debarment check for an HCP against local OIG LEIE and SAM.gov tables.
 * D-11b: Local pre-seeded tables only in v1. No live external API calls.
 */
export async function runDebarmentCheck(hcp: {
  npi: string;
  lastName: string;
  firstName: string;
}): Promise<DebarmentResult> {
  // Query OIG LEIE — search by NPI first, then by last name as fallback
  const oigCandidates = await prisma.oigLeieRecord.findMany({
    where: {
      OR: [
        { npi: hcp.npi },
        { lastName: { equals: hcp.lastName.toUpperCase(), mode: "insensitive" } },
      ],
    },
  });

  const oigMatchRecord = oigCandidates.find((r) =>
    matchOigRecord(
      { npi: hcp.npi, lastName: hcp.lastName, firstName: hcp.firstName },
      { npi: r.npi ?? null, lastName: r.lastName, firstName: r.firstName ?? null }
    )
  );

  // Query SAM.gov — search by NPI first, then by last name as fallback
  const samCandidates = await prisma.samGovRecord.findMany({
    where: {
      AND: [
        { recordStatus: "Active" },
        {
          OR: [
            { npi: hcp.npi },
            { lastName: { equals: hcp.lastName.toUpperCase(), mode: "insensitive" } },
            { name: { contains: hcp.lastName.toUpperCase(), mode: "insensitive" } },
          ],
        },
      ],
    },
  });

  const samMatchRecord = samCandidates.find((r) =>
    matchSamRecord(
      { npi: hcp.npi, lastName: hcp.lastName, firstName: hcp.firstName },
      {
        npi: r.npi ?? null,
        lastName: r.lastName ?? null,
        firstName: r.firstName ?? null,
        name: r.name,
      }
    )
  );

  return {
    oigHit: !!oigMatchRecord,
    samHit: !!samMatchRecord,
    oigMatch: oigMatchRecord
      ? {
          lastName: oigMatchRecord.lastName,
          firstName: oigMatchRecord.firstName ?? null,
          npi: oigMatchRecord.npi ?? null,
          exclusionType: oigMatchRecord.exclusionType,
          exclusionDate: oigMatchRecord.exclusionDate,
          specialty: oigMatchRecord.specialty ?? null,
          state: oigMatchRecord.state ?? null,
        }
      : null,
    samMatch: samMatchRecord
      ? {
          name: samMatchRecord.name,
          firstName: samMatchRecord.firstName ?? null,
          lastName: samMatchRecord.lastName ?? null,
          npi: samMatchRecord.npi ?? null,
          exclusionType: samMatchRecord.exclusionType,
          activationDate: samMatchRecord.activationDate,
          stateOrProvince: samMatchRecord.stateOrProvince ?? null,
        }
      : null,
  };
}
```

Create `lib/debarment.test.ts`:
```typescript
import { normalizeName, matchOigRecord, matchSamRecord } from "./debarment";

const oigRecordWithNpi = {
  npi: "1234567890",
  lastName: "SMITH",
  firstName: "JOHN",
};

const samRecordWithNpi = {
  npi: "1122334455",
  lastName: "JOHNSON",
  firstName: "ROBERT",
  name: "JOHNSON ROBERT",
};

describe("normalizeName", () => {
  it("uppercases a name", () => {
    expect(normalizeName("Smith")).toBe("SMITH");
  });
  it("trims and uppercases", () => {
    expect(normalizeName("  smith  ")).toBe("SMITH");
  });
});

describe("matchOigRecord", () => {
  it("returns true when NPI matches", () => {
    expect(
      matchOigRecord(
        { npi: "1234567890", lastName: "SMITH", firstName: "JOHN" },
        oigRecordWithNpi
      )
    ).toBe(true);
  });

  it("returns false when NPI does not match", () => {
    expect(
      matchOigRecord(
        { npi: "9999999999", lastName: "SMITH", firstName: "JOHN" },
        oigRecordWithNpi
      )
    ).toBe(false);
  });

  it("returns true on name match when no NPI in record", () => {
    const recordNoNpi = { npi: null, lastName: "SMITH", firstName: "JOHN" };
    expect(
      matchOigRecord({ npi: null, lastName: "SMITH", firstName: "JOHN" }, recordNoNpi)
    ).toBe(true);
  });

  it("returns false on name mismatch when no NPI", () => {
    const recordNoNpi = { npi: null, lastName: "SMITH", firstName: "JOHN" };
    expect(
      matchOigRecord({ npi: null, lastName: "JONES", firstName: "BOB" }, recordNoNpi)
    ).toBe(false);
  });
});

describe("matchSamRecord", () => {
  it("returns true when NPI matches", () => {
    expect(
      matchSamRecord(
        { npi: "1122334455", lastName: "JOHNSON", firstName: "ROBERT" },
        samRecordWithNpi
      )
    ).toBe(true);
  });

  it("returns false when NPI does not match", () => {
    expect(
      matchSamRecord(
        { npi: "9999999999", lastName: "JOHNSON", firstName: "ROBERT" },
        samRecordWithNpi
      )
    ).toBe(false);
  });
});
```

Create `actions/debarment.ts` — Server Actions for debarment check and determination:
```typescript
"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { runDebarmentCheck } from "@/lib/debarment";

/**
 * Run a debarment check for an HCP. Compliance role only.
 * Creates a DebarmentCheck record and updates Hcp.debarmentStatus.
 */
export async function runCheck(hcpId: string): Promise<{
  success: boolean;
  checkId?: string;
  error?: string;
}> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const role = (user.publicMetadata as { role?: string }).role;
  if (role !== "compliance") {
    return { success: false, error: "Forbidden: only Compliance users can run debarment checks" };
  }

  const hcp = await prisma.hcp.findUnique({ where: { id: hcpId } });
  if (!hcp) return { success: false, error: "HCP not found" };

  try {
    const result = await runDebarmentCheck({
      npi: hcp.npi,
      lastName: hcp.lastName,
      firstName: hcp.firstName,
    });

    const hasHit = result.oigHit || result.samHit;

    // Record check result and update HCP debarment status atomically
    const [check] = await prisma.$transaction([
      prisma.debarmentCheck.create({
        data: {
          hcpId,
          checkedByClerkId: user.id,
          checkedByName: user.fullName ?? "Unknown",
          oigHit: result.oigHit,
          samHit: result.samHit,
          oigMatchJson: result.oigMatch ?? undefined,
          samMatchJson: result.samMatch ?? undefined,
        },
      }),
      prisma.hcp.update({
        where: { id: hcpId },
        data: {
          debarmentCheckedAt: new Date(),
          debarmentStatus: hasHit ? "hit" : "clear",
        },
      }),
    ]);

    revalidatePath(`/hcps/${hcpId}`);
    return { success: true, checkId: check.id };
  } catch (error) {
    console.error("Debarment check failed:", error);
    return { success: false, error: "Debarment check failed. Try again or contact your system administrator." };
  }
}

/**
 * Save or update a debarment determination for a check.
 * Compliance role only.
 */
export async function saveDetermination(params: {
  checkId: string;
  hcpId: string;
  outcome: "cleared" | "confirmed_exclusion" | "false_positive";
  rationale: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const role = (user.publicMetadata as { role?: string }).role;
  if (role !== "compliance") {
    return { success: false, error: "Forbidden" };
  }

  if (params.rationale.trim().length < 20) {
    return { success: false, error: "Rationale must be at least 20 characters." };
  }

  try {
    // Upsert: update existing determination or create new
    await prisma.debarmentDetermination.upsert({
      where: { checkId: params.checkId },
      create: {
        checkId: params.checkId,
        outcome: params.outcome,
        rationale: params.rationale.trim(),
        recordedByClerkId: user.id,
        recordedByName: user.fullName ?? "Unknown",
      },
      update: {
        outcome: params.outcome,
        rationale: params.rationale.trim(),
        recordedByClerkId: user.id,
        recordedByName: user.fullName ?? "Unknown",
      },
    });

    revalidatePath(`/hcps/${params.hcpId}`);
    return { success: true };
  } catch (error) {
    console.error("Save determination failed:", error);
    return { success: false, error: "Failed to save determination. Try again." };
  }
}
```
  </action>
  <verify>
    <automated>cd C:/Users/HP/HCP_Engage && npx jest lib/debarment.test.ts 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `lib/debarment.test.ts` all 7 tests pass: `npx jest lib/debarment.test.ts` output shows "7 passed"
    - `lib/debarment.ts` exports `runDebarmentCheck`, `matchOigRecord`, `matchSamRecord`, `normalizeName`, `DebarmentResult`
    - `lib/debarment.ts` `runDebarmentCheck()` queries `prisma.oigLeieRecord` and `prisma.samGovRecord` (local tables — no fetch() calls)
    - `actions/debarment.ts` contains `"use server"` directive
    - `actions/debarment.ts` `runCheck()` checks `role !== "compliance"` and returns `{ success: false, error: "Forbidden" }` for non-Compliance users
    - `actions/debarment.ts` `runCheck()` uses `prisma.$transaction([check.create, hcp.update])` to atomically record check and update HCP status
    - `actions/debarment.ts` `saveDetermination()` uses `prisma.debarmentDetermination.upsert` (allows re-recording)
    - `actions/debarment.ts` `saveDetermination()` validates `rationale.trim().length < 20` and returns error
  </acceptance_criteria>
  <done>Debarment logic tested with 7 passing unit tests. runCheck Server Action queries local OIG LEIE and SAM.gov tables, records result in DB, updates HCP status atomically. saveDetermination allows upsert so Compliance can re-record.</done>
</task>

<task type="auto">
  <name>Task 2: HCP Profile page with two-column layout, debarment panel, and status history</name>
  <read_first>
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-UI-SPEC.md (Screen 5: HCP Profile Page, Screen 6: Run Debarment Check Flow, Copywriting Contract, Color section debarment result badge map)
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-CONTEXT.md (D-03: Business read-only, D-13: no auto-suspend)
    - C:\Users\HP\HCP_Engage\actions\debarment.ts (runCheck, saveDetermination signatures — from Task 1)
  </read_first>
  <files>
    app/(app)/hcps/[id]/page.tsx,
    components/hcp/DebarmentCheckPanel.tsx,
    components/hcp/StatusHistoryTimeline.tsx
  </files>
  <action>
Create `components/hcp/StatusHistoryTimeline.tsx`:
```typescript
import { formatDistanceToNow, format } from "date-fns";
import { HcpStatusBadge, HcpStatusValue } from "./HcpStatusBadge";

interface StatusHistoryEntry {
  id: string;
  status: string;
  reason: string;
  setByName: string;
  createdAt: Date;
}

export function StatusHistoryTimeline({ entries }: { entries: StatusHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-[14px] text-[hsl(215_16%_47%)]">No status changes recorded.</p>
    );
  }

  return (
    <ol className="space-y-4" aria-label="Status history">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-4">
          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[hsl(220_13%_18%)] mt-2" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <HcpStatusBadge status={entry.status as HcpStatusValue} />
              <time
                dateTime={new Date(entry.createdAt).toISOString()}
                className="text-[12px] text-[hsl(215_16%_47%)]"
                title={format(new Date(entry.createdAt), "PPpp")}
              >
                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
              </time>
              <span className="text-[12px] text-[hsl(215_16%_47%)]">by {entry.setByName}</span>
            </div>
            <p className="mt-1 text-[14px] text-[hsl(220_13%_18%)]">{entry.reason}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
```

Create `components/hcp/DebarmentCheckPanel.tsx` — full debarment check UI per UI-SPEC Screen 6:
```typescript
"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { runCheck, saveDetermination } from "@/actions/debarment";
import { useRouter } from "next/navigation";

type DetermOutcome = "cleared" | "confirmed_exclusion" | "false_positive";

interface Determination {
  outcome: DetermOutcome;
  rationale: string;
  recordedByName: string;
  createdAt: Date;
  checkId: string;
}

interface CheckData {
  id: string;
  oigHit: boolean;
  samHit: boolean;
  oigMatchJson: Record<string, unknown> | null;
  samMatchJson: Record<string, unknown> | null;
  createdAt: Date;
  determination: Determination | null;
}

const OUTCOME_CONFIG: Record<DetermOutcome, { label: string; className: string }> = {
  cleared:              { label: "Cleared",            className: "border-[hsl(142_71%_45%)] text-[hsl(142_71%_30%)]" },
  confirmed_exclusion:  { label: "Confirmed Exclusion", className: "border-[hsl(0_72%_51%)] text-[hsl(0_72%_40%)]" },
  false_positive:       { label: "False Positive",      className: "border-[hsl(38_92%_50%)] text-[hsl(38_92%_35%)]" },
};

export function DebarmentCheckPanel({
  hcpId,
  isCompliance,
  initialCheck,
  debarmentCheckedAt,
}: {
  hcpId: string;
  isCompliance: boolean;
  initialCheck: CheckData | null;
  debarmentCheckedAt: Date | null;
}) {
  const router = useRouter();
  const [isRunning, startRunning] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [runError, setRunError] = useState<string | null>(null);
  const [showOigDetails, setShowOigDetails] = useState(false);
  const [showSamDetails, setShowSamDetails] = useState(false);
  const [showDetermForm, setShowDetermForm] = useState(false);
  const [determOutcome, setDetermOutcome] = useState<DetermOutcome | "">("");
  const [determRationale, setDetermRationale] = useState("");
  const [determError, setDetermError] = useState<string | null>(null);

  // Latest check is initialCheck (server-rendered); refresh via router after mutations
  const check = initialCheck;
  const hasHit = check ? (check.oigHit || check.samHit) : false;

  async function handleRunCheck() {
    setRunError(null);
    startRunning(async () => {
      const result = await runCheck(hcpId);
      if (!result.success) {
        setRunError(result.error ?? "Check failed. Try again.");
      }
      // revalidatePath in Server Action triggers RSC refresh
      router.refresh();
    });
  }

  async function handleSaveDetermination() {
    if (!check || !determOutcome || determRationale.trim().length < 20) return;
    setDetermError(null);
    startSaving(async () => {
      const result = await saveDetermination({
        checkId: check.id,
        hcpId,
        outcome: determOutcome as DetermOutcome,
        rationale: determRationale,
      });
      if (!result.success) {
        setDetermError(result.error ?? "Failed to save.");
      } else {
        setShowDetermForm(false);
        setDetermOutcome("");
        setDetermRationale("");
        router.refresh();
      }
    });
  }

  return (
    <div aria-live="polite">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {debarmentCheckedAt ? (
            <p className="text-[12px] text-[hsl(215_16%_47%)]">
              Last checked {format(new Date(debarmentCheckedAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          ) : (
            <p className="text-[12px] text-[hsl(215_16%_47%)]">
              Debarment check has not been run for this HCP.
            </p>
          )}
        </div>
        {isCompliance && (
          <Button
            onClick={handleRunCheck}
            disabled={isRunning}
            className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11"
            aria-label="Run debarment check"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                Checking...
              </>
            ) : (
              "Run Debarment Check"
            )}
          </Button>
        )}
      </div>

      {runError && (
        <div className="mb-4 px-3 py-2 bg-[hsl(38_92%_96%)] rounded-md border border-[hsl(38_92%_70%)]">
          <p className="text-[14px] text-[hsl(38_92%_35%)]">
            Debarment check failed. {runError}
          </p>
        </div>
      )}

      {/* No check run yet */}
      {!check && !debarmentCheckedAt && (
        <p className="text-[14px] text-[hsl(215_16%_47%)]">
          {isCompliance
            ? "Run a check before submitting engagement requests."
            : "Debarment check has not been run. Run a check before submitting engagement requests."}
        </p>
      )}

      {/* Check results */}
      {check && (
        <div className="space-y-3">
          {/* OIG LEIE result row */}
          <div className="flex items-center justify-between py-2 border-b border-[hsl(220_13%_91%)]">
            <span className="text-[14px] font-semibold text-[hsl(220_13%_18%)]">OIG LEIE</span>
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "h-6 text-[12px] font-semibold border-transparent",
                  check.oigHit
                    ? "bg-[hsl(0_72%_51%)] text-white"
                    : "bg-[hsl(142_71%_45%)] text-white"
                )}
              >
                {check.oigHit ? "Match Found" : "No Hit"}
              </Badge>
              {check.oigHit && check.oigMatchJson && (
                <button
                  onClick={() => setShowOigDetails((v) => !v)}
                  className="text-[12px] text-[hsl(221_83%_53%)] flex items-center gap-1"
                  aria-expanded={showOigDetails}
                  aria-label="Toggle OIG match details"
                >
                  View match details
                  {showOigDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
            </div>
          </div>
          {showOigDetails && check.oigMatchJson && (
            <div className="ml-4 pl-4 border-l-2 border-[hsl(0_72%_51%)] text-[12px] space-y-1 text-[hsl(220_13%_18%)]">
              {Object.entries(check.oigMatchJson as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="font-semibold capitalize">{k.replace(/([A-Z])/g, " $1")}:</span>
                  <span>{String(v ?? "—")}</span>
                </div>
              ))}
            </div>
          )}

          {/* SAM.gov result row */}
          <div className="flex items-center justify-between py-2 border-b border-[hsl(220_13%_91%)]">
            <span className="text-[14px] font-semibold text-[hsl(220_13%_18%)]">SAM.gov</span>
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "h-6 text-[12px] font-semibold border-transparent",
                  check.samHit
                    ? "bg-[hsl(0_72%_51%)] text-white"
                    : "bg-[hsl(142_71%_45%)] text-white"
                )}
              >
                {check.samHit ? "Match Found" : "No Hit"}
              </Badge>
              {check.samHit && check.samMatchJson && (
                <button
                  onClick={() => setShowSamDetails((v) => !v)}
                  className="text-[12px] text-[hsl(221_83%_53%)] flex items-center gap-1"
                  aria-expanded={showSamDetails}
                  aria-label="Toggle SAM.gov match details"
                >
                  View match details
                  {showSamDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
            </div>
          </div>
          {showSamDetails && check.samMatchJson && (
            <div className="ml-4 pl-4 border-l-2 border-[hsl(0_72%_51%)] text-[12px] space-y-1 text-[hsl(220_13%_18%)]">
              {Object.entries(check.samMatchJson as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="font-semibold capitalize">{k.replace(/([A-Z])/g, " $1")}:</span>
                  <span>{String(v ?? "—")}</span>
                </div>
              ))}
            </div>
          )}

          {/* Prior determination */}
          {check.determination && !showDetermForm && (
            <div className="mt-4 p-4 bg-[hsl(0_0%_97%)] rounded-md border border-[hsl(220_13%_91%)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Determination</span>
                <Badge
                  variant="outline"
                  className={cn("h-6 text-[12px]", OUTCOME_CONFIG[check.determination.outcome].className)}
                >
                  {OUTCOME_CONFIG[check.determination.outcome].label}
                </Badge>
              </div>
              <p className="text-[14px] text-[hsl(220_13%_18%)]">{check.determination.rationale}</p>
              <p className="mt-1 text-[12px] text-[hsl(215_16%_47%)]">
                Recorded by {check.determination.recordedByName}{" "}
                {format(new Date(check.determination.createdAt), "MMM d, yyyy")}
              </p>
              {isCompliance && (
                <button
                  className="mt-2 text-[12px] text-[hsl(221_83%_53%)] underline"
                  onClick={() => {
                    setShowDetermForm(true);
                    setDetermOutcome(check.determination!.outcome);
                    setDetermRationale(check.determination!.rationale);
                  }}
                >
                  Update Determination
                </button>
              )}
            </div>
          )}

          {/* Determination form — shown after match found or when updating */}
          {isCompliance && hasHit && (showDetermForm || !check.determination) && (
            <div className="mt-4 p-4 bg-[hsl(0_0%_97%)] rounded-md border border-[hsl(220_13%_91%)]">
              <h4 className="text-[14px] font-semibold text-[hsl(220_13%_18%)] mb-4">
                Record Determination
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
                    Outcome <span className="text-[hsl(0_72%_51%)]">*</span>
                  </label>
                  <Select
                    value={determOutcome}
                    onValueChange={(v) => setDetermOutcome(v as DetermOutcome)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cleared">Cleared</SelectItem>
                      <SelectItem value="confirmed_exclusion">Confirmed Exclusion</SelectItem>
                      <SelectItem value="false_positive">False Positive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
                    Rationale <span className="text-[hsl(0_72%_51%)]">*</span>
                  </label>
                  <Textarea
                    value={determRationale}
                    onChange={(e) => {
                      setDetermRationale(e.target.value);
                      if (determError) setDetermError(null);
                    }}
                    placeholder="Describe your determination rationale (min 20 characters)"
                    className="min-h-[100px]"
                    aria-describedby={determError ? "determ-error" : undefined}
                  />
                  <div className="flex justify-between mt-1">
                    {determError ? (
                      <span id="determ-error" className="text-[12px] text-[hsl(0_72%_51%)]">{determError}</span>
                    ) : (
                      <span className="text-[12px] text-[hsl(215_16%_47%)]">
                        {determRationale.trim().length}/20 minimum characters
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveDetermination}
                    disabled={
                      isSaving ||
                      !determOutcome ||
                      determRationale.trim().length < 20
                    }
                    className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Save Determination"
                    )}
                  </Button>
                  {showDetermForm && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowDetermForm(false);
                        setDetermOutcome("");
                        setDetermRationale("");
                        setDetermError(null);
                      }}
                      className="h-11"
                    >
                      Discard Changes
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

Create `app/(app)/hcps/[id]/page.tsx` — full HCP profile page, two-column layout:
```typescript
import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HcpStatusBadge, HcpStatusValue } from "@/components/hcp/HcpStatusBadge";
import { DebarmentBadge, DebarmentStatusValue } from "@/components/hcp/DebarmentBadge";
import { DebarmentCheckPanel } from "@/components/hcp/DebarmentCheckPanel";
import { StatusHistoryTimeline } from "@/components/hcp/StatusHistoryTimeline";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hcp = await prisma.hcp.findUnique({ where: { id }, select: { fullName: true } });
  return { title: hcp ? `${hcp.fullName} — HCP Engage` : "HCP Not Found — HCP Engage" };
}

export default async function HcpProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) notFound();

  const role = (user.publicMetadata as { role?: string }).role;
  const userGrant = await prisma.userGrant.findUnique({ where: { clerkUserId: user.id } });
  const effectiveRoles = getEffectiveRoles({ role, grants: userGrant?.grantedRoles ?? [] });
  const isCompliance = effectiveRoles.includes("compliance");

  // Fetch full HCP data
  const hcp = await prisma.hcp.findUnique({
    where: { id },
    include: {
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
      debarmentChecks: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { determination: true },
      },
    },
  });

  if (!hcp) notFound();

  const latestCheck = hcp.debarmentChecks[0] ?? null;

  return (
    <div className="flex gap-8">
      {/* Left column (65%) */}
      <div className="flex-[65] min-w-0 space-y-6">

        {/* Profile header */}
        <div>
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-[28px] font-semibold text-[hsl(220_13%_18%)] leading-[1.15]">
              {hcp.fullName}
            </h1>
            {hcp.credentials && (
              <span className="text-[12px] text-[hsl(215_16%_47%)] mt-2 font-semibold">
                {hcp.credentials}
              </span>
            )}
          </div>
          <p className="font-mono text-[12px] text-[hsl(215_16%_47%)] mt-1">NPI: {hcp.npi}</p>
          <div className="flex items-center gap-2 mt-3">
            <HcpStatusBadge status={hcp.status as HcpStatusValue} />
            <DebarmentBadge status={hcp.debarmentStatus as DebarmentStatusValue} />
          </div>
        </div>

        {/* NPPES Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[20px]">Verified HCP Data</CardTitle>
            <p className="text-[12px] text-[hsl(215_16%_47%)]">
              Source: NPPES — pulled {format(new Date(hcp.createdAt), "MMM d, yyyy")}
            </p>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">NUCC Specialty</dt>
                <dd className="mt-0.5">{hcp.nuccDisplayName} <span className="text-[hsl(215_16%_47%)]">({hcp.nuccCode})</span></dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Primary State</dt>
                <dd className="mt-0.5">{hcp.primaryState || "—"}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">HCO Affiliation</dt>
                <dd className="mt-0.5">{hcp.hcoAffiliation ?? <span className="text-[hsl(215_16%_47%)]">No affiliation on record</span>}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Credentials</dt>
                <dd className="mt-0.5">{hcp.credentials ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Debarment Check */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[20px]">Debarment Check</CardTitle>
          </CardHeader>
          <CardContent>
            <DebarmentCheckPanel
              hcpId={hcp.id}
              isCompliance={isCompliance}
              initialCheck={
                latestCheck
                  ? {
                      id: latestCheck.id,
                      oigHit: latestCheck.oigHit,
                      samHit: latestCheck.samHit,
                      oigMatchJson: latestCheck.oigMatchJson as Record<string, unknown> | null,
                      samMatchJson: latestCheck.samMatchJson as Record<string, unknown> | null,
                      createdAt: latestCheck.createdAt,
                      determination: latestCheck.determination
                        ? {
                            outcome: latestCheck.determination.outcome as "cleared" | "confirmed_exclusion" | "false_positive",
                            rationale: latestCheck.determination.rationale,
                            recordedByName: latestCheck.determination.recordedByName,
                            createdAt: latestCheck.determination.createdAt,
                            checkId: latestCheck.determination.checkId,
                          }
                        : null,
                    }
                  : null
              }
              debarmentCheckedAt={hcp.debarmentCheckedAt}
            />
          </CardContent>
        </Card>

        {/* Status History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[20px]">Status History</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusHistoryTimeline entries={hcp.statusHistory} />
          </CardContent>
        </Card>
      </div>

      {/* Right sidebar (35%) */}
      <div className="flex-[35] min-w-0 space-y-4">

        {/* Set HCP Status — Compliance only (Plan 04 implements this panel) */}
        {/* Placeholder rendered here; full implementation in 01-PLAN-hcp-status.md */}
        {isCompliance && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[20px]">Set HCP Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[14px] text-[hsl(215_16%_47%)]">
                Status management panel — implemented in next plan.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quick Facts — both roles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[20px]">Quick Facts</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-[14px]">
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Date Added</dt>
                <dd className="mt-0.5">{format(new Date(hcp.createdAt), "MMM d, yyyy")}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Added By</dt>
                <dd className="mt-0.5">{hcp.addedByName}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">HCP Record ID</dt>
                <dd className="mt-0.5 font-mono text-[12px] text-[hsl(215_16%_47%)]">{hcp.id}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```
  </action>
  <verify>
    <automated>cd C:/Users/HP/HCP_Engage && npm run build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `app/(app)/hcps/[id]/page.tsx` exists and contains `DebarmentCheckPanel` and `StatusHistoryTimeline` component imports
    - `app/(app)/hcps/[id]/page.tsx` fetches `hcp.debarmentChecks` with `include: { determination: true }`
    - `app/(app)/hcps/[id]/page.tsx` passes `isCompliance` prop to `DebarmentCheckPanel` based on `effectiveRoles.includes("compliance")`
    - `components/hcp/DebarmentCheckPanel.tsx` button text reads exactly "Run Debarment Check" and "Save Determination" per copywriting contract
    - `components/hcp/DebarmentCheckPanel.tsx` renders the determination form only when `isCompliance && hasHit`
    - `components/hcp/DebarmentCheckPanel.tsx` determination Select contains values: `"cleared"`, `"confirmed_exclusion"`, `"false_positive"` with display labels "Cleared", "Confirmed Exclusion", "False Positive"
    - `components/hcp/DebarmentCheckPanel.tsx` "Run Debarment Check" button is absent (not rendered) when `isCompliance` is false
    - `components/hcp/StatusHistoryTimeline.tsx` renders "No status changes recorded." when entries array is empty
    - `npm run build` exits 0 — no TypeScript errors
  </acceptance_criteria>
  <done>HCP profile page renders full two-column layout. Business users see read-only NPPES data, debarment results, and status history. Compliance users additionally see "Run Debarment Check" button and determination form. Status history shows timeline entries with badges. "Set HCP Status" panel is a placeholder pending Plan 04.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → actions/debarment.ts | Server Actions called client-side for check + determination |
| Server Action → prisma.oigLeieRecord / samGovRecord | Read-only queries against local pre-seeded tables |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-01 | Elevation of Privilege | runCheck Server Action | mitigate | `role !== "compliance"` check returns `{ success: false, error: "Forbidden" }`; Finance and Business users cannot trigger debarment checks |
| T-03-02 | Elevation of Privilege | saveDetermination Server Action | mitigate | Same `role !== "compliance"` guard; determination recording is Compliance-only |
| T-03-03 | IDOR | DebarmentCheckPanel reads hcpId from props | mitigate | `hcpId` flows from server-rendered page that already validated the HCP exists via `prisma.hcp.findUnique` — only accessible HCPs reach this prop |
| T-03-04 | Tampering | DebarmentDetermination upsert | mitigate | Server Action validates rationale length server-side (not just client-side); cannot be bypassed by manipulating client state |
| T-03-05 | Information Disclosure | debarment match JSON exposed in UI | accept | OIG LEIE and SAM.gov data is publicly available government exclusion data; no private HCP data is in these tables |
| T-03-06 | Spoofing | currentUser() in Server Actions | mitigate | Clerk's `currentUser()` validates the session server-side; cannot be spoofed from client |
</threat_model>

<verification>
After completing both tasks:

1. `npx jest lib/debarment.test.ts` — all 7 tests pass
2. `npm run build` exits 0
3. `npm run dev`, visit `/hcps/[id]` for an HCP — profile renders with NPPES data, debarment section, status history
4. As Business user: "Run Debarment Check" button is absent; "Set HCP Status" panel is absent
5. As Compliance user: "Run Debarment Check" button is visible
6. As Compliance user, click "Run Debarment Check" — button shows spinner, results appear with OIG LEIE and SAM.gov rows
7. For seeded HCP with NPI `1234567890`: OIG result shows "Match Found" badge
8. Click "View match details" — accordion expands with raw match fields
9. "Record Determination" form appears below match; select "Cleared", enter 20+ char rationale, click "Save Determination" — determination block updates in place
</verification>

<success_criteria>
- HCP-02: Full profile page renders with NPPES data, credentials, NUCC specialty, primary state, HCO affiliation
- HCP-03: Compliance user can run debarment check, see OIG LEIE and SAM.gov results, expand match details, record determination
- Role enforcement: Business users see read-only profile; Compliance-only elements absent for Business role
- Debarment check results stored in DebarmentCheck table; determination in DebarmentDetermination table
- Re-running check preserves prior determination (upsert pattern)
- Status history timeline renders (empty state for new HCPs)
</success_criteria>

<output>
After completion, create `.planning/phases/01-auth-hcp-management/01-03-SUMMARY.md` using the template at `@C:/Users/HP/HCP_Engage/.claude/get-shit-done/templates/summary.md`.
</output>
