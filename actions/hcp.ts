"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { NppesHcp } from "@/lib/nppes";
import type { Hcp, Prisma } from "@prisma/client";

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

  const where: Prisma.HcpWhereInput = {};

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
    return {
      success: false,
      error: "Forbidden: only Compliance users can set HCP status",
    };
  }

  // Server-side reason length check (T-04-02)
  if (params.reason.trim().length < 10) {
    return { success: false, error: "Reason must be at least 10 characters." };
  }

  // Verify HCP exists and fetch current status (T-04-03)
  const hcp = await prisma.hcp.findUnique({
    where: { id: params.hcpId },
    select: { id: true, status: true },
  });
  if (!hcp) return { success: false, error: "HCP not found" };

  // Prevent setting same status (also guarded client-side)
  if (hcp.status === params.status) {
    return {
      success: false,
      error: `HCP is already ${params.status.replace(/_/g, " ")}`,
    };
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
    return {
      success: false,
      error: "Status could not be saved. Refresh the page and try again.",
    };
  }
}
