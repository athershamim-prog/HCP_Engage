/**
 * Tests for lib/invoice-calc.ts
 * Requirements: CONT-02
 * Wave 0 — these tests FAIL until lib/invoice-calc.ts is created in Wave 2.
 */

import { calculateInvoiceTotal } from "@/lib/invoice-calc";

const BASE = { agreedRateUsd: 350, rateUnit: "per_hour" as const, noOfActivities: 2 };

describe("calculateInvoiceTotal", () => {
  it("per_hour: multiplies agreedRateUsd by noOfActivities", () => {
    expect(calculateInvoiceTotal(BASE).totalUsd).toBe(700);
  });
  it("per_day: multiplies agreedRateUsd by noOfActivities", () => {
    expect(calculateInvoiceTotal({ ...BASE, rateUnit: "per_day" as const }).totalUsd).toBe(700);
  });
  it("flat_fee: total equals agreedRateUsd regardless of noOfActivities", () => {
    expect(calculateInvoiceTotal({ ...BASE, rateUnit: "flat_fee" as const }).totalUsd).toBe(350);
  });
  it("per_event: total equals agreedRateUsd regardless of noOfActivities", () => {
    expect(calculateInvoiceTotal({ ...BASE, rateUnit: "per_event" as const }).totalUsd).toBe(350);
  });
  it("per_hour with null noOfActivities: defaults to 1 (total = rate)", () => {
    expect(calculateInvoiceTotal({ ...BASE, noOfActivities: null }).totalUsd).toBe(350);
  });
  it("noOfActivitiesApplied is 1 for flat_fee", () => {
    expect(calculateInvoiceTotal({ ...BASE, rateUnit: "flat_fee" as const }).noOfActivitiesApplied).toBe(1);
  });
  it("noOfActivitiesApplied equals noOfActivities for per_hour", () => {
    expect(calculateInvoiceTotal(BASE).noOfActivitiesApplied).toBe(2);
  });
});
