---
phase: 03-contracts-polish
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - app/api/engagements/pop-upload/route.ts
  - app/api/engagements/pop-file/[filename]/route.ts
  - components/engagement/ActionPanel.tsx
  - app/(app)/engagements/[id]/page.tsx
findings:
  critical: 4
  warning: 3
  info: 2
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-14  
**Depth:** standard  
**Files Reviewed:** 4  
**Status:** issues_found

## Summary

Four files were reviewed covering the Phase 3 PoP (Proof of Performance) upload feature: an upload API route, a file-serve API route, the engagement ActionPanel client component, and the engagement detail server page.

The most serious issues are concentrated in the two API routes. The serve route's path-traversal guard is incomplete and bypassable. The upload route trusts the browser-supplied `Content-Type` header to validate file type rather than inspecting the actual file bytes, making it trivial to upload a malicious file disguised as a PDF. Neither route is scoped to the engagement that owns the file, so any authenticated user can fetch any other tenant's PoP document. The file extension is also derived from the client-supplied original filename rather than from the MIME type, creating a discrepancy that can be exploited. The `attachPopAction` server action accepts an arbitrary URL as the PoP reference without any allowlist or sanitisation, meaning a user could store a `javascript:` URI or an open redirect and have it rendered as a clickable link in the UI.

---

## Critical Issues

### CR-01: Path-traversal guard in pop-file route is bypassable

**File:** `app/api/engagements/pop-file/[filename]/route.ts:24`

**Issue:** The guard checks for `..` and a combined regex `/[/\\.]\./.test(filename)`, but this only blocks the most literal forms. URL-encoded traversal sequences (`%2F`, `%2e%2e`) are decoded by Next.js before the route handler receives them, so a request to `/api/engagements/pop-file/..%2F..%2Fetc%2Fpasswd` will pass the guard and then `join(process.cwd(), "uploads", "pop", filename)` will resolve outside the `uploads/pop` directory. The correct fix is to assert that the resolved absolute path starts with the upload directory prefix — any input that does not stay inside the directory is rejected after resolution, not before.

```typescript
import { resolve } from "path";

const UPLOAD_DIR = resolve(process.cwd(), "uploads", "pop");

// After awaiting params:
const resolved = resolve(UPLOAD_DIR, filename);
if (!resolved.startsWith(UPLOAD_DIR + path.sep) && resolved !== UPLOAD_DIR) {
  return new NextResponse("Bad Request", { status: 400 });
}
// Then use `resolved` instead of re-computing join(...)
const buffer = await readFile(resolved);
```

---

### CR-02: File-type validation relies solely on the client-supplied MIME type — no magic-byte check

**File:** `app/api/engagements/pop-upload/route.ts:33`

**Issue:** `file.type` is the value the browser (or any HTTP client) places in the `Content-Type` part of the multipart form. It is entirely attacker-controlled. A threat actor can upload a PHP webshell, a JavaScript file, an executable, or any other content by setting `Content-Type: application/pdf` in the form field. The route will accept it, write it to disk, and the serve route will then re-emit it with `Content-Type: application/pdf` — browsers receiving a PDF content type for HTML/script content will still execute it in some contexts. In a pharma compliance platform where uploaded artifacts become part of audit evidence, this is a data-integrity and potential remote-code-execution issue if the server ever executes file content (e.g., if a future middleware or parser touches the files).

Minimum fix: read the first few bytes after converting `file.arrayBuffer()` and verify the magic bytes match the declared type before writing. A hardened fix uses a library such as `file-type` (pure JS, no native bindings).

```typescript
import { fileTypeFromBuffer } from "file-type"; // npm install file-type

const buffer = Buffer.from(await file.arrayBuffer());
const detected = await fileTypeFromBuffer(buffer);
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
if (!detected || !ALLOWED_MIME_TO_EXT[detected.mime]) {
  return NextResponse.json({ error: "File content does not match a permitted type." }, { status: 400 });
}
// Use detected.ext for the stored filename, not file.name
const filename = `${randomUUID()}.${ALLOWED_MIME_TO_EXT[detected.mime]}`;
```

---

### CR-03: pop-file serve route has no engagement-scoped authorization — any authenticated user can fetch any PoP file

**File:** `app/api/engagements/pop-file/[filename]/route.ts:19`

**Issue:** The only check is `userId` (any logged-in user). The filename is a UUID, which provides obscurity but not access control. An authenticated user with the `business` role can enumerate or guess filenames and download PoP documents belonging to other engagements they have no right to view. This violates the data-isolation requirement (all data must be scoped by engagement ownership / compliance role) and the Sunshine Act audit trail requirements (access to regulated documents must be attributable and controlled).

The serve route must verify that the requesting user is the submitter of the engagement that owns this PoP URL, or holds a compliance/finance/legal role. The canonical way is to look up the engagement by `popDocumentUrl` and enforce the same ownership rule used in `EngagementDetailPage`.

```typescript
// After resolving filename to a full URL:
const targetUrl = `/api/engagements/pop-file/${filename}`;
const engagement = await prisma.engagement.findFirst({
  where: { popDocumentUrl: targetUrl },
  select: { submittedByClerkId: true, tenantId: true },
});
if (!engagement) return new NextResponse("Not Found", { status: 404 });

const isOwner = engagement.submittedByClerkId === userId;
const roles = getEffectiveRoles({ role: ..., grants: ... });
const isPrivileged = roles.some(r => ["compliance", "finance", "legal"].includes(r));
if (!isOwner && !isPrivileged) return new NextResponse("Forbidden", { status: 403 });
```

---

### CR-04: `attachPopAction` stores arbitrary user-supplied URLs — enables stored XSS via `javascript:` URI and open redirect

**File:** `actions/engagement.ts:396-400` (called from `components/engagement/ActionPanel.tsx:313`)

**Issue:** The action only checks that `popDocumentUrl` is non-empty. A user can store `javascript:alert(document.cookie)` or `data:text/html,<script>...` as the PoP reference. In `page.tsx` (line 241-249) and `ActionPanel.tsx` (line 339-348), if the stored value does not start with `/api/engagements/pop-file/`, it is rendered as a `<span>` text node — which prevents immediate XSS. However, the `<a href={engagement.popDocumentUrl}>` branch (lines 244-249 in `page.tsx`) fires when the URL *does* start with `/api/engagements/pop-file/`, but there is no validation that the stored URL actually is a safe internal path. A malicious user can craft `popDocumentUrl = "/api/engagements/pop-file/../../../evil"` which passes the string-prefix test and becomes a clickable `<a>` tag pointing to a traversal path. More concretely, today the text-node path renders the raw string, meaning a `javascript:` value stored now would become an exploitable XSS vector the moment any future developer wraps the text in an anchor tag.

The fix is to validate the URL in `attachPopAction` before persisting: only accept values that match `/api/engagements/pop-file/<uuid>.<ext>` (internal upload) or pass a URL allowlist/safelist check for external references.

```typescript
const INTERNAL_POP_RE = /^\/api\/engagements\/pop-file\/[0-9a-f-]{36}\.[a-z]{2,4}$/;
const trimmed = popDocumentUrl.trim();
if (!INTERNAL_POP_RE.test(trimmed)) {
  // External reference — sanitise: must be http/https, no javascript: / data:
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { success: false, error: "Only https/http document references are permitted." };
    }
  } catch {
    return { success: false, error: "Invalid document reference URL." };
  }
}
```

---

## Warnings

### WR-01: File extension derived from client-supplied filename — attacker can persist arbitrary extensions

**File:** `app/api/engagements/pop-upload/route.ts:40`

**Issue:** `file.name.split(".").pop()` takes the extension from the original filename provided by the browser, not from the validated MIME type. An attacker can upload a file with `Content-Type: application/pdf` and `filename: exploit.html` — the sanitisation `replace(/[^a-z0-9]/gi, "")` strips dots and slashes but keeps `html`. The stored file is therefore `<uuid>.html`. If the serve route ever sets `Content-Type` based on this extension (it does — line 37 in the serve route), a browser receiving `text/html` (not in CONTENT_TYPES, so falls through to `application/octet-stream`) will download it rather than execute it. But if someone adds `html` to the `CONTENT_TYPES` map in future, this becomes an XSS path. The extension should be derived exclusively from the validated MIME type, not from the client filename.

**Fix:** Use the MIME-to-extension mapping from the `ALLOWED_TYPES` set rather than parsing `file.name`. This is addressed as part of CR-02 but is independently exploitable if CR-02 is not fully fixed.

---

### WR-02: `Content-Disposition` header in serve route uses the stored UUID filename, not the original filename

**File:** `app/api/engagements/pop-file/[filename]/route.ts:43`

**Issue:** `Content-Disposition: inline; filename="${filename}"` sets the download name to the UUID (e.g., `550e8400-e29b-41d4-a716-446655440000.pdf`). The original human-readable filename is not stored anywhere — the upload route returns it in the JSON response body (`filename: file.name`) but it is never persisted to the database or to a metadata sidecar. When a Compliance officer downloads a PoP document the filename is an opaque UUID with no relationship to the document they uploaded. Beyond the UX harm, `filename` in `Content-Disposition` is not properly quoted for special characters per RFC 6266; it should use `filename*=UTF-8''...` encoding or at minimum escape double-quotes.

**Fix:** Store the original filename (sanitised) alongside the PoP URL in the DB (add a `popDocumentName` column), and use `filename*=UTF-8''${encodeURIComponent(originalName)}` in the serve route. As an immediate partial fix, quote-escape the UUID filename:

```typescript
"Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
```

---

### WR-03: Engagement detail page performs two separate DB queries for `generateMetadata` and the page body — engagement may not exist for metadata but page silently gets `notFound()`

**File:** `app/(app)/engagements/[id]/page.tsx:21-28` and `56-93`

**Issue:** `generateMetadata` executes its own `prisma.engagement.findUnique` (line 21) independently of the page's `findUnique` (line 56). If the engagement exists when `generateMetadata` runs but is deleted before the page body query executes (a TOCTOU race), the page body calls `notFound()` but the metadata already resolved with data — harmless in practice but a correctness gap. More concretely, `generateMetadata` does not check if `engagement` is null before accessing `engagement.hcp.fullName` on line 27. If the engagement does not exist, this throws `TypeError: Cannot read properties of null`, causing a 500 error instead of the 404 the page body would produce.

**Fix:**

```typescript
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const engagement = await prisma.engagement.findUnique({
    where: { id },
    include: { hcp: { select: { fullName: true } } },
  });
  if (!engagement) return { title: "Engagement Not Found — HCP Engage" };
  return {
    title: `${ENGAGEMENT_TYPE_LABELS[engagement.engagementType] ?? engagement.engagementType} — ${engagement.hcp.fullName} — HCP Engage`,
  };
}
```

---

## Info

### IN-01: Local filesystem storage is not production-viable and conflicts with stated architecture

**File:** `app/api/engagements/pop-upload/route.ts:42-46`

**Issue:** Files are written to `process.cwd()/uploads/pop/` on the local filesystem. The CLAUDE.md architecture specifies AWS S3 / Cloudflare R2 as the storage layer (with per-tenant path prefixes). On Railway or AWS ECS Fargate, containers are ephemeral; the `uploads/` directory is destroyed on every redeploy or container restart, silently deleting all uploaded PoP files. The serve route will then return 404 for every existing PoP link in the database. This is a data loss risk in any non-local environment.

**Fix:** Replace `writeFile`/`readFile` with S3 PutObject/GetObject (or pre-signed URL redirect) using the per-tenant prefix pattern described in the architecture. This is listed as deferred in Phase 3, but the current implementation needs a clear warning comment and should not ship to production as-is without that guard.

---

### IN-02: `isBusinessOnly` computed in `ActionPanel` but logic diverges from the `isBusinessRole` guard in `page.tsx`

**File:** `components/engagement/ActionPanel.tsx:69-71` vs `app/(app)/engagements/[id]/page.tsx:51-53`

**Issue:** The page defines `isBusinessRole` as `effectiveRoles.includes("business") && !effectiveRoles.includes("compliance") && !effectiveRoles.includes("finance")` — it does not exclude the `legal` role. The ActionPanel defines `isBusinessOnly` with the same two exclusions but also does not exclude `legal`. Both are consistent with each other, but neither is actually used to make any access-control decision that matters — `isBusinessOnly` in ActionPanel is declared but never referenced in any conditional branch. It is dead code.

**Fix:** Remove the `isBusinessOnly` variable from `ActionPanel.tsx` (line 69-71) or use it where intended.

---

_Reviewed: 2026-05-14_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
