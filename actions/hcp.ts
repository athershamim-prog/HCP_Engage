"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
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
