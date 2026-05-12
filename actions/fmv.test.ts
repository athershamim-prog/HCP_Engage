/**
 * Tests for actions/fmv.ts
 * Requirements: FMV-01, FMV-02, FMV-03
 */

import type { PrismaClient } from "@prisma/client";

// Mock dependencies before importing the action
jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    fmvRateCard: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    fmvRate: { createMany: jest.fn() },
    nuccTaxonomy: { findMany: jest.fn() },
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  currentUser: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { activateRateCardAction, parseRateCardAction } from "@/actions/fmv";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCurrentUser = currentUser as jest.MockedFunction<typeof currentUser>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

// Helper: build a mock Clerk user
function makeUser(role: string) {
  return {
    id: "user_test123",
    fullName: "Test Compliance User",
    publicMetadata: { role },
  } as ReturnType<typeof Object.assign>;
}

describe("activateRateCard (FMV-03)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets the target rate card status from 'pending' to 'active' and sets effectiveFrom to current time", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

    // Mock $transaction to call the callback with a mock tx
    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          fmvRateCard: {
            updateMany: jest.fn()
              .mockResolvedValueOnce({ count: 0 }) // close active (none to close)
              .mockResolvedValueOnce({ count: 1 }), // activate pending
          },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await activateRateCardAction("card_123");
    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/fmv");
  });

  it("sets the previously active rate card status to 'superseded' and sets effectiveTo to current time", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

    let capturedTx: { fmvRateCard: { updateMany: jest.Mock } } | null = null;

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          fmvRateCard: {
            updateMany: jest.fn()
              .mockResolvedValueOnce({ count: 1 }) // close the active card
              .mockResolvedValueOnce({ count: 1 }), // activate new
          },
        } as unknown as PrismaClient;
        capturedTx = mockTx as typeof capturedTx;
        return cb(mockTx);
      }
    );

    await activateRateCardAction("card_new");

    expect(capturedTx).not.toBeNull();
    const calls = (capturedTx!.fmvRateCard.updateMany as jest.Mock).mock.calls;
    // First call: supersede the active card
    expect(calls[0][0].where).toEqual({ status: "active" });
    expect(calls[0][0].data.status).toBe("superseded");
    expect(calls[0][0].data.effectiveTo).toBeInstanceOf(Date);
    // Second call: activate the pending card
    expect(calls[1][0].where).toMatchObject({ id: "card_new", status: "pending" });
    expect(calls[1][0].data.status).toBe("active");
    expect(calls[1][0].data.effectiveFrom).toBeInstanceOf(Date);
  });

  it("performs the close-prior + activate-new as a single atomic Prisma $transaction (race-safe)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          fmvRateCard: {
            updateMany: jest.fn()
              .mockResolvedValueOnce({ count: 0 })
              .mockResolvedValueOnce({ count: 1 }),
          },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    await activateRateCardAction("card_123");
    // $transaction was called exactly once — both operations inside it
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("throws an error when the target rate card is not in 'pending' state (updateMany returns count=0)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          fmvRateCard: {
            updateMany: jest.fn()
              .mockResolvedValueOnce({ count: 0 }) // close active
              .mockResolvedValueOnce({ count: 0 }), // activate pending → count=0 → should error
          },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await activateRateCardAction("card_not_pending");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("does not fail when there is no prior active card (first activation)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          fmvRateCard: {
            updateMany: jest.fn()
              .mockResolvedValueOnce({ count: 0 }) // no active card to supersede
              .mockResolvedValueOnce({ count: 1 }), // activates the pending card
          },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await activateRateCardAction("card_first");
    expect(result).toEqual({ success: true });
  });
});

describe("parseRateCardAction (FMV-01, FMV-02)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error when no file is provided in FormData", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    const formData = new FormData();

    const result = await parseRateCardAction(formData);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/No file/i);
  });

  it("returns error when called by a non-compliance user (Forbidden)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    const formData = new FormData();
    formData.append("file", new Blob(["test"]), "test.xlsx");

    const result = await parseRateCardAction(formData);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/Forbidden/i);
  });

  it("returns error when user is not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);
    const formData = new FormData();

    const result = await parseRateCardAction(formData);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/Unauthorized/i);
  });
});
