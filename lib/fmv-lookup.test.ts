/**
 * Tests for lib/fmv-lookup.ts
 * RED state: verify state-first / national-fallback lookup logic
 * Requirements: FMV-04
 */

import { getFmvRate } from "@/lib/fmv-lookup";
import { PrismaClient } from "@prisma/client";

// Mock PrismaClient
const mockPrisma = {
  fmvRateCard: {
    findFirst: jest.fn(),
  },
  fmvRate: {
    findFirst: jest.fn(),
  },
} as unknown as PrismaClient;

describe("getFmvRate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when no FmvRateCard has status=active", async () => {
    (mockPrisma.fmvRateCard.findFirst as jest.Mock).mockResolvedValue(null);
    const result = await getFmvRate({
      nuccCode: "207Q00000X",
      state: "CA",
      engagementType: "advisory_board",
      prisma: mockPrisma,
    });
    expect(result).toBeNull();
  });

  it("returns the state-level FmvRate when both state-level and national rates exist for the same specialty + type", async () => {
    (mockPrisma.fmvRateCard.findFirst as jest.Mock).mockResolvedValue({ id: "card-1" });
    const stateRate = { id: "rate-1", state: "CA", rateUsd: 350 };
    (mockPrisma.fmvRate.findFirst as jest.Mock).mockResolvedValueOnce(stateRate);
    const result = await getFmvRate({
      nuccCode: "207Q00000X",
      state: "CA",
      engagementType: "advisory_board",
      prisma: mockPrisma,
    });
    expect(result).toEqual(stateRate);
    // Second findFirst (national fallback) should NOT have been called
    expect(mockPrisma.fmvRate.findFirst).toHaveBeenCalledTimes(1);
  });

  it("returns the national FmvRate (state: null) when no state-level match exists", async () => {
    (mockPrisma.fmvRateCard.findFirst as jest.Mock).mockResolvedValue({ id: "card-1" });
    const nationalRate = { id: "rate-2", state: null, rateUsd: 300 };
    (mockPrisma.fmvRate.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // state lookup returns null
      .mockResolvedValueOnce(nationalRate); // national fallback returns rate
    const result = await getFmvRate({
      nuccCode: "207Q00000X",
      state: "CA",
      engagementType: "advisory_board",
      prisma: mockPrisma,
    });
    expect(result).toEqual(nationalRate);
    expect(mockPrisma.fmvRate.findFirst).toHaveBeenCalledTimes(2);
  });

  it("returns null when no FmvRate matches the given nuccCode + engagementType combination", async () => {
    (mockPrisma.fmvRateCard.findFirst as jest.Mock).mockResolvedValue({ id: "card-1" });
    (mockPrisma.fmvRate.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const result = await getFmvRate({
      nuccCode: "UNKNOWN",
      state: "CA",
      engagementType: "advisory_board",
      prisma: mockPrisma,
    });
    expect(result).toBeNull();
  });

  it("queries state-level first (two sequential lookups, not a single findMany)", async () => {
    (mockPrisma.fmvRateCard.findFirst as jest.Mock).mockResolvedValue({ id: "card-1" });
    (mockPrisma.fmvRate.findFirst as jest.Mock).mockResolvedValue(null);
    await getFmvRate({
      nuccCode: "207Q00000X",
      state: "TX",
      engagementType: "training",
      prisma: mockPrisma,
    });
    // First call must have state="TX", second call must have state=null
    const calls = (mockPrisma.fmvRate.findFirst as jest.Mock).mock.calls;
    expect(calls[0][0].where.state).toBe("TX");
    expect(calls[1][0].where.state).toBeNull();
  });
});
