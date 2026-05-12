"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles, assertRole } from "@/lib/auth";
import { validateEngagementFields } from "@/lib/engagement-validation";
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
