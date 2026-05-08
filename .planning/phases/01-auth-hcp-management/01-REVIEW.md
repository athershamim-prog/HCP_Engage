---
phase: 01-auth-hcp-management
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - actions/debarment.ts
  - actions/hcp.ts
  - app/(app)/dashboard/page.tsx
  - app/(app)/hcps/[id]/page.tsx
  - app/(app)/hcps/new/page.tsx
  - app/(app)/hcps/page.tsx
  - app/(app)/layout.tsx
  - app/(auth)/sign-in/[[...sign-in]]/page.tsx
  - app/api/hcps/exists/route.ts
  - app/api/nppes/route.ts
  - app/layout.tsx
  - components/hcp/DebarmentBadge.tsx
  - components/hcp/DebarmentCheckPanel.tsx
  - components/hcp/HcpStatusBadge.tsx
  - components/hcp/HcpStatusPanel.tsx
  - components/hcp/HcpTable.tsx
  - components/hcp/NpiLookupForm.tsx
  - components/hcp/StatusHistoryTimeline.tsx
  - components/shared/EmptyState.tsx
  - components/shell/Header.tsx
  - components/shell/Sidebar.tsx
  - lib/auth.ts
  - lib/debarment.ts
  - lib/hcp-validation.ts
  - lib/nppes.ts
  - lib/prisma.ts
  - middleware.ts
  - prisma/schema.prisma
  - prisma/seed.ts
findings:
  critical: 9
  warning: 8
  info: 4
  total: 21
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-08
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Reviewed 28 source files covering authentication, HCP management, debarment checking, role-based access control, and the Prisma schema. This is a pharma compliance platform under US Sunshine Act requirements, so correctness of role gates, audit trail completeness, and debarment matching logic are the highest-priority concerns.

The implementation has several blockers that must be addressed before any production use: multi-tenant isolation is entirely absent from the schema (violating the project's own CLAUDE.md rule #1), the debarment `runCheck` action has no tenant scope check (IDOR), the audit trail does not capture the prior HCP status on status changes, and the `canAccessRoute` prefix logic can be trivially bypassed via a crafted URL. There are also compliance correctness gaps in the debarment name-matching algorithm (false-negative risk) and the `saveDetermination` action does not verify that the referenced `checkId` belongs to the `hcpId` supplied by the caller.

---

## Critical Issues

### CR-01: Missing `tenant_id` on every table — entire multi-tenant isolation absent

**File:** `prisma/schema.prisma:13-166`
**Issue:** CLAUDE.md rule #1 states explicitly: "tenant_id on every table — non-nullable, present from migration 1." None of the six models (`Hcp`, `HcpStatusHistory`, `DebarmentCheck`, `DebarmentDetermination`, `OigLeieRecord`, `SamGovRecord`, `UserGrant`) have a `tenantId` column. Every query in the application therefore returns data across all tenants. Any user of one pharmaceutical company can read, search, and (via Server Actions) modify HCP records belonging to other tenants. This is a complete data-isolation failure for a multi-tenant system.
**Fix:** Add `tenantId String` (non-nullable) to every table, add a `@@index([tenantId])`, and scope every Prisma query in Server Actions and route handlers with `where: { tenantId: user.tenantId }`. This is a breaking schema change that must happen before any real tenant data is stored.

---

### CR-02: IDOR in `runCheck` — no tenant scope verification

**File:** `actions/debarment.ts:28-29`
**Issue:** After role-checking the actor is `compliance`, the action only verifies the HCP exists by raw `id`:
```ts
const hcp = await prisma.hcp.findUnique({ where: { id: hcpId } });
if (!hcp) return { success: false, error: "HCP not found" };
```
Any compliance user from any tenant can pass any `hcpId` and trigger (and read) a debarment check on another tenant's HCP. Even with tenant_id added, this pattern must also scope the lookup to the caller's tenant.
**Fix:**
```ts
const hcp = await prisma.hcp.findUnique({
  where: { id: hcpId, tenantId: user.tenantId }, // scope to caller's tenant
});
```

---

### CR-03: IDOR in `saveDetermination` — `checkId`/`hcpId` cross-ownership not verified

**File:** `actions/debarment.ts:96-113`
**Issue:** The action accepts both `checkId` and `hcpId` from the client but never verifies that the `DebarmentCheck` identified by `checkId` actually belongs to the supplied `hcpId`. A compliance user can submit a valid `checkId` from HCP A paired with `hcpId` of HCP B, causing `revalidatePath` to run for HCP B while the determination is attached to an unrelated check. With a real multi-tenant setup the damage is broader: any compliance user can attach a determination to any check.
**Fix:**
```ts
const check = await prisma.debarmentCheck.findUnique({
  where: { id: params.checkId },
  select: { hcpId: true },
});
if (!check || check.hcpId !== params.hcpId) {
  return { success: false, error: "Check not found" };
}
```
Perform this verification before the upsert.

---

### CR-04: `canAccessRoute` prefix logic allows bypass via crafted paths

**File:** `lib/auth.ts:47-60`, `middleware.ts:32`
**Issue:** Route matching uses:
```ts
route === pattern || route.startsWith(pattern + "/")
```
The `ROUTE_PERMISSIONS` map covers `/hcps` and `/hcps/new`, but not `/dashboard`. A `business` user can access `/dashboard` because `/dashboard` is not matched by either `/hcps` or `/hcps/new`, so `canAccessRoute` falls through to `return true` (line 59 — "Routes not in the map are accessible to all authenticated users"). Middleware then allows the request. The dashboard is currently a stub but this logic means any future finance-gated content under `/dashboard` will be accessible to all authenticated roles until each new route is explicitly listed.

More critically, the comment in middleware.ts reads "Finance users trying /hcps → redirect to /dashboard; Business users trying /dashboard → redirect to /hcps." The redirect fallback for non-finance users on line 34 is `"/hcps"`, which is correct, but the condition is incorrect: a business user hitting `/dashboard` passes `canAccessRoute` (returns `true`) so the redirect never fires. The middleware's role-based redirect is therefore non-functional for this case.
**Fix:** Change the default in `canAccessRoute` to `return false` (deny by default) and explicitly list every protected route, or invert the map to an allowlist per role. At minimum add `"/dashboard": ["finance"]` to `ROUTE_PERMISSIONS`.

---

### CR-05: Audit trail does not capture `fromStatus` on HCP status transitions

**File:** `actions/hcp.ts:158-172`, `prisma/schema.prisma:40-52`
**Issue:** `HcpStatusHistory` records only the new `status` and `reason`. There is no `fromStatus` / `previousStatus` field. For regulatory audit purposes (OIG, Sunshine Act), a change log must be self-contained — each entry must show what state the HCP moved *from*, not just what it moved *to*. Reconstructing prior state requires traversing the entire history in insertion order, which is fragile and breaks if any records are deleted (cascade is enabled on the parent `Hcp`).

The CLAUDE.md specifies: "Audit log is append-only — self-contained entries." Without the prior status, each entry is not self-contained.
**Fix:** Add `fromStatus HcpStatus` to `HcpStatusHistory` and populate it in `setHcpStatus`:
```ts
prisma.hcpStatusHistory.create({
  data: {
    hcpId: params.hcpId,
    fromStatus: hcp.status,   // <-- add this
    status: params.status,
    reason: params.reason.trim(),
    setByClerkId: user.id,
    setByName: user.fullName ?? "Unknown",
  },
}),
```

---

### CR-06: `DebarmentDetermination` is mutable (upsert) — violates append-only audit requirement

**File:** `actions/debarment.ts:98-113`, `prisma/schema.prisma:75-86`
**Issue:** `saveDetermination` uses `upsert`, which overwrites the existing `outcome` and `rationale` in-place. The `DebarmentDetermination` table has an `updatedAt` field confirming mutability is intentional. For a compliance platform, this means a compliance officer can silently alter a prior "confirmed_exclusion" determination to "false_positive" — no history of the change is preserved. This is a regulatory audit-trail failure.
**Fix:** Change the data model so determinations are append-only. Instead of `upsert`, always `create` a new determination and relate it to the check. Keep all determination versions. If "latest determination wins" semantics are needed, query `orderBy: { createdAt: "desc" }, take: 1`. Remove `updatedAt` from the determination model.

---

### CR-07: `matchOigRecord` false-negative when HCP has NPI but OIG record lacks NPI

**File:** `lib/debarment.ts:30-44`
**Issue:** The NPI-priority matching logic reads:
```ts
if (hcp.npi && record.npi) {
  return hcp.npi === record.npi;
}
```
If the HCP has an NPI (all HCPs in this system do — NPI is required) and the OIG record has `npi = null`, the NPI branch is skipped and fallback name-matching runs. This is correct for that case. However, the inverse case is dangerous: if the OIG record has an NPI that does *not* match the HCP's NPI but the names happen to match, the name-match branch will fire (because `hcp.npi && record.npi` is `true` only when *both* have NPI). Wait — this is actually the opposite direction. Let me state the actual defect precisely:

If `record.npi` is non-null and `hcp.npi !== record.npi`, the function returns `false` immediately from the NPI branch — correct. But if `record.npi` is non-null and matches some other HCP's NPI, the DB query on line 80-84 uses an `OR` filter that can fetch it:
```ts
OR: [
  { npi: hcp.npi },
  { lastName: { equals: hcp.lastName.toUpperCase(), mode: "insensitive" } },
]
```
A record whose `lastName` matches but whose NPI differs from the HCP will be fetched as a candidate, then `matchOigRecord` correctly returns `false` for it. This part is fine.

The real defect: `normalizeName` is only called at comparison time, but OIG LEIE data is stored in the DB exactly as seeded. The seed data uses `"SMITH"` (uppercase). However `hcp.lastName` comes from NPPES data as `"Smith"` (mixed case). The query filter `{ lastName: { equals: hcp.lastName.toUpperCase(), mode: "insensitive" } }` compensates at query time, but then `matchOigRecord` also calls `normalizeName` (which is `trim().toUpperCase()`). This is correct and consistent. However there is a subtler gap: `matchSamRecord`'s last-resort branch (line 64-65) uses `includes` on `normalizeName(record.name)` — a full-name field like `"JOHNSON ROBERT"`. If the HCP's last name is `"JOHNSON"`, `normalizeName("JOHNSON ROBERT").includes("JOHNSON")` is `true` — this is an intentional last resort. But it will also match `"JOHNSON SMITH"` (a different individual with the same last name) since there is no first-name confirmation in this branch. This is a false-positive risk in the match function used for compliance screening, potentially marking an innocent HCP as debarred.
**Fix:** The last-resort branch in `matchSamRecord` must require first-name confirmation when it is available, or be removed entirely:
```ts
// Last resort: only match if we can confirm first name too
if (record.firstName && normalizeName(hcp.firstName) !== normalizeName(record.firstName)) {
  return false;
}
return normalizeName(record.name).includes(normalizeName(hcp.lastName));
```

---

### CR-08: `addHcp` action returns existing HCP ID without verifying tenant — IDOR via race condition

**File:** `actions/hcp.ts:36-39`
**Issue:** When an HCP with the given NPI already exists, `addHcp` silently returns the existing record's `id` to the caller:
```ts
const existing = await prisma.hcp.findUnique({ where: { npi: nppesData.npi } });
if (existing) {
  return { id: existing.id };
}
```
Without tenant scoping, this lets a business user at Tenant B discover the internal record ID of an HCP that Tenant A added — they simply try to add any NPI that exists. The caller (`NpiLookupForm`) then navigates to `/hcps/${result.id}`, which fetches and renders the Tenant A record.
**Fix:** Scope the existence check to the caller's tenant. If the NPI exists but belongs to a different tenant, return an error rather than exposing the foreign ID.

---

### CR-09: `app/api/hcps/exists` route has no NPI format validation — accepts arbitrary query input

**File:** `app/api/hcps/exists/route.ts:9-10`
**Issue:** The route accepts the `npi` query parameter and passes it directly to Prisma:
```ts
const npi = request.nextUrl.searchParams.get("npi");
if (!npi) return NextResponse.json({ error: "npi required" }, { status: 400 });

const hcp = await prisma.hcp.findUnique({ where: { npi }, select: { id: true } });
```
There is no format validation (10 digits). While Prisma parameterises the query preventing SQL injection, an authenticated user can send arbitrarily long or malformed strings to probe the existence of DB records by NPI, or cause unexpected query plan behaviour. The `/api/nppes` route uses `validateNpi` before calling `fetchNppesHcp`, but this route bypasses that guard entirely.
**Fix:**
```ts
import { validateNpi } from "@/lib/nppes";

if (!validateNpi(npi)) {
  return NextResponse.json({ error: "Invalid NPI format" }, { status: 400 });
}
```

---

## Warnings

### WR-01: `setHcpStatus` only checks Clerk primary role — UserGrant expansion ignored

**File:** `actions/hcp.ts:129-135`
**Issue:** The role check in `setHcpStatus` reads `user.publicMetadata.role` directly:
```ts
const role = (user.publicMetadata as { role?: string }).role;
if (role !== "compliance") { ... }
```
The application's own role model (`lib/auth.ts`, `getEffectiveRoles`) supports granting additional roles via `UserGrant` DB records (D-04b). A user whose *primary* role is `business` but who has been granted `compliance` via `UserGrant` would be denied. The same pattern appears in `runCheck` and `saveDetermination`. All three Server Actions must use `getEffectiveRoles` for consistency.
**Fix:**
```ts
const userGrant = await prisma.userGrant.findUnique({ where: { clerkUserId: user.id } });
const effectiveRoles = getEffectiveRoles({
  role: (user.publicMetadata as { role?: string }).role,
  grants: userGrant?.grantedRoles ?? [],
});
if (!effectiveRoles.includes("compliance")) {
  return { success: false, error: "Forbidden" };
}
```

---

### WR-02: `addHcp` throws on authorization failure instead of returning a result object

**File:** `actions/hcp.ts:27-33`
**Issue:** `addHcp` uses `throw new Error("Unauthorized")` and `throw new Error("Forbidden: ...")` rather than returning `{ id: string; error?: string }`. The caller in `NpiLookupForm` (`handleAdd`) has no `try/catch` around the `addHcp` call:
```ts
const result = await addHcp(lookupState.hcp);
router.push(`/hcps/${result.id}`);
```
An unauthorized user (or a `finance` user who navigates directly to `/hcps/new`) will get an unhandled promise rejection that surfaces as a blank page crash rather than a user-facing error message.
**Fix:** Change `addHcp` to return `{ id?: string; error?: string }` and check `result.error` in the caller, or add a `try/catch` in `handleAdd` in `NpiLookupForm`.

---

### WR-03: NPI lookup result is trusted without re-validation before `addHcp` is called

**File:** `components/hcp/NpiLookupForm.tsx:68-73`
**Issue:** `handleAdd` passes `lookupState.hcp` (the NPPES API response, already deserialized in the browser) directly to the `addHcp` Server Action:
```ts
const result = await addHcp(lookupState.hcp);
```
The `NppesHcp` payload is constructed client-side from the NPPES API response and stored in React state. A user can intercept and modify this state or call the Server Action directly with an arbitrary `NppesHcp` object. The Server Action does not re-validate the NPI format or re-fetch from NPPES to confirm the data matches. This means a user could add a HCP record with manipulated NUCC codes, names, or affiliations.
**Fix:** In `addHcp`, re-fetch from NPPES using `fetchNppesHcp(nppesData.npi)` server-side (or at minimum call `validateNpi`) before persisting. Do not trust the client-provided `NppesHcp` payload as authoritative.

---

### WR-04: `HcpProfilePage` calls `currentUser()` and returns `notFound()` on auth failure instead of redirecting

**File:** `app/(app)/hcps/[id]/page.tsx:36-38`
**Issue:**
```ts
const user = await currentUser();
if (!user) notFound();
```
An unauthenticated request to `/hcps/[id]` will render a 404 page rather than redirect to `/sign-in`. The middleware should catch this first, but if middleware is bypassed or misconfigured, users see an opaque 404 instead of the expected auth redirect. The app layout (`app/(app)/layout.tsx:13-14`) correctly uses `redirect("/sign-in")`.
**Fix:** Replace `notFound()` with `redirect("/sign-in")` when `!user` in the profile page.

---

### WR-05: Pagination does not validate `page` parameter — negative or zero values cause DB errors

**File:** `app/(app)/hcps/page.tsx:16`, `actions/hcp.ts:76`
**Issue:** The page number is parsed with `parseInt(params.page ?? "1", 10)` and fed into `skip: (page - 1) * pageSize`. If a user navigates to `?page=0` or `?page=-5`, `skip` becomes negative (`-20` for `page=0`), which Prisma rejects at the DB driver level and throws an uncaught error that bubbles as a 500. If `?page=abc` is supplied, `parseInt` returns `NaN`, and `(NaN - 1) * 20 = NaN`, also causing a Prisma error.
**Fix:**
```ts
const rawPage = parseInt(params.page ?? "1", 10);
const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
```

---

### WR-06: `OigLeieRecord` index on `[lastName, firstName]` and DB query use inconsistent casing

**File:** `lib/debarment.ts:79-85`, `prisma/schema.prisma:115`
**Issue:** The OIG query filters by `{ lastName: { equals: hcp.lastName.toUpperCase(), mode: "insensitive" } }`. Because the query uses `mode: "insensitive"`, casing at query time is fine. However the schema index `@@index([lastName, firstName])` is a B-tree index; without a specific `db.Index` expression or a lower-case functional index, Postgres will not use this index for a case-insensitive equality predicate on `lastName`. The index is effectively unused for the most common debarment lookup path. In a production system with millions of exclusion records this causes a full-table scan on every debarment check.

This is noted as a warning rather than blocker because v1 uses a small seed dataset. It must be fixed before loading real OIG LEIE data.
**Fix:** Either store all `lastName`/`firstName` values in uppercase at seed/import time and query without `mode: "insensitive"`, or add a PostgreSQL functional index (`@@index([lastName(ops: raw("text_pattern_ops"))])`). The simpler fix is to uppercase on insert and remove `mode: "insensitive"` from queries.

---

### WR-07: `DebarmentCheckPanel` allows "Update Determination" on a cleared/no-hit check via direct state manipulation

**File:** `components/hcp/DebarmentCheckPanel.tsx:289-299`, `actions/debarment.ts:78-121`
**Issue:** The "Update Determination" button only appears in the UI when `check.determination` exists. However, the determination form at line 305 is rendered when `isCompliance && hasHit && (showDetermForm || !check.determination)`. If a compliance officer manually sets `showDetermForm = true` (via browser devtools), the form renders and `saveDetermination` can be called even without a hit. The Server Action itself does not verify that the referenced `DebarmentCheck` has `oigHit || samHit == true`. A determination of "confirmed_exclusion" could be saved on a check with no actual hit.
**Fix:** In the `saveDetermination` Server Action, fetch the `DebarmentCheck` record and verify `oigHit || samHit` is true if `outcome !== "cleared"`:
```ts
const check = await prisma.debarmentCheck.findUnique({
  where: { id: params.checkId },
  select: { oigHit: true, samHit: true, hcpId: true },
});
if (!check || check.hcpId !== params.hcpId) {
  return { success: false, error: "Check not found" };
}
```

---

### WR-08: `canAccessRoute` returns `true` for all unenumerated routes — finance users can access any future unguarded page

**File:** `lib/auth.ts:58-59`
**Issue:** (Extends CR-04 at the quality level.) The fallback `return true` in `canAccessRoute` means any new route added to the application that is not yet in `ROUTE_PERMISSIONS` is world-accessible to all authenticated roles. A finance user adding HCPs or a business user viewing financial data would be a compliance violation. This is a latent defect that will bite every phase of development.
**Fix:** Default to `return false` and add an explicit entry for `"/"` and any truly role-agnostic routes. Document the policy in a comment.

---

## Info

### IN-01: `prisma/schema.prisma` — Cascade deletes on compliance records create data-loss risk

**File:** `prisma/schema.prisma:49, 69, 85`
**Issue:** `HcpStatusHistory`, `DebarmentCheck`, and `DebarmentDetermination` all use `onDelete: Cascade` from the parent `Hcp`. Deleting an HCP record (if that operation is ever permitted) silently destroys the entire compliance audit trail for that individual. For a Sunshine Act platform, these records may need to be retained even after an HCP is deactivated.
**Fix:** Consider `onDelete: Restrict` to prevent accidental cascade deletes. If an HCP truly needs to be removed, the compliance records should be archived rather than deleted.

---

### IN-02: `HcpTable` uses `window.location.href` for row navigation instead of Next.js router

**File:** `components/hcp/HcpTable.tsx:65`
**Issue:**
```ts
onClick={() => { window.location.href = `/hcps/${hcp.id}`; }}
```
This triggers a full page reload instead of a client-side navigation, discarding React state and skipping the prefetching that Next.js provides. The `<Link>` already on the name cell handles navigation correctly; the row-level click handler should use `router.push` or be removed in favour of making the entire row a link.
**Fix:** Import `useRouter` and use `router.push(`/hcps/${hcp.id}`)` in the row click handler.

---

### IN-03: `app/api/nppes/route.ts` — NPPES error details logged to server console may expose PII

**File:** `app/api/nppes/route.ts:24`
**Issue:** `console.error("NPPES lookup error:", error)` logs the raw error object. Depending on the NPPES response, this may include NPI values, partial HCP names, or API response bodies in server logs. For a HIPAA-adjacent system, log scrubbing should be considered.
**Fix:** Log only the error message and status code, not the full error object: `console.error("NPPES lookup error:", (error as Error).message)`.

---

### IN-04: `DebarmentDetermination.updatedAt` signals mutable record in an append-only context

**File:** `prisma/schema.prisma:83`
**Issue:** The presence of `updatedAt DateTime @updatedAt` on `DebarmentDetermination` is a design signal that this record is intended to be mutable, which conflicts with CR-06 (the append-only audit trail requirement). Even if the `saveDetermination` action is fixed to always insert, the `updatedAt` field will create confusion for future maintainers.
**Fix:** Remove `updatedAt` from `DebarmentDetermination` once the model is changed to append-only.

---

_Reviewed: 2026-05-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
