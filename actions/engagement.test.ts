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
      update: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    engagementStatusHistory: { create: jest.fn() },
    userGrant: { findUnique: jest.fn().mockResolvedValue(null) },
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
  sendToLegalAction,
  legalReturnAction,
  sendToFinanceAction,
  attachPopAction,
} from "@/actions/engagement";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCurrentUser = currentUser as jest.MockedFunction<typeof currentUser>;

function makeUser(role: string, id = "user_test123") {
  return {
    id,
    fullName: "Test User",
    publicMetadata: { role },
  } as ReturnType<typeof Object.assign>;
}

function makeTx(overrides?: { updateCount?: number; updateResult?: Record<string, unknown> }) {
  return {
    engagement: {
      create: jest.fn().mockResolvedValue({ id: "eng-new-123" }),
      updateMany: jest.fn().mockResolvedValue({ count: overrides?.updateCount ?? 1 }),
      update: jest.fn().mockResolvedValue(overrides?.updateResult ?? {}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaClient;
}

const VALID_PARAMS = {
  hcpId: "hcp-abc",
  engagementType: "advisory_board",
  proposedDate: "2026-06-01",
  agreedRateUsd: 350,
  description: "A twenty-character minimum description for the engagement scope",
};

beforeEach(() => jest.clearAllMocks());

// ── createEngagementAction ─────────────────────────────────────────────────
describe("createEngagementAction (ENG-01)", () => {
  it("returns success=true with id for a business user with valid params", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx()));

    const result = await createEngagementAction(VALID_PARAMS);
    expect(result.success).toBe(true);
    expect((result as { id: string }).id).toBe("eng-new-123");
  });

  it("returns error when unauthenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);
    const result = await createEngagementAction(VALID_PARAMS);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it("returns forbidden for a finance user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("finance") as never);
    const result = await createEngagementAction(VALID_PARAMS);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it("returns validation error for missing hcpId", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    const result = await createEngagementAction({ ...VALID_PARAMS, hcpId: "" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Select an HCP before saving.");
  });

  it("returns validation error for short description", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    const result = await createEngagementAction({ ...VALID_PARAMS, description: "Too short" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Description must be at least 20 characters.");
  });
});

// ── submitEngagementAction ─────────────────────────────────────────────────
describe("submitEngagementAction (ENG-02)", () => {
  it("transitions draft → submitted for owner", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx()));

    const result = await submitEngagementAction("eng-123");
    expect(result.success).toBe(true);
  });

  it("returns error when updateMany count=0 (not draft or not owner)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx({ updateCount: 0 })));

    const result = await submitEngagementAction("eng-not-draft");
    expect(result.success).toBe(false);
  });

  it("records status history entry with correct actor", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    let capturedTx: ReturnType<typeof makeTx> | null = null;
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => {
      capturedTx = makeTx() as ReturnType<typeof makeTx>;
      return cb(capturedTx as unknown as PrismaClient);
    });

    await submitEngagementAction("eng-123");
    expect(capturedTx!.engagementStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "submitted", actorClerkId: "user_test123" }) })
    );
  });
});

// ── approveEngagementAction (Compliance only → approved state) ─────────────
describe("approveEngagementAction (ENG-02, ENG-03)", () => {
  it("transitions submitted → approved for compliance user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx()));

    const result = await approveEngagementAction("eng-submitted-123");
    expect(result.success).toBe(true);
  });

  it("transitions compliance_review → approved for compliance user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx()));

    const result = await approveEngagementAction("eng-review-123");
    expect(result.success).toBe(true);
  });

  it("returns forbidden for a finance user (compliance-only action)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("finance") as never);
    const result = await approveEngagementAction("eng-123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it("returns forbidden for a business user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    const result = await approveEngagementAction("eng-123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it("returns error when updateMany count=0", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx({ updateCount: 0 })));

    const result = await approveEngagementAction("eng-wrong-state");
    expect(result.success).toBe(false);
  });

  it("sets reviewedByClerkId, reviewedByName, reviewedAt on update", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    let capturedTx: ReturnType<typeof makeTx> | null = null;
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => {
      capturedTx = makeTx();
      return cb(capturedTx as unknown as PrismaClient);
    });

    await approveEngagementAction("eng-123");
    const call = capturedTx!.engagement.updateMany.mock.calls[0][0];
    expect(call.data).toMatchObject({ status: "approved", reviewedByClerkId: "user_test123" });
    expect(call.data.reviewedAt).toBeInstanceOf(Date);
  });
});

// ── sendToLegalAction ──────────────────────────────────────────────────────
describe("sendToLegalAction", () => {
  function mockTxWithEngagement(status: string) {
    return {
      engagement: {
        findUnique: jest.fn().mockResolvedValue({ status }),
        update: jest.fn().mockResolvedValue({}),
      },
      engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaClient;
  }

  it("transitions submitted → legal_review and stores compliance_review return state", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    let capturedTx: ReturnType<typeof mockTxWithEngagement> | null = null;
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => {
      capturedTx = mockTxWithEngagement("submitted") as unknown as ReturnType<typeof mockTxWithEngagement>;
      return cb(capturedTx as unknown as PrismaClient);
    });

    const result = await sendToLegalAction("eng-123");
    expect(result.success).toBe(true);
    const updateCall = (capturedTx!.engagement.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data).toMatchObject({ status: "legal_review", legalReviewReturnStatus: "compliance_review" });
  });

  it("transitions pop_submitted → legal_review and stores pop_submitted return state", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    let capturedTx: ReturnType<typeof mockTxWithEngagement> | null = null;
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => {
      capturedTx = mockTxWithEngagement("pop_submitted") as unknown as ReturnType<typeof mockTxWithEngagement>;
      return cb(capturedTx as unknown as PrismaClient);
    });

    const result = await sendToLegalAction("eng-123");
    expect(result.success).toBe(true);
    const updateCall = (capturedTx!.engagement.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data).toMatchObject({ status: "legal_review", legalReviewReturnStatus: "pop_submitted" });
  });

  it("returns forbidden for non-compliance user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    const result = await sendToLegalAction("eng-123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });
});

// ── legalReturnAction ──────────────────────────────────────────────────────
describe("legalReturnAction", () => {
  function mockTxWithLegalReview(returnStatus: string) {
    return {
      engagement: {
        findUnique: jest.fn().mockResolvedValue({ status: "legal_review", legalReviewReturnStatus: returnStatus }),
        update: jest.fn().mockResolvedValue({}),
      },
      engagementStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaClient;
  }

  it("returns engagement to compliance_review when triggered from Compliance initial review", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("legal") as never);
    let capturedTx: ReturnType<typeof mockTxWithLegalReview> | null = null;
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => {
      capturedTx = mockTxWithLegalReview("compliance_review") as unknown as ReturnType<typeof mockTxWithLegalReview>;
      return cb(capturedTx as unknown as PrismaClient);
    });

    const result = await legalReturnAction("eng-123", "No legal concerns identified at this time.");
    expect(result.success).toBe(true);
    const updateCall = (capturedTx!.engagement.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.status).toBe("compliance_review");
    expect(updateCall.data.legalReviewReturnStatus).toBeNull();
  });

  it("returns engagement to pop_submitted when triggered from PoP stage", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("legal") as never);
    let capturedTx: ReturnType<typeof mockTxWithLegalReview> | null = null;
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => {
      capturedTx = mockTxWithLegalReview("pop_submitted") as unknown as ReturnType<typeof mockTxWithLegalReview>;
      return cb(capturedTx as unknown as PrismaClient);
    });

    const result = await legalReturnAction("eng-123", "PoP document reviewed and approved.");
    expect(result.success).toBe(true);
    const updateCall = (capturedTx!.engagement.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.status).toBe("pop_submitted");
  });

  it("returns error when feedback is too short", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("legal") as never);
    const result = await legalReturnAction("eng-123", "Too short");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/10 characters/i);
  });

  it("returns forbidden for non-legal user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    const result = await legalReturnAction("eng-123", "Valid feedback text here.");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it("stores feedback in status history reason field", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("legal") as never);
    const feedback = "No legal concerns — approved with standard terms.";
    let capturedTx: ReturnType<typeof mockTxWithLegalReview> | null = null;
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => {
      capturedTx = mockTxWithLegalReview("compliance_review") as unknown as ReturnType<typeof mockTxWithLegalReview>;
      return cb(capturedTx as unknown as PrismaClient);
    });

    await legalReturnAction("eng-123", feedback);
    const historyCall = capturedTx!.engagementStatusHistory.create.mock.calls[0][0];
    expect(historyCall.data.reason).toBe(feedback.trim());
  });
});

// ── sendToFinanceAction ────────────────────────────────────────────────────
describe("sendToFinanceAction", () => {
  it("transitions submitted → finance_review for compliance user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx()));

    const result = await sendToFinanceAction("eng-123");
    expect(result.success).toBe(true);
  });

  it("transitions pop_submitted → finance_review", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx()));

    const result = await sendToFinanceAction("eng-123");
    expect(result.success).toBe(true);
  });

  it("returns forbidden for finance user (compliance-only action)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("finance") as never);
    const result = await sendToFinanceAction("eng-123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it("returns error when updateMany count=0 (wrong state)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx({ updateCount: 0 })));

    const result = await sendToFinanceAction("eng-wrong-state");
    expect(result.success).toBe(false);
  });
});

// ── attachPopAction ────────────────────────────────────────────────────────
describe("attachPopAction", () => {
  it("transitions approved → pop_submitted with popDocumentUrl for the owner", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    let capturedTx: ReturnType<typeof makeTx> | null = null;
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => {
      capturedTx = makeTx();
      return cb(capturedTx as unknown as PrismaClient);
    });

    const result = await attachPopAction("eng-123", "https://sharepoint.example.com/pop-doc-001");
    expect(result.success).toBe(true);
    const updateCall = capturedTx!.engagement.updateMany.mock.calls[0][0];
    expect(updateCall.data.status).toBe("pop_submitted");
    expect(updateCall.data.popDocumentUrl).toBe("https://sharepoint.example.com/pop-doc-001");
  });

  it("returns error when popDocumentUrl is empty", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    const result = await attachPopAction("eng-123", "");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it("returns error when updateMany count=0 (not approved or not owner)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx({ updateCount: 0 })));

    const result = await attachPopAction("eng-123", "some-doc-ref");
    expect(result.success).toBe(false);
  });

  it("returns forbidden for legal user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("legal") as never);
    const result = await attachPopAction("eng-123", "some-doc-ref");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });
});

// ── completeEngagementAction (Finance only, from finance_review) ───────────
describe("completeEngagementAction (ENG-02)", () => {
  it("transitions finance_review → completed for finance user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("finance") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx()));

    const result = await completeEngagementAction("eng-finance-review-123");
    expect(result.success).toBe(true);
  });

  it("returns forbidden for business user (finance-only action)", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    const result = await completeEngagementAction("eng-123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it("returns forbidden for compliance user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    const result = await completeEngagementAction("eng-123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it("returns error when engagement is not in finance_review state", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("finance") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx({ updateCount: 0 })));

    const result = await completeEngagementAction("eng-wrong-state");
    expect(result.success).toBe(false);
  });
});

// ── rejectEngagementAction ─────────────────────────────────────────────────
describe("rejectEngagementAction (ENG-02, ENG-03)", () => {
  it("rejects engagement from submitted state for compliance user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx()));

    const result = await rejectEngagementAction("eng-submitted", "The scope does not comply with FMV guidelines.");
    expect(result.success).toBe(true);
  });

  it("rejects engagement from finance_review state for finance user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("finance") as never);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => cb(makeTx()));

    const result = await rejectEngagementAction("eng-finance-review", "Payment cannot be processed — missing documentation.");
    expect(result.success).toBe(true);
  });

  it("returns error when reason is too short", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    const result = await rejectEngagementAction("eng-123", "Too short");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/10 characters/i);
  });

  it("returns forbidden for business user", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    const result = await rejectEngagementAction("eng-123", "This engagement does not comply with requirements.");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it("stores rejectionReason on the engagement record", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("compliance") as never);
    const reason = "The scope is not compliant with current FMV guidelines.";
    let capturedTx: ReturnType<typeof makeTx> | null = null;
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: PrismaClient) => Promise<unknown>) => {
      capturedTx = makeTx();
      return cb(capturedTx as unknown as PrismaClient);
    });

    await rejectEngagementAction("eng-123", reason);
    const call = capturedTx!.engagement.updateMany.mock.calls[0][0];
    expect(call.data.rejectionReason).toBe(reason);
    expect(call.data.status).toBe("rejected");
  });
});

// ── deleteEngagementAction ─────────────────────────────────────────────────
describe("deleteEngagementAction (ENG-02)", () => {
  it("deletes a draft engagement when called by the owner", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    (mockPrisma.engagement.findUnique as jest.Mock).mockResolvedValue({ id: "eng-draft", status: "draft", submittedByClerkId: "user_test123" });
    (mockPrisma.engagement as unknown as { delete: jest.Mock }).delete = jest.fn().mockResolvedValue({});

    const result = await deleteEngagementAction("eng-draft");
    expect(result.success).toBe(true);
  });

  it("returns error when engagement is not draft", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    (mockPrisma.engagement.findUnique as jest.Mock).mockResolvedValue({ status: "submitted", submittedByClerkId: "user_test123" });

    const result = await deleteEngagementAction("eng-submitted");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/draft/i);
  });

  it("returns error for non-owner", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    (mockPrisma.engagement.findUnique as jest.Mock).mockResolvedValue({ status: "draft", submittedByClerkId: "different_user_456" });

    const result = await deleteEngagementAction("eng-draft-other");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/own/i);
  });

  it("returns error when engagement not found", async () => {
    mockCurrentUser.mockResolvedValue(makeUser("business") as never);
    (mockPrisma.engagement.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await deleteEngagementAction("eng-nonexistent");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});
