import { prisma } from "@/lib/prisma";
import { calculateInvoiceTotal } from "@/lib/invoice-calc";
import type { Prisma, EngagementType } from "@prisma/client";

export interface InvoiceCalcResult {
  agreedRateUsd: number;
  noOfActivities: number | null;
  totalUsd: number;
  rateUnit: string;
}

type EngagementForInvoice = {
  id: string;
  engagementType: EngagementType;
  agreedRateUsd: Prisma.Decimal;
  noOfActivities: number | null;
  hcp: {
    nuccCode: string | null;
  };
};

// Looks up FMV rate and calculates invoice totals. No I/O other than DB.
// PDF rendering happens on-demand in the /invoice/pdf route handler.
export async function calculateInvoiceData(
  engagement: EngagementForInvoice
): Promise<InvoiceCalcResult> {
  const fmvRate = await prisma.fmvRate.findFirst({
    where: {
      rateCard: { status: "active" },
      nuccCode: engagement.hcp.nuccCode ?? undefined,
      engagementType: engagement.engagementType,
    },
    orderBy: { rateCard: { effectiveFrom: "desc" } },
  });

  const rateUnit = fmvRate?.rateUnit ?? "per_hour";
  const agreedRateNum = parseFloat(engagement.agreedRateUsd.toString());
  const { totalUsd, noOfActivitiesApplied } = calculateInvoiceTotal({
    agreedRateUsd: agreedRateNum,
    rateUnit: rateUnit as "per_hour" | "per_day" | "flat_fee" | "per_event",
    noOfActivities: engagement.noOfActivities ?? null,
  });

  return {
    agreedRateUsd: agreedRateNum,
    noOfActivities:
      noOfActivitiesApplied === 1 && !engagement.noOfActivities
        ? null
        : noOfActivitiesApplied,
    totalUsd,
    rateUnit,
  };
}
