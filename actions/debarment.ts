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
    return {
      success: false,
      error: "Forbidden: only Compliance users can run debarment checks",
    };
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
    return {
      success: false,
      error:
        "Debarment check failed. Try again or contact your system administrator.",
    };
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
