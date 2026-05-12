import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles } from "@/lib/auth";
import { EngagementTable } from "@/components/engagement/EngagementTable";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EngagementStatus, EngagementType, Prisma } from "@prisma/client";

export const metadata = { title: "Engagements — HCP Engage" };

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all",       label: "All Statuses" },
  { value: "draft",     label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved",  label: "Approved" },
  { value: "rejected",  label: "Rejected" },
  { value: "completed", label: "Completed" },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all",                   label: "All Types" },
  { value: "advisory_board",        label: "Advisory Board" },
  { value: "speaker_program",       label: "Speaker Program" },
  { value: "investigator_research", label: "Investigator / Research" },
  { value: "meal_tov",              label: "Meal / TOV" },
  { value: "training",              label: "Training" },
];

export default async function EngagementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;
  const query = params.q ?? "";
  const statusFilter = params.status ?? "all";
  const typeFilter = params.type ?? "all";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = 25;

  // Get user info for role-based filtering
  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });

  const isBusinessOnly = roles.length === 1 && roles[0] === "business";
  const canCreate = roles.some((r) => r === "business" || r === "compliance");

  // Build Prisma where clause
  const where: Prisma.EngagementWhereInput = {};

  // T-02-04-03: Business users only see their own engagements (server-side filter)
  if (isBusinessOnly) {
    where.submittedByClerkId = userId;
  }

  if (query.trim()) {
    where.hcp = { fullName: { contains: query.trim(), mode: "insensitive" } };
  }

  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter as EngagementStatus;
  }

  if (typeFilter && typeFilter !== "all") {
    where.engagementType = typeFilter as EngagementType;
  }

  const [engagements, total] = await Promise.all([
    prisma.engagement.findMany({
      where,
      include: {
        hcp: { select: { fullName: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.engagement.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const isFiltered = !!(query || (statusFilter && statusFilter !== "all") || (typeFilter && typeFilter !== "all"));

  // Serialize Decimal to number for client component
  const serializedEngagements = engagements.map((e) => ({
    ...e,
    compensationUsd: parseFloat(e.compensationUsd.toString()),
  }));

  const buildUrl = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (statusFilter && statusFilter !== "all") p.set("status", statusFilter);
    if (typeFilter && typeFilter !== "all") p.set("type", typeFilter);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const str = p.toString();
    return `/engagements${str ? `?${str}` : ""}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)]">Engagements</h1>
        {canCreate && (
          <Link
            href="/engagements/new"
            className="inline-flex items-center gap-2 justify-center rounded-lg bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11 px-4 text-sm font-medium text-white transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Engagement
          </Link>
        )}
      </div>

      {/* Filter bar — URL-param driven server-side filtering */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search by HCP name..."
          className="w-[320px] h-11"
          aria-label="Search engagements by HCP name"
        />
        <Select name="status" defaultValue={statusFilter}>
          <SelectTrigger className="h-11 w-[180px]" aria-label="Filter by status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="type" defaultValue={typeFilter}>
          <SelectTrigger className="h-11 w-[200px]" aria-label="Filter by engagement type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFiltered && (
          <Link
            href="/engagements"
            className="inline-flex items-center justify-center rounded-lg h-11 px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            Clear Filters
          </Link>
        )}
      </form>

      {/* Engagement table */}
      <EngagementTable
        engagements={serializedEngagements as Parameters<typeof EngagementTable>[0]["engagements"]}
        isFiltered={isFiltered}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildUrl({ page: String(p) })}
              className={`inline-flex items-center justify-center rounded-lg h-9 w-9 text-sm font-medium transition-colors ${
                p === page
                  ? "bg-[hsl(221_83%_53%)] text-white"
                  : "border border-border bg-background hover:bg-muted"
              }`}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
