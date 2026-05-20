import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles, assertRole } from "@/lib/auth";
import { calculateInvoiceData } from "@/lib/generate-invoice";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: engagementId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userGrant = await prisma.userGrant.findUnique({
      where: { clerkUserId: userId },
    });

    const roles = getEffectiveRoles({
      role: (user.publicMetadata as { role?: string }).role,
      grants: userGrant?.grantedRoles ?? [],
    });

    assertRole(roles, ["compliance"]);

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: {
        hcp: {
          select: {
            fullName: true,
            npi: true,
            nuccCode: true,
            nuccDisplayName: true,
          },
        },
        invoice: { select: { id: true } },
      },
    });

    if (!engagement) {
      return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
    }

    if (engagement.status !== "completed") {
      return NextResponse.json(
        { error: "Invoice can only be generated for completed engagements" },
        { status: 400 }
      );
    }

    if (!engagement.popDocumentUrl) {
      return NextResponse.json(
        { error: "Proof of Performance must be attached before generating invoice" },
        { status: 400 }
      );
    }

    if (engagement.invoice) {
      return NextResponse.json(
        { error: "Invoice already exists for this engagement" },
        { status: 409 }
      );
    }

    const payload = await calculateInvoiceData(engagement);
    const storageUrl = `/api/engagements/${engagementId}/invoice/pdf`;

    await prisma.$transaction(async (tx) => {
      await tx.invoice.create({
        data: {
          engagementId,
          storageUrl,
          agreedRateUsd: payload.agreedRateUsd,
          noOfActivities: payload.noOfActivities,
          totalUsd: payload.totalUsd,
          rateUnit: payload.rateUnit,
          generatedByClerkId: user.id,
          generatedByName: user.fullName ?? "Unknown",
        },
      });
    });

    return NextResponse.json({ storageUrl });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Invoice already exists for this engagement" },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message.startsWith("Access denied")) {
      return NextResponse.json(
        { error: "Forbidden: only Compliance can generate invoices" },
        { status: 403 }
      );
    }

    console.error("[invoice/route] Invoice generation failed:", error);
    return NextResponse.json({ error: "Invoice generation failed" }, { status: 500 });
  }
}
