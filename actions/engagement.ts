"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles, assertRole } from "@/lib/auth";
import { validateEngagementFields, validateRejectionReason } from "@/lib/engagement-validation";
import type { EngagementType } from "@prisma/client";

export interface CreateEngagementParams {
  hcpId: string;
  engagementType: string;
  proposedDate: string;
  compensationUsd: number;
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
          compensationUsd: params.compensationUsd,
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
      // Atomic guard: only update if currently draft AND owned by this user (ownership check)
      const updated = await tx.engagement.updateMany({
        where: {
          id: engagementId,
          status: "draft",
          submittedByClerkId: user.id,
        },
        data: { status: "submitted" },
      });

      if (updated.count === 0) {
        throw new Error(
          "Engagement is not in draft state or you are not the submitter"
        );
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
    assertRole(roles, ["compliance", "finance"]);
  } catch {
    return { success: false, error: "Forbidden: only Compliance and Finance users can approve engagements" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.engagement.updateMany({
        where: { id: engagementId, status: "submitted" },
        data: {
          status: "approved",
          reviewedByClerkId: user.id,
          reviewedByName: user.fullName ?? "Unknown",
          reviewedAt: new Date(),
        },
      });
      if (updated.count === 0) throw new Error("Engagement is not in submitted state");

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
    return { success: false, error: "Forbidden: only Compliance and Finance users can reject engagements" };
  }

  // Server-side validation — cannot rely on client check (ENG-03, ASVS V5)
  const reasonValidation = validateRejectionReason(reason);
  if (!reasonValidation.valid) return { success: false, error: reasonValidation.error };

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.engagement.updateMany({
        where: { id: engagementId, status: "submitted" },
        data: {
          status: "rejected",
          rejectionReason: reason,
          reviewedByClerkId: user.id,
          reviewedByName: user.fullName ?? "Unknown",
          reviewedAt: new Date(),
        },
      });
      if (updated.count === 0) throw new Error("Engagement is not in submitted state");

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
    assertRole(roles, ["business", "compliance"]);
  } catch {
    return { success: false, error: "Forbidden" };
  }

  try {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // Guard: approved + owned by current user (ownership guard — T-02-05-03)
      const updated = await tx.engagement.updateMany({
        where: {
          id: engagementId,
          status: "approved",
          submittedByClerkId: user.id,
        },
        data: { status: "completed", completedAt: now },
      });
      if (updated.count === 0) {
        throw new Error("Engagement is not in approved state or you are not the submitter");
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
    // Guard: must be draft + owned by current user (T-02-05-06)
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
