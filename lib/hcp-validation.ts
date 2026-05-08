/**
 * Pure validation helpers for HCP server actions.
 * Exported as a standalone module (no "use server") for testability.
 */

/**
 * Validates the parameters for setHcpStatus.
 * Pure function — no Prisma or Clerk dependencies.
 */
export function validateSetStatusParams(params: {
  reason: string;
  currentStatus: string;
  newStatus: string;
}): { valid: boolean; error?: string } {
  if (params.reason.trim().length < 10) {
    return { valid: false, error: "Reason must be at least 10 characters." };
  }
  if (params.currentStatus === params.newStatus) {
    return {
      valid: false,
      error: `HCP is already ${params.newStatus.replace(/_/g, " ")}`,
    };
  }
  return { valid: true };
}
