---
phase: 01-auth-hcp-management
plan: 04
type: execute
wave: 4
depends_on:
  - "01-PLAN-hcp-profile.md"
files_modified:
  - components/hcp/HcpStatusPanel.tsx
  - actions/hcp.ts
  - app/(app)/hcps/[id]/page.tsx
autonomous: true
requirements:
  - HCP-04

must_haves:
  truths:
    - "A Compliance user can select a new status (active / inactive / suspended / do-not-engage) and enter a mandatory reason (min 10 chars) in the right sidebar of the HCP profile"
    - "The 'Set Status' button is disabled until both status is selected and reason meets minimum length"
    - "After setting status, the profile header badge updates immediately and a new entry appears at the top of the status history timeline"
    - "Selecting 'do-not-engage' turns the Select and Textarea borders destructive red as a visual warning"
    - "A Business user sees no 'Set HCP Status' panel — the entire card is absent"
    - "Setting the same status that is already active disables the 'Set Status' button with tooltip text 'HCP is already {status}'"
  artifacts:
    - path: "components/hcp/HcpStatusPanel.tsx"
      provides: "Set HCP Status sidebar panel — Compliance only; full interaction per UI-SPEC Screen 7"
      exports: ["HcpStatusPanel"]
    - path: "actions/hcp.ts"
      provides: "setHcpStatus() Server Action added — creates HcpStatusHistory entry and updates Hcp.status"
  key_links:
    - from: "components/hcp/HcpStatusPanel.tsx"
      to: "actions/hcp.ts"
      via: "setHcpStatus() called on 'Set Status' button click"
      pattern: "setHcpStatus"
    - from: "app/(app)/hcps/[id]/page.tsx"
      to: "components/hcp/HcpStatusPanel.tsx"
      via: "passes currentStatus and hcpId props from server-fetched Hcp record"
      pattern: "HcpStatusPanel"
---

<objective>
Replace the placeholder "Set HCP Status" card in the HCP Profile right sidebar with a fully functional status management panel. Compliance users can set any of the four statuses with a mandatory reason, the status history timeline updates in place, and the profile header badge reflects the new status. This plan closes HCP-04 and completes Phase 1.

Purpose: Satisfies HCP-04 — status management with mandatory reason + full history.
Output: Working Set HCP Status panel wired to HcpStatusHistory DB writes, profile badge updates.
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
<!-- From actions/hcp.ts (Plan 02) — existing exports to extend -->
```typescript
// Existing exports (DO NOT remove — only add setHcpStatus)
export type HcpSearchResult = Pick<Hcp, "id" | "npi" | "fullName" | "credentials" | "nuccDisplayName" | "primaryState" | "status" | "debarmentStatus" | "updatedAt">;
export async function addHcp(nppesData: NppesHcp): Promise<{ id: string }>;
export async function searchHcps(params: { query?: string; statuses?: string[]; page?: number; pageSize?: number; }): Promise<{ hcps: HcpSearchResult[]; total: number }>;

// NEW — add to actions/hcp.ts:
export async function setHcpStatus(params: {
  hcpId: string;
  status: "active" | "inactive" | "suspended" | "do_not_engage";
  reason: string;
}): Promise<{ success: boolean; error?: string }>;
```

<!-- From app/(app)/hcps/[id]/page.tsx (Plan 03) — the placeholder to replace -->
```typescript
// Find and REPLACE this placeholder block in the right sidebar:
{isCompliance && (
  <Card>
    <CardHeader><CardTitle>Set HCP Status</CardTitle></CardHeader>
    <CardContent>
      <p>Status management panel — implemented in next plan.</p>
    </CardContent>
  </Card>
)}

// REPLACE WITH:
{isCompliance && (
  <HcpStatusPanel
    hcpId={hcp.id}
    currentStatus={hcp.status}
  />
)}
```

<!-- HcpStatus enum values (from Prisma schema) -->
```typescript
// HcpStatus enum: active | inactive | suspended | do_not_engage
// Display labels per UI-SPEC Screen 7:
// active        → "Active"
// inactive      → "Inactive"
// suspended     → "Suspended"
// do_not_engage → "Do Not Engage"
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: setHcpStatus Server Action and HcpStatusPanel component</name>
  <read_first>
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-UI-SPEC.md (Screen 7: HCP Status Management, Copywriting Contract rows for status, Interaction Patterns section)
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-CONTEXT.md (D-14: mandatory reason, D-03: Compliance only)
    - C:\Users\HP\HCP_Engage\actions\hcp.ts (existing addHcp and searchHcps — read before editing to preserve them)
    - C:\Users\HP\HCP_Engage\prisma\schema.prisma (HcpStatusHistory model, HcpStatus enum)
    - C:\Users\HP\HCP_Engage\app\(app)\hcps\[id]\page.tsx (placeholder card to replace)
  </read_first>
  <files>
    actions/hcp.ts,
    components/hcp/HcpStatusPanel.tsx,
    app/(app)/hcps/[id]/page.tsx
  </files>
  <behavior>
    - Test 1 (unit — in actions/hcp.test.ts): setHcpStatus with reason shorter than 10 chars returns { success: false, error: "Reason must be at least 10 characters." }
    - Test 2: setHcpStatus with valid reason of exactly 10 chars does not return a length error
    - Test 3: HcpStatusPanel renders 4 Select options: "Active", "Inactive", "Suspended", "Do Not Engage"
    - Test 4: HcpStatusPanel "Set Status" button is disabled when no status selected
    - Test 5: HcpStatusPanel "Set Status" button is disabled when reason is shorter than 10 chars
    - Test 6: HcpStatusPanel shows tooltip "HCP is already active" when currentStatus is "active" and selected status is "active"
  </behavior>
  <action>
**Step 1 — Extend `actions/hcp.ts`** by adding `setHcpStatus`. READ the file first to preserve existing exports, then add at the bottom:

```typescript
/**
 * Set HCP status with a mandatory reason.
 * Compliance role only (D-03, D-14).
 * Creates an HcpStatusHistory entry and updates Hcp.status atomically.
 */
export async function setHcpStatus(params: {
  hcpId: string;
  status: "active" | "inactive" | "suspended" | "do_not_engage";
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const role = (user.publicMetadata as { role?: string }).role;
  if (role !== "compliance") {
    return { success: false, error: "Forbidden: only Compliance users can set HCP status" };
  }

  if (params.reason.trim().length < 10) {
    return { success: false, error: "Reason must be at least 10 characters." };
  }

  // Verify HCP exists
  const hcp = await prisma.hcp.findUnique({
    where: { id: params.hcpId },
    select: { id: true, status: true },
  });
  if (!hcp) return { success: false, error: "HCP not found" };

  // Prevent setting same status (also guarded client-side)
  if (hcp.status === params.status) {
    return { success: false, error: `HCP is already ${params.status.replace("_", " ")}` };
  }

  try {
    await prisma.$transaction([
      prisma.hcpStatusHistory.create({
        data: {
          hcpId: params.hcpId,
          status: params.status,
          reason: params.reason.trim(),
          setByClerkId: user.id,
          setByName: user.fullName ?? "Unknown",
        },
      }),
      prisma.hcp.update({
        where: { id: params.hcpId },
        data: { status: params.status },
      }),
    ]);

    revalidatePath(`/hcps/${params.hcpId}`);
    return { success: true };
  } catch (error) {
    console.error("setHcpStatus failed:", error);
    return { success: false, error: "Status could not be saved. Refresh the page and try again." };
  }
}
```

Also add `revalidatePath` import to the top of `actions/hcp.ts` if not already present:
```typescript
import { revalidatePath } from "next/cache";
```

**Step 2 — Create `actions/hcp.test.ts`** for TDD validation of setHcpStatus validation logic (test the pure validation logic only — no DB):

```typescript
// Validation logic extracted for testability (no Prisma/Clerk needed)
export function validateSetStatusParams(params: {
  reason: string;
  currentStatus: string;
  newStatus: string;
}): { valid: boolean; error?: string } {
  if (params.reason.trim().length < 10) {
    return { valid: false, error: "Reason must be at least 10 characters." };
  }
  if (params.currentStatus === params.newStatus) {
    return { valid: false, error: `HCP is already ${params.newStatus.replace(/_/g, " ")}` };
  }
  return { valid: true };
}
```

Add this exported helper to `actions/hcp.ts`, then create `actions/hcp.test.ts`:
```typescript
import { validateSetStatusParams } from "./hcp";

describe("validateSetStatusParams", () => {
  it("returns error when reason is shorter than 10 chars", () => {
    const result = validateSetStatusParams({
      reason: "short",
      currentStatus: "active",
      newStatus: "inactive",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Reason must be at least 10 characters.");
  });

  it("returns valid for reason of exactly 10 chars", () => {
    const result = validateSetStatusParams({
      reason: "1234567890",
      currentStatus: "active",
      newStatus: "inactive",
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns error when setting same status", () => {
    const result = validateSetStatusParams({
      reason: "valid reason here",
      currentStatus: "inactive",
      newStatus: "inactive",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("HCP is already");
  });

  it("returns valid when status changes with long enough reason", () => {
    const result = validateSetStatusParams({
      reason: "This is a valid reason for changing HCP status",
      currentStatus: "active",
      newStatus: "suspended",
    });
    expect(result.valid).toBe(true);
  });
});
```

Run tests RED first, then add `validateSetStatusParams` export to pass them GREEN.

**Step 3 — Create `components/hcp/HcpStatusPanel.tsx`**:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setHcpStatus } from "@/actions/hcp";

// Install Tooltip shadcn component: npx shadcn@latest add tooltip
// (Run this before implementing if not already added)

type StatusValue = "active" | "inactive" | "suspended" | "do_not_engage";

const STATUS_OPTIONS: { value: StatusValue; label: string }[] = [
  { value: "active",        label: "Active" },
  { value: "inactive",      label: "Inactive" },
  { value: "suspended",     label: "Suspended" },
  { value: "do_not_engage", label: "Do Not Engage" },
];

export function HcpStatusPanel({
  hcpId,
  currentStatus,
}: {
  hcpId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedStatus, setSelectedStatus] = useState<StatusValue | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isDoNotEngage = selectedStatus === "do_not_engage";
  const isSameStatus = selectedStatus === currentStatus;
  const reasonLength = reason.trim().length;
  const isValid = selectedStatus !== "" && reasonLength >= 10 && !isSameStatus;

  const reasonLabel = isDoNotEngage
    ? "Reason for Do-Not-Engage designation (required)"
    : "Reason *";

  function handleStatusChange(val: string) {
    setSelectedStatus(val as StatusValue);
    if (error) setError(null);
  }

  function handleReasonChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setReason(e.target.value);
    if (error) setError(null);
  }

  function handleSave() {
    if (!isValid) return;
    setError(null);
    startTransition(async () => {
      const result = await setHcpStatus({
        hcpId,
        status: selectedStatus as StatusValue,
        reason,
      });
      if (!result.success) {
        setError(result.error ?? "Status could not be saved. Refresh the page and try again.");
      } else {
        setSelectedStatus("");
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[20px]">Set HCP Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Select */}
        <div>
          <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
            Status <span className="text-[hsl(0_72%_51%)]">*</span>
          </label>
          <Select value={selectedStatus} onValueChange={handleStatusChange} disabled={isPending}>
            <SelectTrigger
              className={cn(
                "h-11",
                isDoNotEngage && "border-[hsl(0_72%_51%)] focus:ring-[hsl(0_72%_51%)]"
              )}
              aria-label="Select new HCP status"
            >
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reason Textarea */}
        <div>
          <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
            {reasonLabel}
          </label>
          <Textarea
            value={reason}
            onChange={handleReasonChange}
            placeholder="Enter reason for status change"
            disabled={isPending || !selectedStatus}
            className={cn(
              "min-h-[80px]",
              isDoNotEngage && "border-[hsl(0_72%_51%)] focus-visible:ring-[hsl(0_72%_51%)]"
            )}
            aria-label="Reason for status change"
          />
          <div className="flex justify-between mt-1">
            {error ? (
              <span className="text-[12px] text-[hsl(0_72%_51%)]">{error}</span>
            ) : (
              <span className="text-[12px] text-[hsl(215_16%_47%)]">
                {reasonLength}/{10} minimum characters
              </span>
            )}
          </div>
        </div>

        {/* Set Status Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Wrapper div needed for tooltip on disabled button */}
              <div>
                <Button
                  onClick={handleSave}
                  disabled={!isValid || isPending}
                  className="w-full h-11 bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] disabled:opacity-50"
                  aria-disabled={!isValid}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    "Set Status"
                  )}
                </Button>
              </div>
            </TooltipTrigger>
            {isSameStatus && selectedStatus && (
              <TooltipContent>
                <p>HCP is already {STATUS_OPTIONS.find((o) => o.value === selectedStatus)?.label ?? selectedStatus}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
```

Install Tooltip shadcn component before creating this file:
`npx shadcn@latest add tooltip`

**Step 4 — Update `app/(app)/hcps/[id]/page.tsx`**:

READ the current file first (it contains the placeholder card from Plan 03). Then:

1. Add `HcpStatusPanel` import at top:
   ```typescript
   import { HcpStatusPanel } from "@/components/hcp/HcpStatusPanel";
   ```

2. Replace the placeholder card block:
   ```typescript
   // FIND (the placeholder from Plan 03):
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

   // REPLACE WITH:
   {isCompliance && (
     <HcpStatusPanel
       hcpId={hcp.id}
       currentStatus={hcp.status}
     />
   )}
   ```
  </action>
  <verify>
    <automated>cd C:/Users/HP/HCP_Engage && npx jest actions/hcp.test.ts 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `actions/hcp.test.ts` all 4 tests pass: `npx jest actions/hcp.test.ts` output shows "4 passed"
    - `actions/hcp.ts` contains `setHcpStatus` function with `"use server"` directive (file-level)
    - `actions/hcp.ts` `setHcpStatus()` contains `prisma.$transaction([hcpStatusHistory.create, hcp.update])`
    - `actions/hcp.ts` `setHcpStatus()` checks `role !== "compliance"` and returns Forbidden error for non-Compliance users
    - `actions/hcp.ts` `setHcpStatus()` checks `hcp.status === params.status` and returns "already {status}" error
    - `components/hcp/HcpStatusPanel.tsx` Select contains exactly 4 options with values: `"active"`, `"inactive"`, `"suspended"`, `"do_not_engage"` and labels "Active", "Inactive", "Suspended", "Do Not Engage"
    - `components/hcp/HcpStatusPanel.tsx` Textarea label changes to `"Reason for Do-Not-Engage designation (required)"` when `isDoNotEngage` is true
    - `components/hcp/HcpStatusPanel.tsx` "Set Status" button text is exactly "Set Status" per copywriting contract
    - `app/(app)/hcps/[id]/page.tsx` contains `HcpStatusPanel` import and renders it with `hcpId` and `currentStatus` props
    - `app/(app)/hcps/[id]/page.tsx` does NOT contain the placeholder "Status management panel — implemented in next plan." text
    - `npm run build` exits 0 — no TypeScript errors
    - `npx jest` (all tests) shows all tests passing across lib/auth.test.ts, lib/nppes.test.ts, lib/debarment.test.ts, actions/hcp.test.ts
  </acceptance_criteria>
  <done>Set HCP Status panel fully functional in right sidebar. Compliance users can select status, enter mandatory reason, and save — status history timeline gains new entry at top and profile header badge updates. Same-status prevention with tooltip. Do-not-engage selection triggers destructive visual treatment. Business users see no panel.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → actions/hcp.ts setHcpStatus | Client-side invocation of Server Action that writes status to DB |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Elevation of Privilege | setHcpStatus Server Action | mitigate | `role !== "compliance"` check; Business and Finance users cannot invoke status changes |
| T-04-02 | Tampering | Reason field client bypass | mitigate | Server-side validation in `setHcpStatus`: `reason.trim().length < 10` checked before DB write; client-side check is UX only |
| T-04-03 | IDOR | hcpId parameter in setHcpStatus | mitigate | `prisma.hcp.findUnique({ where: { id: params.hcpId } })` verifies HCP exists before writing; invalid IDs return error without side effects |
| T-04-04 | Denial of Service | Rapid status change submissions | accept | Prisma transactions are atomic; duplicate writes result in new history entries (append-only pattern is correct); no unbounded loops |
</threat_model>

<verification>
After completing this plan:

1. `npx jest` — all tests passing (auth, nppes, debarment, hcp validation = 4 test files)
2. `npm run build` exits 0
3. Visit HCP profile as Compliance user — right sidebar shows "Set HCP Status" panel with Select + Textarea + "Set Status" button
4. Try clicking "Set Status" with no status selected — button is disabled (no click)
5. Select "Active" when HCP is already Active — button is disabled; tooltip shows "HCP is already Active"
6. Select "Inactive", leave reason blank — button disabled
7. Enter 5-char reason — validation shows "5/10 minimum characters", button still disabled
8. Enter 15-char reason — button becomes enabled
9. Click "Set Status" — success; status history section shows new entry at top with "Inactive" badge; header badge updates to "Inactive"
10. Select "Do Not Engage" — Select border turns red; Textarea border turns red; label changes to "Reason for Do-Not-Engage designation (required)"
11. As Business user — right sidebar shows only "Quick Facts" card; no "Set HCP Status" panel
</verification>

<success_criteria>
- HCP-04: Compliance officer can set HCP status with mandatory reason; full status history visible on profile
- All four status values render correctly in Select with exact display labels from UI-SPEC Screen 7
- Status change creates HcpStatusHistory entry atomically with Hcp.status update (one transaction)
- Do-not-engage visual treatment: destructive border on Select and Textarea, relabeled reason field
- Same-status prevention enforced both client-side (disabled button + tooltip) and server-side (returns error)
- All Phase 1 tests passing: `npx jest` shows 4 test files, all passing
- Phase 1 complete: AUTH-01, HCP-01, HCP-02, HCP-03, HCP-04 all delivered
</success_criteria>

<output>
After completion, create `.planning/phases/01-auth-hcp-management/01-04-SUMMARY.md` using the template at `@C:/Users/HP/HCP_Engage/.claude/get-shit-done/templates/summary.md`.
</output>
