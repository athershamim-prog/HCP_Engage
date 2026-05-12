/**
 * Tests for actions/engagement.ts
 * Requirements: ENG-01, ENG-02, ENG-03
 */

import type { PrismaClient } from "@prisma/client";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    engagement: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    engagementStatusHistory: { create: jest.fn() },
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  currentUser: jest.fn(),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { createEngagementAction, submitEngagementAction } from "@/actions/engagement";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCurrentUser = currentUser as jest.MockedFunction<typeof currentUser>;

function makeUser(role: string) {
  return {
    id: "user_test123",
    fullName: "Test Business User",
    publicMetadata: { role },
  } as ReturnType<typeof Object.assign>;
}

const VALID_PARAMS = {
  hcpId: "hcp-abc",
  engagementType: "advisory_board",
  proposedDate: "2026-06-01",
  compensationUsd: 350,
  description: "A twenty-character minimum description for the engagement scope",
};

describe("createEngagementAction (ENG-01)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns success=true with id when called by a business user with valid params", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: {
            create: jest.fn().mockResolvedValue({ id: "eng-new-123" }),
          },
          engagementStatusHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await createEngagementAction(VALID_PARAMS);
    expect(result.success).toBe(true);
    expect((result as { id: string }).id).toBe("eng-new-123");
  });

  it("returns error when user is not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);

    const result = await createEngagementAction(VALID_PARAMS);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it("returns error when called by a finance user (role guard)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("finance") as never);

    const result = await createEngagementAction(VALID_PARAMS);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it("returns error when hcpId is missing (validation guard)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    const result = await createEngagementAction({ ...VALID_PARAMS, hcpId: "" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Select an HCP before saving.");
  });

  it("returns error when description is too short (validation guard)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    const result = await createEngagementAction({ ...VALID_PARAMS, description: "Too short" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Description must be at least 20 characters.");
  });
});

describe("submitEngagementAction (ENG-02)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("transitions engagement from draft to submitted when called by the submitter", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          engagementStatusHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await submitEngagementAction("eng-123");
    expect(result.success).toBe(true);
  });

  it("returns error when engagement is not in draft state (updateMany returns count=0)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          engagementStatusHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await submitEngagementAction("eng-not-draft");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("creates an EngagementStatusHistory record with actorClerkId and actorName", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    let capturedTx: { engagement: { updateMany: jest.Mock }; engagementStatusHistory: { create: jest.Mock } } | null = null;

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          engagementStatusHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        } as unknown as PrismaClient;
        capturedTx = mockTx as typeof capturedTx;
        return cb(mockTx);
      }
    );

    await submitEngagementAction("eng-123");
    expect(capturedTx).not.toBeNull();
    const historyCreate = capturedTx!.engagementStatusHistory.create;
    expect(historyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          engagementId: "eng-123",
          status: "submitted",
          actorClerkId: "user_test123",
          actorName: "Test Business User",
        }),
      })
    );
  });

  it("returns error when user is not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);

    const result = await submitEngagementAction("eng-123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });
});

describe("approveEngagement (ENG-02, ENG-03)", () => {
  it.todo("transitions engagement from submitted to approved when called by compliance or finance user");
  it.todo("returns error when engagement is not in submitted state");
  it.todo("returns error when called by a business user (role guard)");
  it.todo("sets reviewedByClerkId, reviewedByName, and reviewedAt on the engagement record");
});

describe("rejectEngagement (ENG-02, ENG-03)", () => {
  it.todo("transitions engagement from submitted to rejected with a rejection reason");
  it.todo("returns error when rejection reason is less than 10 characters");
  it.todo("returns error when engagement is not in submitted state");
  it.todo("stores rejectionReason on the engagement record");
});

describe("completeEngagement (ENG-02, ENG-03)", () => {
  it.todo("transitions engagement from approved to completed when called by the original submitter");
  it.todo("returns error when engagement is not in approved state");
  it.todo("returns error when called by a user who did not submit the engagement");
});

describe("business user ownership guard (ENG-01 — Pitfall 5)", () => {
  it.todo("returns 404 (not 403) when a business user tries to access another user's engagement");
  it.todo("allows a business user to access their own engagement");
});
