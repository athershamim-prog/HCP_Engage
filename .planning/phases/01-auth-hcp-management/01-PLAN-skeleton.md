---
phase: 01-auth-hcp-management
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - next.config.ts
  - tailwind.config.ts
  - tsconfig.json
  - middleware.ts
  - .env.example
  - app/layout.tsx
  - app/(auth)/sign-in/[[...sign-in]]/page.tsx
  - app/(app)/layout.tsx
  - app/(app)/hcps/page.tsx
  - app/(app)/dashboard/page.tsx
  - components/shell/Sidebar.tsx
  - components/shell/Header.tsx
  - lib/auth.ts
  - lib/prisma.ts
  - prisma/schema.prisma
  - prisma/seed.ts
autonomous: true
requirements:
  - AUTH-01

must_haves:
  truths:
    - "A user who visits any protected route while unauthenticated is redirected to /sign-in"
    - "After signing in as Business role, the sidebar shows 'HCP Directory' and 'Add HCP'; Finance nav items are absent"
    - "After signing in as Finance role, the sidebar shows only 'Dashboard'; HCP nav items are absent"
    - "A Compliance user with UserGrant expansion sees the union of granted roles' nav items"
    - "All 7 Prisma tables exist in the Neon PostgreSQL database after schema push"
    - "npm run build exits 0 with no TypeScript errors"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "Full Phase 1 schema — Hcp, HcpStatusHistory, DebarmentCheck, DebarmentDetermination, OigLeieRecord, SamGovRecord, UserGrant"
      contains: "model Hcp"
    - path: "middleware.ts"
      provides: "Role-gated route protection via Clerk + effective role computation"
      exports: ["default"]
    - path: "lib/auth.ts"
      provides: "getEffectiveRoles(), assertRole() helpers"
      exports: ["getEffectiveRoles", "assertRole"]
    - path: "app/(app)/layout.tsx"
      provides: "App shell with Sidebar + Header, wraps all authenticated routes"
    - path: "app/(auth)/sign-in/[[...sign-in]]/page.tsx"
      provides: "Clerk SignIn embedded component"
  key_links:
    - from: "middleware.ts"
      to: "lib/auth.ts"
      via: "getEffectiveRoles() called with Clerk auth session"
      pattern: "getEffectiveRoles"
    - from: "components/shell/Sidebar.tsx"
      to: "lib/auth.ts"
      via: "role-filtered nav items computed server-side"
      pattern: "effectiveRoles"
    - from: "lib/prisma.ts"
      to: "prisma/schema.prisma"
      via: "PrismaClient singleton generated from schema"
      pattern: "PrismaClient"
---

## Phase Goal

**As a** compliance platform operator, **I want to** scaffold a fully wired Next.js 15 + Clerk + Prisma stack with role-gated routing, **so that** every subsequent feature is built on a proven, deployable foundation.

<objective>
Scaffold the entire HCP Engage project from zero: initialize Next.js 15, configure Clerk authentication with RBAC middleware, define the complete Phase 1 Prisma schema, push it to Neon, and wire the app shell with role-gated navigation. After this plan, a user can log in and see their role-appropriate navigation. The database exists with all Phase 1 tables.

Purpose: Establish the walking skeleton so all subsequent plans build on a proven, deployable stack.
Output: Working Next.js app with Clerk auth, role-gated shell, full Prisma schema pushed to Neon, and seed data for OIG LEIE and SAM.gov reference tables.
</objective>

<execution_context>
@C:/Users/HP/HCP_Engage/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/HCP_Engage/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:\Users\HP\HCP_Engage\.planning\PROJECT.md
@C:\Users\HP\HCP_Engage\.planning\ROADMAP.md
@C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-CONTEXT.md
@C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-UI-SPEC.md
@C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-SKELETON.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold Next.js 15 project, configure Clerk, shadcn/ui, and Prisma</name>
  <read_first>
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-CONTEXT.md (decisions D-06, D-07)
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-UI-SPEC.md (Design System section)
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-SKELETON.md (Directory Layout section)
    - C:\Users\HP\HCP_Engage\CLAUDE.md (stack definition)
  </read_first>
  <files>
    package.json, next.config.ts, tailwind.config.ts, tsconfig.json, .env.example,
    app/layout.tsx, app/(auth)/sign-in/[[...sign-in]]/page.tsx,
    lib/prisma.ts, prisma/schema.prisma
  </files>
  <action>
Initialize a new Next.js 15 project in the current directory (C:\Users\HP\HCP_Engage) using:
`npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*"`

Then install additional dependencies:
`npm install @clerk/nextjs @prisma/client prisma lucide-react`
`npm install -D @types/node`

Initialize shadcn/ui with neutral style:
`npx shadcn@latest init`
When prompted: style = "Default", base color = "Neutral", CSS variables = yes.

Install Phase 1 shadcn components:
`npx shadcn@latest add button card input select textarea table badge pagination sonner`

Initialize Prisma:
`npx prisma init`

Create `lib/prisma.ts` with PrismaClient singleton:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Create `app/layout.tsx` as root layout with ClerkProvider:
```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HCP Engage",
  description: "Pharma commercial compliance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

Create `app/(auth)/sign-in/[[...sign-in]]/page.tsx`:
```typescript
import { SignIn } from "@clerk/nextjs";

export const metadata = {
  title: "Sign In — HCP Engage",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[hsl(0_0%_98%)] px-4">
      <div className="mb-8 text-center">
        <h1 className="text-[28px] font-semibold text-[hsl(220_13%_18%)] leading-[1.15]">
          HCP Engage
        </h1>
        <p className="text-[12px] text-[hsl(215_16%_47%)] mt-1">
          Pharma commercial compliance
        </p>
      </div>
      <div className="w-full max-w-[480px]">
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-sm border border-[hsl(220_13%_91%)] rounded-lg",
              headerTitle: "text-[20px] font-semibold",
              headerSubtitle: "text-[14px] text-[hsl(215_16%_47%)]",
              socialButtonsBlockButton: "hidden",
              dividerRow: "hidden",
              footerActionLink: "hidden",
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl={undefined}
          afterSignInUrl="/hcps"
        />
      </div>
    </div>
  );
}
```

Create `.env.example` committed to repo:
```
DATABASE_URL="postgresql://user:password@neon-host/hcp_engage?sslmode=require"
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/hcps
```

Update `next.config.ts` to allow Clerk images:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};

export default nextConfig;
```

Update `tsconfig.json` to ensure strict mode is enabled — confirm `"strict": true` exists under `compilerOptions`. The create-next-app default includes this; verify and do not remove it.
  </action>
  <verify>
    <automated>cd C:/Users/HP/HCP_Engage && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` contains `"@clerk/nextjs"`, `"@prisma/client"`, `"lucide-react"`, `"prisma"` (devDependency) in dependencies
    - `app/layout.tsx` contains `ClerkProvider`
    - `app/(auth)/sign-in/[[...sign-in]]/page.tsx` contains `SignIn` imported from `"@clerk/nextjs"`
    - `lib/prisma.ts` contains `globalForPrisma` singleton pattern and `PrismaClient`
    - `tsconfig.json` contains `"strict": true`
    - `.env.example` contains `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
    - `components/ui/button.tsx` exists (shadcn installed)
  </acceptance_criteria>
  <done>Next.js 15 project initialized with Clerk, shadcn/ui (neutral), Prisma, and root layout wrapping ClerkProvider. Login page renders Clerk SignIn with no social buttons and no sign-up link.</done>
</task>

<task type="auto">
  <name>Task 2: Define complete Phase 1 Prisma schema and push to Neon [BLOCKING]</name>
  <read_first>
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-CONTEXT.md (decisions D-08 through D-14, D-11b)
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-SKELETON.md (Prisma Schema Summary section)
    - C:\Users\HP\HCP_Engage\prisma\schema.prisma (current state after Task 1 init)
  </read_first>
  <files>
    prisma/schema.prisma, prisma/seed.ts, package.json
  </files>
  <action>
Replace `prisma/schema.prisma` entirely with the following schema. This is the COMPLETE Phase 1 schema — all tables that Plans 02, 03, and 04 will use are defined here.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─────────────────────────────────────────────
// HCP Core
// ─────────────────────────────────────────────

model Hcp {
  id                  String    @id @default(cuid())
  npi                 String    @unique
  firstName           String
  lastName            String
  fullName            String
  credentials         String?
  nuccCode            String    // NUCC taxonomy code
  nuccDisplayName     String    // Human-readable specialty
  primaryState        String    // 2-letter abbreviation
  hcoAffiliation      String?   // Null if no affiliation on record
  status              HcpStatus @default(active)
  debarmentCheckedAt  DateTime?
  debarmentStatus     DebarmentStatus @default(not_checked)
  addedByClerkId      String    // Clerk user ID of the person who added this HCP
  addedByName         String    // Stored as string at time of add (not FK)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  statusHistory       HcpStatusHistory[]
  debarmentChecks     DebarmentCheck[]

  @@index([npi])
  @@index([status])
  @@index([lastName, firstName])
}

model HcpStatusHistory {
  id          String    @id @default(cuid())
  hcpId       String
  status      HcpStatus
  reason      String    // Mandatory — min 10 chars enforced at application layer
  setByClerkId String   // Clerk user ID
  setByName   String    // Stored as string at time of change
  createdAt   DateTime  @default(now())

  hcp         Hcp       @relation(fields: [hcpId], references: [id], onDelete: Cascade)

  @@index([hcpId])
}

// ─────────────────────────────────────────────
// Debarment
// ─────────────────────────────────────────────

model DebarmentCheck {
  id                String               @id @default(cuid())
  hcpId             String
  checkedByClerkId  String
  checkedByName     String
  oigHit            Boolean
  samHit            Boolean
  oigMatchJson      Json?                // Raw OIG match fields if hit
  samMatchJson      Json?                // Raw SAM.gov match fields if hit
  createdAt         DateTime             @default(now())

  hcp               Hcp                  @relation(fields: [hcpId], references: [id], onDelete: Cascade)
  determination     DebarmentDetermination?

  @@index([hcpId])
}

model DebarmentDetermination {
  id              String                @id @default(cuid())
  checkId         String                @unique
  outcome         DeterminationOutcome
  rationale       String                // Mandatory — min 20 chars enforced at application layer
  recordedByClerkId String
  recordedByName  String
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  check           DebarmentCheck        @relation(fields: [checkId], references: [id], onDelete: Cascade)
}

// ─────────────────────────────────────────────
// OIG LEIE Reference (pre-seeded, read-only in v1)
// Modeled on real OIG LEIE CSV structure
// ─────────────────────────────────────────────

model OigLeieRecord {
  id              String    @id @default(cuid())
  lastName        String
  firstName       String?
  middleName      String?
  busName         String?   // Business name for entity exclusions
  general         String?   // General nature of exclusion
  specialty       String?
  upin            String?
  npi             String?
  dob             String?   // Date of birth as string (OIG CSV format: MM/DD/YYYY)
  address         String?
  city            String?
  state           String?
  zip             String?
  exclusionType   String    // e.g., "1128a1" (section of Social Security Act)
  exclusionDate   String    // Date exclusion took effect (MM/DD/YYYY)
  waiverDate      String?
  waiverState     String?
  createdAt       DateTime  @default(now())

  @@index([npi])
  @@index([lastName, firstName])
}

// ─────────────────────────────────────────────
// SAM.gov Exclusion Reference (pre-seeded, read-only in v1)
// Modeled on real SAM.gov exclusion record fields
// ─────────────────────────────────────────────

model SamGovRecord {
  id                    String    @id @default(cuid())
  classificationType    String    // "Individual" or "Firm"
  exclusionType         String    // e.g., "Ineligible (Proceedings Pending)"
  exclusionProgram      String    // e.g., "Reciprocal"
  agencyName            String
  ctCode                String?
  npi                   String?
  name                  String
  prefix                String?
  firstName             String?
  middleName            String?
  lastName              String?
  suffix                String?
  address1              String?
  address2              String?
  city                  String?
  stateOrProvince       String?
  zipCode               String?
  country               String?
  activationDate        String    // MM/DD/YYYY
  terminationDate       String?
  recordStatus          String    @default("Active")
  crossReferenceList    String?
  createdAt             DateTime  @default(now())

  @@index([npi])
  @@index([name])
}

// ─────────────────────────────────────────────
// User Role Expansion (D-04b)
// Per-user grants — only for individually elevated Compliance users
// ─────────────────────────────────────────────

model UserGrant {
  id          String    @id @default(cuid())
  clerkUserId String    @unique
  grantedRoles String[] // Array of role strings: ["business", "finance"]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([clerkUserId])
}

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

enum HcpStatus {
  active
  inactive
  suspended
  do_not_engage
}

enum DebarmentStatus {
  not_checked
  clear
  hit
}

enum DeterminationOutcome {
  cleared
  confirmed_exclusion
  false_positive
}
```

After writing schema.prisma, add `DIRECT_URL` to `.env.example`:
```
DIRECT_URL="postgresql://user:password@neon-host/hcp_engage?sslmode=require"
```

(Neon requires `directUrl` for Prisma migrations/push; `DATABASE_URL` is the pooled URL.)

Run schema push — THIS IS A BLOCKING STEP. Do not proceed to seed until push succeeds:
```
npx prisma db push
```

If the push fails due to existing tables: use `npx prisma db push --accept-data-loss`

After successful push, regenerate the Prisma client:
```
npx prisma generate
```

Create `prisma/seed.ts` with dummy OIG LEIE and SAM.gov fixture data for testing:
```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // OIG LEIE dummy records
  await prisma.oigLeieRecord.createMany({
    data: [
      {
        lastName: "SMITH",
        firstName: "JOHN",
        npi: "1234567890",
        exclusionType: "1128a1",
        exclusionDate: "01/15/2020",
        specialty: "Internal Medicine",
        state: "CA",
      },
      {
        lastName: "DOE",
        firstName: "JANE",
        npi: "9876543210",
        exclusionType: "1128b4",
        exclusionDate: "06/01/2019",
        specialty: "Cardiology",
        state: "NY",
      },
    ],
    skipDuplicates: true,
  });

  // SAM.gov dummy records
  await prisma.samGovRecord.createMany({
    data: [
      {
        classificationType: "Individual",
        exclusionType: "Ineligible (Proceedings Pending)",
        exclusionProgram: "Reciprocal",
        agencyName: "Department of Health and Human Services",
        name: "JOHNSON ROBERT",
        firstName: "ROBERT",
        lastName: "JOHNSON",
        npi: "1122334455",
        stateOrProvince: "TX",
        activationDate: "03/10/2021",
        recordStatus: "Active",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seed complete: OIG LEIE and SAM.gov fixtures inserted.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add seed script to `package.json`:
```json
"prisma": {
  "seed": "ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed.ts"
}
```

Also install ts-node for seeding: `npm install -D ts-node`

Run the seed: `npx prisma db seed`
  </action>
  <verify>
    <automated>cd C:/Users/HP/HCP_Engage && npx prisma db execute --stdin <<'SQL'
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
SQL</automated>
  </verify>
  <acceptance_criteria>
    - `prisma/schema.prisma` contains `model Hcp`, `model HcpStatusHistory`, `model DebarmentCheck`, `model DebarmentDetermination`, `model OigLeieRecord`, `model SamGovRecord`, `model UserGrant` (7 models total)
    - `prisma/schema.prisma` contains enum definitions `HcpStatus`, `DebarmentStatus`, `DeterminationOutcome`
    - `prisma/schema.prisma` contains `directUrl = env("DIRECT_URL")` in datasource block
    - `npx prisma db push` exits 0 (all tables created in Neon)
    - `npx prisma generate` exits 0 (Prisma client regenerated)
    - `prisma/seed.ts` exists and contains `OigLeieRecord` and `SamGovRecord` createMany calls
    - `package.json` contains `"prisma": { "seed": "ts-node ...` script
  </acceptance_criteria>
  <done>All 7 Phase 1 tables exist in Neon. Prisma client is generated. OIG LEIE and SAM.gov reference tables seeded with fixture data. Schema push was blocking — no other tasks ran until this completed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement Clerk middleware with role-gated routing and app shell</name>
  <read_first>
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-CONTEXT.md (decisions D-01, D-02, D-03, D-04b, D-05)
    - C:\Users\HP\HCP_Engage\.planning\phases\01-auth-hcp-management\01-UI-SPEC.md (Screen 2: App Shell section, Screen 1: Login Page redirect behavior)
  </read_first>
  <files>
    middleware.ts, lib/auth.ts, app/(app)/layout.tsx, app/(app)/hcps/page.tsx,
    app/(app)/dashboard/page.tsx, components/shell/Sidebar.tsx, components/shell/Header.tsx,
    lib/auth.test.ts
  </files>
  <behavior>
    - Test 1: getEffectiveRoles({ role: "compliance", grants: [] }) returns ["compliance"]
    - Test 2: getEffectiveRoles({ role: "compliance", grants: ["business", "finance"] }) returns ["compliance", "business", "finance"]
    - Test 3: getEffectiveRoles({ role: "business", grants: [] }) returns ["business"]
    - Test 4: canAccessRoute({ effectiveRoles: ["business"], route: "/hcps" }) returns true
    - Test 5: canAccessRoute({ effectiveRoles: ["finance"], route: "/hcps" }) returns false
    - Test 6: canAccessRoute({ effectiveRoles: ["finance"], route: "/dashboard" }) returns true
    - Test 7: canAccessRoute({ effectiveRoles: ["compliance", "business"], route: "/hcps" }) returns true (union)
  </behavior>
  <action>
Create `lib/auth.ts` — the single source of truth for role logic:
```typescript
export type AppRole = "business" | "compliance" | "finance";

export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  "/hcps": ["business", "compliance"],
  "/hcps/new": ["business", "compliance"],
  "/dashboard": ["finance"],
};

export const ROLE_LABELS: Record<AppRole, string> = {
  business: "Business User",
  compliance: "Compliance Officer",
  finance: "Finance User",
};

export const ROLE_DEFAULT_ROUTES: Record<AppRole, string> = {
  business: "/hcps",
  compliance: "/hcps",
  finance: "/dashboard",
};

/**
 * Computes the effective role set for a user.
 * Primary role comes from Clerk publicMetadata.role.
 * UserGrant DB expansion is passed in as grantedRoles (read by Server Component, not middleware).
 */
export function getEffectiveRoles(params: {
  role: string | undefined;
  grants: string[];
}): AppRole[] {
  const { role, grants } = params;
  const primary = role as AppRole | undefined;
  if (!primary) return [];

  const all = new Set<AppRole>([primary]);
  for (const g of grants) {
    if (g === "business" || g === "compliance" || g === "finance") {
      all.add(g as AppRole);
    }
  }
  return Array.from(all);
}

/**
 * Returns true if any of the effectiveRoles can access the given route.
 * Route matching is prefix-based for nested routes (e.g., /hcps/[id] matches /hcps).
 */
export function canAccessRoute(params: {
  effectiveRoles: AppRole[];
  route: string;
}): boolean {
  const { effectiveRoles, route } = params;

  for (const [pattern, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (route === pattern || route.startsWith(pattern + "/")) {
      return effectiveRoles.some((r) => allowedRoles.includes(r));
    }
  }
  // Routes not in the map are accessible to all authenticated users
  return true;
}
```

Create `lib/auth.test.ts` for TDD verification:
```typescript
import { getEffectiveRoles, canAccessRoute } from "./auth";

describe("getEffectiveRoles", () => {
  it("returns primary role only when no grants", () => {
    expect(getEffectiveRoles({ role: "compliance", grants: [] })).toEqual(["compliance"]);
  });

  it("returns union of primary role and granted roles", () => {
    const result = getEffectiveRoles({ role: "compliance", grants: ["business", "finance"] });
    expect(result).toContain("compliance");
    expect(result).toContain("business");
    expect(result).toContain("finance");
    expect(result).toHaveLength(3);
  });

  it("returns business role only when no grants", () => {
    expect(getEffectiveRoles({ role: "business", grants: [] })).toEqual(["business"]);
  });

  it("returns empty array when role is undefined", () => {
    expect(getEffectiveRoles({ role: undefined, grants: [] })).toEqual([]);
  });
});

describe("canAccessRoute", () => {
  it("allows business user to access /hcps", () => {
    expect(canAccessRoute({ effectiveRoles: ["business"], route: "/hcps" })).toBe(true);
  });

  it("denies finance user access to /hcps", () => {
    expect(canAccessRoute({ effectiveRoles: ["finance"], route: "/hcps" })).toBe(false);
  });

  it("allows finance user access to /dashboard", () => {
    expect(canAccessRoute({ effectiveRoles: ["finance"], route: "/dashboard" })).toBe(true);
  });

  it("allows expanded compliance user (with business grant) access to /hcps", () => {
    expect(canAccessRoute({ effectiveRoles: ["compliance", "business"], route: "/hcps" })).toBe(true);
  });

  it("allows nested routes under /hcps for business role", () => {
    expect(canAccessRoute({ effectiveRoles: ["business"], route: "/hcps/abc123" })).toBe(true);
  });
});
```

Install jest and ts-jest:
`npm install -D jest @types/jest ts-jest`

Add to `package.json` scripts:
```json
"test": "jest"
```

Add `jest.config.ts`:
```typescript
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

export default config;
```

Run tests RED first: `npx jest lib/auth.test.ts` — tests will fail because `lib/auth.ts` does not exist yet.
Then write `lib/auth.ts` (above) and run tests GREEN: `npx jest lib/auth.test.ts`

Create `middleware.ts` at project root:
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/auth";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/api/webhooks(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth();
  const pathname = request.nextUrl.pathname;

  // Allow public routes through
  if (isPublicRoute(request)) return NextResponse.next();

  // Redirect unauthenticated users to sign-in
  if (!userId) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Get primary role from Clerk publicMetadata
  const role = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;

  // Note: UserGrant expansion (D-04b) is read in Server Components (DB access),
  // not here in middleware (no DB access at edge). Middleware enforces primary role only.
  // Server Components perform full effective-role check using getEffectiveRoles().
  const primaryRoles = role ? [role as import("@/lib/auth").AppRole] : [];

  // Check route access using primary role only (conservative — expansion checked in components)
  // Finance users trying /hcps → redirect to /dashboard
  // Business users trying /dashboard → redirect to /hcps
  if (!canAccessRoute({ effectiveRoles: primaryRoles, route: pathname })) {
    const role_ = role as string | undefined;
    const fallback = role_ === "finance" ? "/dashboard" : "/hcps";
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
```

Create `app/(app)/layout.tsx` — the authenticated app shell:
```typescript
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles } from "@/lib/auth";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const role = (user.publicMetadata as { role?: string }).role;

  // Load UserGrant expansion (D-04b) from DB
  const userGrant = await prisma.userGrant.findUnique({
    where: { clerkUserId: user.id },
  });
  const grants = userGrant?.grantedRoles ?? [];

  const effectiveRoles = getEffectiveRoles({ role, grants });

  return (
    <div className="flex h-screen bg-[hsl(0_0%_98%)]">
      <Sidebar effectiveRoles={effectiveRoles} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header user={{ fullName: user.fullName ?? "Unknown", imageUrl: user.imageUrl }} />
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
```

Create `components/shell/Sidebar.tsx`:
```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, UserPlus, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/auth";

const NAV_ITEMS = [
  {
    label: "HCP Directory",
    href: "/hcps",
    icon: Users,
    allowedRoles: ["business", "compliance"] as AppRole[],
  },
  {
    label: "Add HCP",
    href: "/hcps/new",
    icon: UserPlus,
    allowedRoles: ["business", "compliance"] as AppRole[],
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["finance"] as AppRole[],
  },
];

export function Sidebar({ effectiveRoles }: { effectiveRoles: AppRole[] }) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.allowedRoles.some((r) => effectiveRoles.includes(r))
  );

  // Primary role label (first in effective roles)
  const primaryRole = effectiveRoles[0];
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : "";

  return (
    <aside className="w-[240px] flex-shrink-0 bg-[hsl(220_13%_18%)] flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[hsl(220_13%_28%)]">
        <span className="text-[20px] font-semibold text-white">HCP Engage</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-[14px] font-normal transition-colors min-h-[44px]",
                isActive
                  ? "bg-[hsl(221_83%_53%)] text-white"
                  : "text-[hsl(220_13%_70%)] hover:bg-[hsl(220_13%_28%)] hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Role label at bottom */}
      <div className="px-6 py-4 border-t border-[hsl(220_13%_28%)]">
        <p className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">{roleLabel}</p>
      </div>
    </aside>
  );
}
```

Create `components/shell/Header.tsx`:
```typescript
import { UserButton } from "@clerk/nextjs";

export function Header({
  user,
}: {
  user: { fullName: string; imageUrl: string };
}) {
  return (
    <header className="h-[56px] bg-white border-b border-[hsl(220_13%_91%)] flex items-center justify-between px-8 flex-shrink-0">
      <div /> {/* Page title injected by child pages via <title> or context in Phase 2+ */}
      <div className="flex items-center gap-3">
        <span className="text-[14px] text-[hsl(220_13%_18%)]">{user.fullName}</span>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
```

Create placeholder pages:
- `app/(app)/hcps/page.tsx` — simple placeholder with heading "HCP Directory" (full implementation in Plan 02)
- `app/(app)/dashboard/page.tsx` — Finance placeholder with heading "Dashboard" and body "Engagement approvals will appear here."

Confirm `npm run build` exits 0.
  </action>
  <verify>
    <automated>cd C:/Users/HP/HCP_Engage && npx jest lib/auth.test.ts --passWithNoTests 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `lib/auth.test.ts` exists and all 9 tests pass: `npx jest lib/auth.test.ts` output shows "9 passed"
    - `middleware.ts` contains `clerkMiddleware` imported from `"@clerk/nextjs/server"`
    - `middleware.ts` contains `isPublicRoute` matcher covering `/sign-in(.*)`
    - `middleware.ts` contains redirect logic: unauthenticated → `/sign-in`, wrong-role → role default route
    - `components/shell/Sidebar.tsx` contains `NAV_ITEMS` array with allowedRoles per item
    - `components/shell/Sidebar.tsx` renders nav items filtered by `effectiveRoles` (no disabled/greyed items — completely absent per UI-SPEC)
    - `app/(app)/layout.tsx` calls `prisma.userGrant.findUnique` and `getEffectiveRoles`
    - `npm run build` exits 0 — no TypeScript compile errors
  </acceptance_criteria>
  <done>Clerk middleware protects all routes. Role-gated navigation renders correct items per effective role (union of Clerk role + UserGrant grants). Business and Compliance users see HCP nav; Finance users see only Dashboard. All auth.ts unit tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → Next.js middleware | Unauthenticated HTTP requests arrive here; session cookie validated by Clerk |
| Next.js Server Component → Prisma/Neon | Server-side DB queries; connection string in env var |
| Clerk session → publicMetadata.role | Role claim from Clerk JWT; must not be user-mutable |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Spoofing | Clerk session | mitigate | Clerk-managed session cookies (HttpOnly, Secure, SameSite=Lax); `clerkMiddleware()` validates on every request |
| T-01-02 | Tampering | `publicMetadata.role` (Clerk) | mitigate | Role is in `publicMetadata` (server-writable only — users cannot update this field via Clerk frontend API); only Clerk Dashboard or Backend API can set it |
| T-01-03 | Elevation of Privilege | UserGrant DB record | mitigate | UserGrant is DB-resident and read server-side only; no client API to self-grant roles; Compliance role required to be granted expansion |
| T-01-04 | Information Disclosure | Prisma/Neon connection string | mitigate | `DATABASE_URL` in env var, never committed; `.gitignore` covers `.env.local`; `.env.example` contains only placeholders |
| T-01-05 | Denial of Service | Clerk middleware on every request | accept | Clerk handles rate limiting on auth endpoints; middleware runs at edge with negligible overhead |
| T-01-06 | Elevation of Privilege | Finance user navigating to `/hcps` manually | mitigate | middleware.ts redirects to `/dashboard` for any request where `canAccessRoute` returns false for the user's primary role |
</threat_model>

<verification>
After completing all three tasks:

1. `npm run build` exits 0
2. `npx jest` shows all auth.ts tests passing
3. `npx prisma db push` was run and confirmed successful (tables exist in Neon)
4. Start dev server: `npm run dev`
5. Visit `http://localhost:3000/hcps` while unauthenticated — must redirect to `/sign-in`
6. Sign in with a Clerk test user whose `publicMetadata.role = "business"` — sidebar shows "HCP Directory" and "Add HCP", no Dashboard item
7. Sign in with a Clerk test user whose `publicMetadata.role = "finance"` — sidebar shows only "Dashboard"
8. Manually visit `http://localhost:3000/hcps` as Finance user — middleware redirects to `/dashboard`
</verification>

<success_criteria>
- Next.js 15 project scaffolded with TypeScript strict, Tailwind CSS v4, shadcn/ui (neutral style)
- Clerk authentication wired with email+password; no social login, no sign-up link
- All 7 Phase 1 Prisma tables pushed to Neon PostgreSQL
- Role-gated middleware redirects unauthenticated users and wrong-role users correctly
- App shell renders role-appropriate navigation (Business/Compliance: HCP items; Finance: Dashboard only)
- UserGrant expansion (D-04b) read from DB and applied in Server Components
- `npm run build` exits 0
- AUTH-01: Role-based access enforced at middleware layer for all routes
</success_criteria>

<output>
After completion, create `.planning/phases/01-auth-hcp-management/01-01-SUMMARY.md` using the template at `@C:/Users/HP/HCP_Engage/.claude/get-shit-done/templates/summary.md`.
</output>
