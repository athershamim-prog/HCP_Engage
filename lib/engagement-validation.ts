/**
 * Pure validation helpers for engagement server actions.
 * No "use server" — exported as standalone module for testability.
 * Pattern: lib/hcp-validation.ts
 */

const VALID_ENGAGEMENT_TYPES = [
  "advisory_board",
  "speaker_program",
  "investigator_research",
  "meal_tov",
  "training",
] as const;

// Valid state machine transitions (D-08, D-09, D-11, ENG-02)
// New workflow: submitted → legal_review/approved/finance_review/rejected
//   legal_review → compliance_review | pop_submitted (via legalReviewReturnStatus)
//   compliance_review → legal_review/approved/finance_review/rejected
//   approved → pop_submitted (Business attaches PoP)
//   pop_submitted → legal_review/finance_review/rejected (Compliance routes)
//   finance_review → completed/rejected
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:             ["submitted"],
  submitted:         ["legal_review", "approved", "finance_review", "rejected"],
  legal_review:      ["compliance_review", "pop_submitted"],
  compliance_review: ["legal_review", "approved", "finance_review", "rejected"],
  approved:          ["pop_submitted"],
  pop_submitted:     ["legal_review", "finance_review", "rejected"],
  finance_review:    ["completed", "rejected"],
  rejected:          [],
  completed:         [],
};

export function validateEngagementFields(params: {
  hcpId: string;
  engagementType: string;
  proposedDate: string;
  agreedRateUsd: number;
  description: string;
}): { valid: boolean; error?: string } {
  if (!params.hcpId || params.hcpId.trim() === "") {
    return { valid: false, error: "Select an HCP before saving." };
  }
  if (!VALID_ENGAGEMENT_TYPES.includes(params.engagementType as typeof VALID_ENGAGEMENT_TYPES[number])) {
    return { valid: false, error: "Invalid engagement type selected." };
  }
  if (!params.proposedDate || params.proposedDate.trim() === "") {
    return { valid: false, error: "Proposed date is required." };
  }
  if (params.agreedRateUsd < 0) {
    return { valid: false, error: "Agreed rate cannot be negative." };
  }
  if (params.description.trim().length < 20) {
    return { valid: false, error: "Description must be at least 20 characters." };
  }
  return { valid: true };
}

export function validateRejectionReason(reason: string): { valid: boolean; error?: string } {
  if (reason.trim().length < 10) {
    return { valid: false, error: "Rejection reason must be at least 10 characters." };
  }
  return { valid: true };
}

export function validateStateTransition(
  currentStatus: string,
  nextStatus: string
): { valid: boolean; error?: string } {
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    return {
      valid: false,
      error: `Invalid transition: ${currentStatus} → ${nextStatus}`,
    };
  }
  return { valid: true };
}
