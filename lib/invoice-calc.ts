/**
 * Pure calculation helpers for invoice generation.
 * No "use server" — exported as standalone module for testability.
 * Pattern: lib/engagement-validation.ts
 */

export type RateUnit = "per_hour" | "per_day" | "flat_fee" | "per_event";

export interface InvoiceCalcParams {
  agreedRateUsd: number;
  rateUnit: RateUnit;
  noOfActivities: number | null;
}

export interface InvoiceCalcResult {
  totalUsd: number;
  noOfActivitiesApplied: number; // 1 for flat_fee/per_event; actual value for per_hour/per_day
}

/**
 * Calculate invoice total based on rate unit and number of activities.
 * D-06: per_hour/per_day → total = agreedRateUsd × noOfActivities
 *       flat_fee/per_event → total = agreedRateUsd (activities treated as 1)
 */
export function calculateInvoiceTotal(params: InvoiceCalcParams): InvoiceCalcResult {
  const { agreedRateUsd, rateUnit, noOfActivities } = params;
  if (rateUnit === "per_hour" || rateUnit === "per_day") {
    const activities = noOfActivities ?? 1;
    return {
      totalUsd: agreedRateUsd * activities,
      noOfActivitiesApplied: activities,
    };
  }
  // flat_fee and per_event: total = agreedRateUsd regardless of activities
  return {
    totalUsd: agreedRateUsd,
    noOfActivitiesApplied: 1,
  };
}
