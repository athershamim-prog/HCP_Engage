/**
 * Wave 0 test stubs for lib/fmv-lookup.ts
 * RED state: fmv-lookup.ts does not exist yet — implemented in Plan 02 (fmv-rate-detail wave)
 * Requirements: FMV-04
 */

describe("getFmvRate", () => {
  it.todo("returns the state-level FmvRate when both state-level and national rates exist for the same specialty + type");
  it.todo("returns the national FmvRate (state: null) when no state-level match exists");
  it.todo("returns null when no FmvRateCard has status=active");
  it.todo("returns null when no FmvRate matches the given nuccCode + engagementType combination");
  it.todo("queries state-level first (two sequential lookups, not a single findMany)");
});
