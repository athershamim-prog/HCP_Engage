// Mock external dependencies to avoid DATABASE_URL/Clerk requirements in unit tests
jest.mock("@/lib/prisma", () => ({
  prisma: {
    hcp: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    hcpStatusHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  currentUser: jest.fn(),
  auth: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import { validateSetStatusParams } from "./hcp";

describe("validateSetStatusParams", () => {
  it("returns error when reason is shorter than 10 chars", () => {
    const result = validateSetStatusParams({
      reason: "short",
      currentStatus: "active",
      newStatus: "inactive",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Reason must be at least 10 characters.");
  });

  it("returns valid for reason of exactly 10 chars", () => {
    const result = validateSetStatusParams({
      reason: "1234567890",
      currentStatus: "active",
      newStatus: "inactive",
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns error when setting same status", () => {
    const result = validateSetStatusParams({
      reason: "valid reason here",
      currentStatus: "inactive",
      newStatus: "inactive",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("HCP is already");
  });

  it("returns valid when status changes with long enough reason", () => {
    const result = validateSetStatusParams({
      reason: "This is a valid reason for changing HCP status",
      currentStatus: "active",
      newStatus: "suspended",
    });
    expect(result.valid).toBe(true);
  });
});
