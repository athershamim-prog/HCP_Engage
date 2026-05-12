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
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["approved", "rejected"],
  approved: ["completed"],
  rejected: [],    // terminal
  completed: [],   // terminal
};

export function validateEngagementFields(params: {
  hcpId: string;
  engagementType: string;
  proposedDate: string;
  compensationUsd: number;
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
  if (params.compensationUsd < 0) {
    return { valid: false, error: "Compensation cannot be negative." };
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
