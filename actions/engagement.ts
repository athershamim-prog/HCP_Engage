"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles, assertRole } from "@/lib/auth";
import { validateEngagementFields, validateRejectionReason, validateStateTransition } from "@/lib/engagement-validation";
import type { EngagementType, EngagementStatus } from "@prisma/client";

export interface CreateEngagementParams {
  hcpId: string;
  engagementType: string;
  proposedDate: string;
  agreedRateUsd: number;
  description: string;
}

export async function createEngagementAction(
  params: CreateEngagementParams
): Promise<{ success: boolean; id?: string; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["business", "compliance"]);
  } catch {
    return {
      success: false,
      error: "Forbidden: only Business and Compliance users can create engagements",
    };
  }

  const validation = validateEngagementFields(params);
  if (!validation.valid) return { success: false, error: validation.error };

  try {
    const engagement = await prisma.$transaction(async (tx) => {
      const eng = await tx.engagement.create({
        data: {
          hcpId: params.hcpId,
          engagementType: params.engagementType as EngagementType,
          status: "draft",
          proposedDate: new Date(params.proposedDate),
          agreedRateUsd: params.agreedRateUsd,
          description: params.description,
          submittedByClerkId: user.id,
          submittedByName: user.fullName ?? "Unknown",
        },
      });

      await tx.engagementStatusHistory.create({
        data: {
          engagementId: eng.id,
          status: "draft",
          actorClerkId: user.id,
          actorName: user.fullName ?? "Unknown",
        },
      });

      return eng;
    });

    revalidatePath("/engagements");
    return { success: true, id: engagement.id };
  } catch (error) {
    console.error("createEngagementAction failed:", error);
    return {
      success: false,
      error: "Could not save the engagement. Refresh the page and try again.",
    };
  }
}

export async function submitEngagementAction(
  engagementId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["business", "compliance"]);
  } catch {
    return { success: false, error: "Forbidden" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.engagement.updateMany({
        where: {
          id: engagementId,
          status: "draft",
          submittedByClerkId: user.id,
        },
        data: { status: "submitted" },
      });

      if (updated.count === 0) {
        throw new Error("Engagement is not in draft state or you are not the submitter");
      }

      await tx.engagementStatusHistory.create({
        data: {
          engagementId,
          status: "submitted",
          actorClerkId: user.id,
          actorName: user.fullName ?? "Unknown",
        },
      });
    });

    revalidatePath(`/engagements/${engagementId}`);
    revalidatePath("/engagements");
    return { success: true };
  } catch (error) {
    console.error("submitEngagementAction failed:", error);
    return {
      success: false,
      error: "Could not submit the engagement. Refresh the page and try again.",
    };
  }
}

// Compliance approves the engagement — Business must then attach a PoP document.
// Valid from: submitted, compliance_review
export async function approveEngagementAction(
  engagementId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["compliance"]);
  } catch {
    return { success: false, error: "Forbidden: only Compliance can approve engagements" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.engagement.updateMany({
        where: {
          id: engagementId,
          status: { in: ["submitted", "compliance_review"] },
        },
        data: {
          status: "approved",
          reviewedByClerkId: user.id,
          reviewedByName: user.fullName ?? "Unknown",
          reviewedAt: new Date(),
        },
      });
      if (updated.count === 0) {
        throw new Error("Engagement is not in a reviewable state");
      }

      await tx.engagementStatusHistory.create({
        data: {
          engagementId,
          status: "approved",
          actorClerkId: user.id,
          actorName: user.fullName ?? "Unknown",
        },
      });
    });

    revalidatePath(`/engagements/${engagementId}`);
    revalidatePath("/engagements");
    revalidatePath("/engagements/queue");
    return { success: true };
  } catch (error) {
    console.error("approveEngagementAction failed:", error);
    return { success: false, error: "Action failed. Refresh the page and try again." };
  }
}

// Compliance or Finance sends engagement to Legal for review.
// Stores the return state so legalReturnAction knows where to send it back.
// Valid from: submitted, compliance_review, pop_submitted
export async function sendToLegalAction(
  engagementId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["compliance"]);
  } catch {
    return { success: false, error: "Forbidden: only Compliance can send engagements to Legal" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const engagement = await tx.engagement.findUnique({
        where: { id: engagementId },
        select: { status: true },
      });
      if (!engagement) throw new Error("Engagement not found");

      const validFrom: EngagementStatus[] = ["submitted", "compliance_review", "pop_submitted"];
      if (!validFrom.includes(engagement.status)) {
        throw new Error(`Cannot send to Legal from status: ${engagement.status}`);
      }

      // Return to compliance_review from submitted/compliance_review; return to pop_submitted from pop_submitted
      const returnStatus: EngagementStatus =
        engagement.status === "pop_submitted" ? "pop_submitted" : "compliance_review";

      await tx.engagement.update({
        where: { id: engagementId },
        data: {
          status: "legal_review",
          legalReviewReturnStatus: returnStatus,
        },
      });

      await tx.engagementStatusHistory.create({
        data: {
          engagementId,
          status: "legal_review",
          actorClerkId: user.id,
          actorName: user.fullName ?? "Unknown",
        },
      });
    });

    revalidatePath(`/engagements/${engagementId}`);
    revalidatePath("/engagements");
    revalidatePath("/engagements/queue");
    revalidatePath("/engagements/legal-queue");
    return { success: true };
  } catch (error) {
    console.error("sendToLegalAction failed:", error);
    return { success: false, error: "Action failed. Refresh the page and try again." };
  }
}

// Legal provides feedback and returns the engagement to Compliance.
// Valid from: legal_review — returns to legalReviewReturnStatus
export async function legalReturnAction(
  engagementId: string,
  feedback: string
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["legal"]);
  } catch {
    return { success: false, error: "Forbidden: only Legal can return engagements" };
  }

  if (!feedback || feedback.trim().length < 10) {
    return { success: false, error: "Feedback must be at least 10 characters." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const engagement = await tx.engagement.findUnique({
        where: { id: engagementId },
        select: { status: true, legalReviewReturnStatus: true },
      });
      if (!engagement) throw new Error("Engagement not found");
      if (engagement.status !== "legal_review") {
        throw new Error("Engagement is not in legal_review state");
      }
      if (!engagement.legalReviewReturnStatus) {
        throw new Error("No return state recorded for this legal review");
      }

      const returnStatus = engagement.legalReviewReturnStatus;

      await tx.engagement.update({
        where: { id: engagementId },
        data: {
          status: returnStatus,
          legalReviewReturnStatus: null,
        },
      });

      await tx.engagementStatusHistory.create({
        data: {
          engagementId,
          status: returnStatus,
          actorClerkId: user.id,
          actorName: user.fullName ?? "Unknown",
          reason: feedback.trim(),
        },
      });
    });

    revalidatePath(`/engagements/${engagementId}`);
    revalidatePath("/engagements");
    revalidatePath("/engagements/queue");
    revalidatePath("/engagements/legal-queue");
    return { success: true };
  } catch (error) {
    console.error("legalReturnAction failed:", error);
    return { success: false, error: "Action failed. Refresh the page and try again." };
  }
}

// Compliance sends the engagement directly to Finance (skips PoP step).
// Valid from: submitted, compliance_review, pop_submitted
export async function sendToFinanceAction(
  engagementId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["compliance"]);
  } catch {
    return { success: false, error: "Forbidden: only Compliance can route engagements to Finance" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.engagement.updateMany({
        where: {
          id: engagementId,
          status: { in: ["submitted", "compliance_review", "pop_submitted"] },
        },
        data: {
          status: "finance_review",
          reviewedByClerkId: user.id,
          reviewedByName: user.fullName ?? "Unknown",
          reviewedAt: new Date(),
        },
      });
      if (updated.count === 0) {
        throw new Error("Engagement is not in a state that can be sent to Finance");
      }

      await tx.engagementStatusHistory.create({
        data: {
          engagementId,
          status: "finance_review",
          actorClerkId: user.id,
          actorName: user.fullName ?? "Unknown",
        },
      });
    });

    revalidatePath(`/engagements/${engagementId}`);
    revalidatePath("/engagements");
    revalidatePath("/engagements/queue");
    return { success: true };
  } catch (error) {
    console.error("sendToFinanceAction failed:", error);
    return { success: false, error: "Action failed. Refresh the page and try again." };
  }
}

// Business attaches a Proof of Performance document after Compliance approval.
// Valid from: approved
export async function attachPopAction(
  engagementId: string,
  popDocumentUrl: string
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["business", "compliance"]);
  } catch {
    return { success: false, error: "Forbidden" };
  }

  if (!popDocumentUrl || popDocumentUrl.trim().length === 0) {
    return { success: false, error: "Proof of Performance reference is required." };
  }

  // Validate URL — only internal UUID upload paths or http/https external references are permitted
  const INTERNAL_POP_RE = /^\/api\/engagements\/pop-file\/[0-9a-f-]{36}\.[a-z]{2,4}$/;
  const trimmed = popDocumentUrl.trim();
  if (!INTERNAL_POP_RE.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return { success: false, error: "Only https/http document references are permitted." };
      }
    } catch {
      return { success: false, error: "Invalid document reference. Use a valid URL or upload a file." };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.engagement.updateMany({
        where: {
          id: engagementId,
          status: "approved",
          submittedByClerkId: user.id,
        },
        data: {
          status: "pop_submitted",
          popDocumentUrl: popDocumentUrl.trim(),
        },
      });
      if (updated.count === 0) {
        throw new Error("Engagement is not in approved state or you are not the submitter");
      }

      await tx.engagementStatusHistory.create({
        data: {
          engagementId,
          status: "pop_submitted",
          actorClerkId: user.id,
          actorName: user.fullName ?? "Unknown",
          reason: `PoP attached: ${popDocumentUrl.trim()}`,
        },
      });
    });

    revalidatePath(`/engagements/${engagementId}`);
    revalidatePath("/engagements");
    revalidatePath("/engagements/queue");
    return { success: true };
  } catch (error) {
    console.error("attachPopAction failed:", error);
    return { success: false, error: "Action failed. Refresh the page and try again." };
  }
}

// Finance completes the engagement after reviewing.
// Valid from: finance_review
export async function completeEngagementAction(
  engagementId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["finance"]);
  } catch {
    return { success: false, error: "Forbidden: only Finance can complete engagements" };
  }

  try {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.engagement.updateMany({
        where: { id: engagementId, status: "finance_review" },
        data: {
          status: "completed",
          completedAt: now,
          reviewedByClerkId: user.id,
          reviewedByName: user.fullName ?? "Unknown",
          reviewedAt: now,
        },
      });
      if (updated.count === 0) {
        throw new Error("Engagement is not in finance_review state");
      }

      await tx.engagementStatusHistory.create({
        data: {
          engagementId,
          status: "completed",
          actorClerkId: user.id,
          actorName: user.fullName ?? "Unknown",
        },
      });
    });

    revalidatePath(`/engagements/${engagementId}`);
    revalidatePath("/engagements");
    return { success: true };
  } catch (error) {
    console.error("completeEngagementAction failed:", error);
    return { success: false, error: "Action failed. Refresh the page and try again." };
  }
}

// Compliance or Finance rejects the engagement. Valid from multiple states.
export async function rejectEngagementAction(
  engagementId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["compliance", "finance"]);
  } catch {
    return { success: false, error: "Forbidden: only Compliance and Finance can reject engagements" };
  }

  const reasonValidation = validateRejectionReason(reason);
  if (!reasonValidation.valid) return { success: false, error: reasonValidation.error };

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.engagement.updateMany({
        where: {
          id: engagementId,
          status: { in: ["submitted", "compliance_review", "pop_submitted", "finance_review"] },
        },
        data: {
          status: "rejected",
          rejectionReason: reason,
          reviewedByClerkId: user.id,
          reviewedByName: user.fullName ?? "Unknown",
          reviewedAt: new Date(),
        },
      });
      if (updated.count === 0) {
        throw new Error("Engagement is not in a rejectable state");
      }

      await tx.engagementStatusHistory.create({
        data: {
          engagementId,
          status: "rejected",
          actorClerkId: user.id,
          actorName: user.fullName ?? "Unknown",
          reason,
        },
      });
    });

    revalidatePath(`/engagements/${engagementId}`);
    revalidatePath("/engagements");
    revalidatePath("/engagements/queue");
    return { success: true };
  } catch (error) {
    console.error("rejectEngagementAction failed:", error);
    return { success: false, error: "Action failed. Refresh the page and try again." };
  }
}

export async function deleteEngagementAction(
  engagementId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: [],
  });
  try {
    assertRole(roles, ["business", "compliance"]);
  } catch {
    return { success: false, error: "Forbidden" };
  }

  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { status: true, submittedByClerkId: true },
    });

    if (!engagement) return { success: false, error: "Engagement not found" };
    if (engagement.status !== "draft") return { success: false, error: "Only draft engagements can be deleted" };
    if (engagement.submittedByClerkId !== user.id) return { success: false, error: "You can only delete your own drafts" };

    await prisma.engagement.delete({ where: { id: engagementId } });

    revalidatePath("/engagements");
    return { success: true };
  } catch (error) {
    console.error("deleteEngagementAction failed:", error);
    return { success: false, error: "Action failed. Refresh the page and try again." };
  }
}
