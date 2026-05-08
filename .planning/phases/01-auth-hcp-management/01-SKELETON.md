# Walking Skeleton — Phase 1: Auth + HCP Management

**Project:** HCP Engage
**Phase:** 1
**Created:** 2026-05-07
**Status:** Defined — implement via 01-PLAN-skeleton.md

---

## What the Skeleton Proves

A new developer (or fresh Claude instance) can clone the repo, set four environment variables, run `npx prisma db push`, and reach a working login screen. After logging in, they see a role-gated app shell. The database exists and accepts writes. Clerk issues sessions. Every layer — browser, Next.js, Prisma, PostgreSQL (Neon) — is connected and proven with one real round-trip.

---

## Architectural Decisions (Locked for All Future Phases)

These decisions are made here and must NOT be renegotiated in later phases.

| Dimension | Decision | Rationale |
|-----------|----------|-----------|
| Framework | Next.js 15 App Router (TypeScript strict) | CLAUDE.md constraint; RSC + Server Actions align with Clerk SDK and Prisma |
| UI system | Tailwind CSS v4 + shadcn/ui (neutral style, `npx shadcn@latest init`) | CLAUDE.md constraint; enterprise compliance aesthetic |
| Database | PostgreSQL 16 on Neon, accessed via Prisma v5 ORM | CLAUDE.md constraint; Neon serverless driver used for edge compatibility |
| Auth | Clerk (email+password only; invited users only; no social login) | D-06, D-07; Clerk handles session + RBAC |
| Role storage | Clerk `publicMetadata.role` field (string: `"business"` / `"compliance"` / `"finance"`) | Cleanest App Router middleware integration; Clerk dashboard manages provisioning |
| Role expansion | Per-user `UserGrant` DB table; middleware reads Clerk role + DB grants and computes effective permissions union | D-04b; not all Compliance users have expanded access |
| Routing | `/sign-in` (Clerk embedded), `/hcps` (Business + Compliance), `/hcps/new`, `/hcps/[id]`, `/dashboard` (Finance placeholder) | UI-SPEC.md Screen Inventory |
| Middleware | `middleware.ts` at project root; `clerkMiddleware()` + custom role gate; computes effective role set per request | RBAC enforced at the edge before any page or API handler runs |
| API style | Next.js Route Handlers under `app/api/` for external calls (NPPES); Server Actions for DB mutations | RSC pattern; no REST layer needed for internal mutations |
| Background jobs | Not used in Phase 1 | BullMQ/Redis deferred to Phase 2+ |
| File storage | Not used in Phase 1 | S3/R2 deferred to Phase 3 |
| Deployment target | Railway (initial) | CLAUDE.md constraint; Railway Nixpacks detects Next.js automatically |
| Environment secrets | `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET` | All others are phase-local |

---

## Directory Layout

Established by Plan 01 (skeleton). All future phases extend without restructuring.

```
hcp-engage/
├── app/
│   ├── (auth)/
│   │   └── sign-in/
│   │       └── [[...sign-in]]/
│   │           └── page.tsx          # Clerk <SignIn /> embedded
│   ├── (app)/
│   │   ├── layout.tsx                # App shell (sidebar + header)
│   │   ├── hcps/
│   │   │   ├── page.tsx              # HCP Directory
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # NPI Lookup / Add HCP
│   │   │   └── [id]/
│   │   │       └── page.tsx          # HCP Profile
│   │   └── dashboard/
│   │       └── page.tsx              # Finance placeholder
│   ├── api/
│   │   └── nppes/
│   │       └── route.ts              # NPPES proxy (GET ?npi=)
│   └── layout.tsx                    # Root layout (ClerkProvider)
├── components/
│   ├── ui/                           # shadcn generated components
│   ├── shell/
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── hcp/
│   │   ├── HcpTable.tsx
│   │   ├── HcpStatusBadge.tsx
│   │   ├── DebarmentBadge.tsx
│   │   ├── NpiLookupForm.tsx
│   │   ├── DebarmentCheckPanel.tsx
│   │   └── StatusHistoryTimeline.tsx
│   └── shared/
│       └── EmptyState.tsx
├── lib/
│   ├── auth.ts                       # getEffectiveRoles(), assertRole()
│   ├── nppes.ts                      # fetchNppesHcp()
│   ├── debarment.ts                  # runDebarmentCheck()
│   └── prisma.ts                     # Prisma singleton
├── actions/
│   ├── hcp.ts                        # addHcp(), setHcpStatus()
│   └── debarment.ts                  # runCheck(), saveDetermination()
├── middleware.ts                     # clerkMiddleware + role gate
├── prisma/
│   └── schema.prisma                 # Full Phase 1 schema
├── .env.local                        # Local secrets (gitignored)
├── .env.example                      # Template committed to repo
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Prisma Schema Summary

All tables created in Plan 01 and pushed to Neon in the same plan (BLOCKING schema push task).

| Table | Purpose |
|-------|---------|
| `Hcp` | Local HCP record; NPPES data cached at creation |
| `HcpStatusHistory` | Immutable log of status changes (one row per change) |
| `DebarmentCheck` | One row per debarment check run; results snapshot |
| `DebarmentDetermination` | Compliance officer determination per check |
| `OigLeieRecord` | Pre-seeded OIG LEIE exclusion reference data |
| `SamGovRecord` | Pre-seeded SAM.gov exclusion reference data |
| `UserGrant` | Per-user role expansion flags (D-04b) |

No `tenant_id` column in v1. Schema is otherwise clean and extensible for v2 multi-tenancy.

---

## Proof of Life Test

After running Plan 01, ALL of the following must be true:

1. `npm run build` exits 0 — no TypeScript errors
2. `npx prisma db push` succeeds against Neon — all 7 tables exist
3. `curl http://localhost:3000/sign-in` returns 200 — login page renders
4. Visiting `/hcps` while unauthenticated redirects to `/sign-in` — middleware works
5. After signing in with a Business user: `/hcps` loads, sidebar shows "HCP Directory" and "Add HCP"
6. After signing in with a Finance user: `/hcps` redirects to `/dashboard` — RBAC enforced

---

## Future Phase Extensions (Pre-Decided)

| Phase | Extension |
|-------|-----------|
| Phase 2 | Add `FmvRateCard`, `FmvRate`, `Engagement` tables to schema; extend middleware for engagement routes |
| Phase 3 | Add `ContractTemplate`, `Contract` tables; integrate S3/R2 storage |
| v2 | Add `tenant_id` to all tables + RLS; promote UserGrant to tenant-scoped |
