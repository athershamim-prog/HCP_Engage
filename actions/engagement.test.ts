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
      delete: jest.fn(),
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
import {
  createEngagementAction,
  submitEngagementAction,
  approveEngagementAction,
  rejectEngagementAction,
  completeEngagementAction,
  deleteEngagementAction,
} from "@/actions/engagement";

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

describe("approveEngagementAction (ENG-02, ENG-03)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("transitions engagement from submitted to approved when called by compliance user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

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

    const result = await approveEngagementAction("eng-submitted-123");
    expect(result.success).toBe(true);
  });

  it("transitions engagement from submitted to approved when called by finance user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("finance") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await approveEngagementAction("eng-submitted-123");
    expect(result.success).toBe(true);
  });

  it("returns error when called by a business user (role guard)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    const result = await approveEngagementAction("eng-123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it("returns error when engagement is not in submitted state (updateMany returns count=0)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await approveEngagementAction("eng-not-submitted");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("sets reviewedByClerkId, reviewedByName, and reviewedAt on the engagement record", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

    let capturedTx: { engagement: { updateMany: jest.Mock }; engagementStatusHistory: { create: jest.Mock } } | null = null;

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as PrismaClient;
        capturedTx = mockTx as typeof capturedTx;
        return cb(mockTx);
      }
    );

    await approveEngagementAction("eng-123");
    expect(capturedTx).not.toBeNull();
    const updateManyCall = capturedTx!.engagement.updateMany.mock.calls[0][0];
    expect(updateManyCall.data).toMatchObject({
      status: "approved",
      reviewedByClerkId: "user_test123",
      reviewedByName: "Test Business User",
    });
    expect(updateManyCall.data.reviewedAt).toBeInstanceOf(Date);
  });
});

describe("rejectEngagementAction (ENG-02, ENG-03)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("transitions engagement from submitted to rejected with a valid rejection reason", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await rejectEngagementAction("eng-submitted-123", "The scope of work is not compliant with FMV guidelines.");
    expect(result.success).toBe(true);
  });

  it("returns error when rejection reason is less than 10 characters (server-side validation)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

    const result = await rejectEngagementAction("eng-123", "Too short");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/10 characters/i);
  });

  it("returns error when rejection reason is empty", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

    const result = await rejectEngagementAction("eng-123", "");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("returns error when engagement is not in submitted state", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await rejectEngagementAction("eng-not-submitted", "The engagement does not meet compliance requirements.");
    expect(result.success).toBe(false);
  });

  it("stores rejectionReason on the engagement record", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    const reason = "The scope is not compliant with current FMV guidelines.";

    let capturedTx: { engagement: { updateMany: jest.Mock }; engagementStatusHistory: { create: jest.Mock } } | null = null;

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as PrismaClient;
        capturedTx = mockTx as typeof capturedTx;
        return cb(mockTx);
      }
    );

    await rejectEngagementAction("eng-123", reason);
    expect(capturedTx).not.toBeNull();
    const updateManyCall = capturedTx!.engagement.updateMany.mock.calls[0][0];
    expect(updateManyCall.data.rejectionReason).toBe(reason);
    expect(updateManyCall.data.status).toBe("rejected");
  });

  it("returns error when called by a business user (role guard)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    const result = await rejectEngagementAction("eng-123", "This engagement does not comply with requirements.");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });
});

describe("completeEngagementAction (ENG-02, ENG-03)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("transitions engagement from approved to completed when called by the original submitter", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await completeEngagementAction("eng-approved-123");
    expect(result.success).toBe(true);
  });

  it("returns error when engagement is not in approved state (updateMany returns count=0)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await completeEngagementAction("eng-not-approved");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("uses submittedByClerkId ownership guard in updateMany where clause", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    let capturedTx: { engagement: { updateMany: jest.Mock }; engagementStatusHistory: { create: jest.Mock } } | null = null;

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          engagement: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as PrismaClient;
        capturedTx = mockTx as typeof capturedTx;
        return cb(mockTx);
      }
    );

    await completeEngagementAction("eng-123");
    expect(capturedTx).not.toBeNull();
    const updateManyCall = capturedTx!.engagement.updateMany.mock.calls[0][0];
    // Ownership guard: must include submittedByClerkId = current user
    expect(updateManyCall.where).toMatchObject({
      id: "eng-123",
      status: "approved",
      submittedByClerkId: "user_test123",
    });
  });
});

describe("deleteEngagementAction (ENG-02)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes a draft engagement when called by the owner", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    (mockPrisma.engagement.findUnique as jest.Mock).mockResolvedValue({
      id: "eng-draft-123",
      status: "draft",
      submittedByClerkId: "user_test123",
    });
    (mockPrisma.engagement as unknown as { delete: jest.Mock }).delete = jest.fn().mockResolvedValue({});

    const result = await deleteEngagementAction("eng-draft-123");
    expect(result.success).toBe(true);
  });

  it("returns error when engagement is not in draft state", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    (mockPrisma.engagement.findUnique as jest.Mock).mockResolvedValue({
      id: "eng-submitted",
      status: "submitted",
      submittedByClerkId: "user_test123",
    });

    const result = await deleteEngagementAction("eng-submitted");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/draft/i);
  });

  it("returns error when called by a user who did not submit the engagement", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    (mockPrisma.engagement.findUnique as jest.Mock).mockResolvedValue({
      id: "eng-draft-other",
      status: "draft",
      submittedByClerkId: "different_user_456",
    });

    const result = await deleteEngagementAction("eng-draft-other");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/own/i);
  });

  it("returns error when engagement is not found", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    (mockPrisma.engagement.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await deleteEngagementAction("eng-nonexistent");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});

describe("business user ownership guard (ENG-01 — Pitfall 5)", () => {
  it("verifies that completeEngagementAction requires submittedByClerkId match (ownership check in updateMany)", async () => {
    // Tests that the ownership guard is enforced at the DB level via updateMany
    // A different user's ID would result in count=0 from the DB
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    (mockPrisma.$transaction as jest.MockedFunction<typeof mockPrisma.$transaction>).mockImplementation(
      async (cb: (tx: PrismaClient) => Promise<unknown>) => {
        const mockTx = {
          // Simulates another user's engagement — DB returns 0 rows updated
          engagement: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as PrismaClient;
        return cb(mockTx);
      }
    );

    const result = await completeEngagementAction("eng-other-user-approved");
    // count=0 means the ownership guard in updateMany rejected the update
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("verifies that deleteEngagementAction rejects non-owner (ownership check before delete)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);

    (mockPrisma.engagement.findUnique as jest.Mock).mockResolvedValue({
      id: "eng-other-draft",
      status: "draft",
      submittedByClerkId: "another_user_789",
    });

    const result = await deleteEngagementAction("eng-other-draft");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/own/i);
  });
});
