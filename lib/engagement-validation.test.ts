/**
 * Tests for lib/engagement-validation.ts
 * Requirements: ENG-01, ENG-02, ENG-03
 */

import {
  validateEngagementFields,
  validateRejectionReason,
  validateStateTransition,
} from "@/lib/engagement-validation";

const VALID_ENGAGEMENT = {
  hcpId: "hcp-123",
  engagementType: "advisory_board",
  proposedDate: "2026-06-01",
  compensationUsd: 350,
  description: "A twenty-character minimum description for the engagement scope",
};

describe("validateEngagementFields", () => {
  it("returns valid=true for a fully populated engagement with all required fields", () => {
    expect(validateEngagementFields(VALID_ENGAGEMENT).valid).toBe(true);
  });
  it("returns valid=false with error when hcpId is missing", () => {
    const result = validateEngagementFields({ ...VALID_ENGAGEMENT, hcpId: "" });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Select an HCP before saving.");
  });
  it("returns valid=false with error when description is less than 20 characters", () => {
    const result = validateEngagementFields({ ...VALID_ENGAGEMENT, description: "Too short" });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Description must be at least 20 characters.");
  });
  it("returns valid=false with error when compensationUsd is negative", () => {
    const result = validateEngagementFields({ ...VALID_ENGAGEMENT, compensationUsd: -1 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/compensation/i);
  });
  it("returns valid=false with error when engagementType is not one of the 5 valid values", () => {
    const result = validateEngagementFields({ ...VALID_ENGAGEMENT, engagementType: "invalid_type" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/engagement type/i);
  });
  it("returns valid=false with error when proposedDate is missing", () => {
    const result = validateEngagementFields({ ...VALID_ENGAGEMENT, proposedDate: "" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/date/i);
  });
});

describe("validateRejectionReason", () => {
  it("returns valid=true when reason is exactly 10 characters", () => {
    expect(validateRejectionReason("1234567890").valid).toBe(true);
  });
  it("returns valid=true when reason is longer than 10 characters", () => {
    expect(validateRejectionReason("This is a long rejection reason").valid).toBe(true);
  });
  it("returns valid=false with exact error when reason is 9 chars", () => {
    const result = validateRejectionReason("123456789");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Rejection reason must be at least 10 characters.");
  });
  it("returns valid=false when reason is empty string", () => {
    expect(validateRejectionReason("").valid).toBe(false);
  });
  it("trims whitespace before checking length", () => {
    expect(validateRejectionReason("   short   ").valid).toBe(false);
  });
});

describe("validateStateTransition", () => {
  it("allows draft → submitted transition", () => {
    expect(validateStateTransition("draft", "submitted").valid).toBe(true);
  });
  it("allows submitted → approved transition", () => {
    expect(validateStateTransition("submitted", "approved").valid).toBe(true);
  });
  it("allows submitted → rejected transition", () => {
    expect(validateStateTransition("submitted", "rejected").valid).toBe(true);
  });
  it("allows approved → completed transition", () => {
    expect(validateStateTransition("approved", "completed").valid).toBe(true);
  });
  it("rejects draft → approved transition (must go through submitted)", () => {
    expect(validateStateTransition("draft", "approved").valid).toBe(false);
  });
  it("rejects completed → any transition (terminal state)", () => {
    expect(validateStateTransition("completed", "draft").valid).toBe(false);
    expect(validateStateTransition("completed", "submitted").valid).toBe(false);
  });
  it("rejects rejected → any transition (terminal state)", () => {
    expect(validateStateTransition("rejected", "submitted").valid).toBe(false);
  });
});
