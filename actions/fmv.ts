"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles, assertRole } from "@/lib/auth";
import { parseRateCardBuffer, validateNuccCodes } from "@/lib/fmv-parser";
import type { EngagementType, RateUnit } from "@prisma/client";

export interface ParsedCardResult {
  rows: Array<{
    specialty_code: string;
    state: string | null;
    engagement_type: string;
    rate_usd: number;
    rate_unit: string;
    rowIndex: number;
    nuccValid: boolean;
    nuccDisplayName: string | null;
  }>;
  hasErrors: boolean;
  pendingCardId: string;
  rowCount: number;
}

/**
 * Server Action: parse an uploaded rate card file, validate NUCC codes,
 * persist a pending FmvRateCard with all FmvRate rows.
 * Returns the validated rows with per-row NUCC status for preview.
 * Compliance role only.
 */
export async function parseRateCardAction(
  formData: FormData
): Promise<ParsedCardResult | { error: string }> {
  const user = await currentUser();
  if (!user) return { error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["compliance"]);
  } catch {
    return { error: "Forbidden: only Compliance users can upload rate cards" };
  }

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = parseRateCardBuffer(buffer);

    // Build NUCC taxonomy map for validation
    const codes = [...new Set(parsed.map((r) => r.specialty_code))];
    const taxonomyRows = await prisma.nuccTaxonomy.findMany({
      where: { code: { in: codes } },
      select: { code: true, displayName: true },
    });
    const taxonomyMap = new Map(taxonomyRows.map((t) => [t.code, t.displayName]));
    const validated = validateNuccCodes(parsed, taxonomyMap);
    const hasErrors = validated.some((r) => !r.nuccValid);

    // Get next version number
    const lastCard = await prisma.fmvRateCard.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (lastCard?.version ?? 0) + 1;

    // Create pending rate card with all rows
    const card = await prisma.fmvRateCard.create({
      data: {
        version: nextVersion,
        uploadedByClerkId: user.id,
        uploadedByName: user.fullName ?? "Unknown",
        rowCount: validated.length,
        rates: {
          create: validated.map((r) => ({
            nuccCode: r.specialty_code,
            nuccDisplayName: r.nuccDisplayName ?? r.specialty_code,
            state: r.state,
            engagementType: r.engagement_type as EngagementType,
            rateUsd: r.rate_usd,
            rateUnit: r.rate_unit as RateUnit,
          })),
        },
      },
    });

    return {
      rows: validated,
      hasErrors,
      pendingCardId: card.id,
      rowCount: validated.length,
    };
  } catch (error) {
    console.error("parseRateCardAction failed:", error);
    return { error: "Could not parse this file. Verify the format and try again." };
  }
}

/**
 * Server Action: activate a pending rate card.
 * Atomic $transaction: supersedes any currently active card (sets effectiveTo),
 * then activates the target card (sets effectiveFrom, status=active).
 * Returns { success: false } if card not found or not in pending state.
 * Compliance role only.
 */
export async function activateRateCardAction(
  rateCardId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["compliance"]);
  } catch {
    return { success: false, error: "Forbidden: only Compliance users can activate rate cards" };
  }

  try {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Close any currently active card (there can be at most one)
      await tx.fmvRateCard.updateMany({
        where: { status: "active" },
        data: { status: "superseded", effectiveTo: now },
      });

      // Activate the target pending card
      const updated = await tx.fmvRateCard.updateMany({
        where: { id: rateCardId, status: "pending" },
        data: { status: "active", effectiveFrom: now },
      });

      if (updated.count === 0) {
        throw new Error("Rate card not found or not in pending state");
      }
    });

    revalidatePath("/fmv");
    return { success: true };
  } catch (error) {
    console.error("activateRateCardAction failed:", error);
    return { success: false, error: "Activation failed. Try again or contact your administrator." };
  }
}
