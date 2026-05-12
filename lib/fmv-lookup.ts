// lib/fmv-lookup.ts
// Pure async utility — no "use server"; injectable Prisma client for testability
// Pattern: lib/nppes.ts (thin function wrapping a DB query with typed return)
import type { PrismaClient, EngagementType, RateUnit } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export interface FmvRateResult {
  id: string;
  rateCardId: string;
  nuccCode: string;
  nuccDisplayName: string;
  state: string | null;
  engagementType: EngagementType;
  rateUsd: Prisma.Decimal;
  rateUnit: RateUnit;
}

export async function getFmvRate(params: {
  nuccCode: string;
  state: string;
  engagementType: string;
  prisma: PrismaClient;
}): Promise<FmvRateResult | null> {
  const { nuccCode, state, engagementType, prisma } = params;

  // Get the active rate card
  const activeCard = await prisma.fmvRateCard.findFirst({
    where: { status: "active" },
    select: { id: true },
  });
  if (!activeCard) return null;

  // Step 1: Try exact state-level match (D-01: most specific wins)
  const stateRate = await prisma.fmvRate.findFirst({
    where: {
      rateCardId: activeCard.id,
      nuccCode,
      engagementType: engagementType as EngagementType,
      state,
    },
  });
  if (stateRate) return stateRate as FmvRateResult;

  // Step 2: National fallback (state = null in DB)
  const nationalRate = await prisma.fmvRate.findFirst({
    where: {
      rateCardId: activeCard.id,
      nuccCode,
      engagementType: engagementType as EngagementType,
      state: null,
    },
  });
  return nationalRate as FmvRateResult | null;
}
