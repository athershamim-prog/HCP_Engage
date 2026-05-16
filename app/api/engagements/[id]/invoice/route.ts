import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { r2 } from "@/lib/r2";
import { getEffectiveRoles, assertRole } from "@/lib/auth";
import { calculateInvoiceTotal } from "@/lib/invoice-calc";
import { InvoiceDocument } from "@/components/pdf/InvoiceDocument";
import React from "react";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: engagementId } = await params;

  // Auth — verify user is authenticated
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Role gate — compliance only (D-08)
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

    // Load engagement with HCP data
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

    // Gate: engagement must be completed (D-08)
    if (engagement.status !== "completed") {
      return NextResponse.json(
        { error: "Invoice can only be generated for completed engagements" },
        { status: 400 }
      );
    }

    // Gate: PoP must be attached (D-08)
    if (!engagement.popDocumentUrl) {
      return NextResponse.json(
        { error: "Proof of Performance must be attached before generating invoice" },
        { status: 400 }
      );
    }

    // Idempotency: invoice already exists → 409
    if (engagement.invoice) {
      return NextResponse.json(
        { error: "Invoice already exists for this engagement" },
        { status: 409 }
      );
    }

    // Look up FMV rate for rateUnit (best-effort — use per_hour if no rate on file, per D-07)
    const fmvRate = await prisma.fmvRate.findFirst({
      where: {
        rateCard: { status: "active" },
        nuccCode: engagement.hcp.nuccCode ?? undefined,
        engagementType: engagement.engagementType,
      },
      orderBy: { rateCard: { effectiveFrom: "desc" } },
    });

    // FmvRate.rateUnit is the RateUnit enum; convert to string
    const rateUnit = fmvRate?.rateUnit ?? "per_hour";

    // Calculate total (D-06)
    const agreedRateNum = parseFloat(engagement.agreedRateUsd.toString());
    const { totalUsd, noOfActivitiesApplied } = calculateInvoiceTotal({
      agreedRateUsd: agreedRateNum,
      rateUnit: rateUnit as "per_hour" | "per_day" | "flat_fee" | "per_event",
      noOfActivities: engagement.noOfActivities ?? null,
    });

    // Generate PDF buffer (D-02, D-11)
    // Cast: InvoiceDocument renders a <Document> root; cast required because TypeScript
    // cannot infer through the wrapper that the JSX root matches ReactPDF.DocumentProps.
    const invoiceElement = React.createElement(InvoiceDocument, {
      hcpFullName: engagement.hcp.fullName,
      hcpNpi: engagement.hcp.npi,
      hcpSpecialty: engagement.hcp.nuccDisplayName,
      engagementType: engagement.engagementType,
      proposedDate: engagement.proposedDate.toISOString().split("T")[0],
      agreedRateUsd: agreedRateNum,
      rateUnit: rateUnit,
      noOfActivities: engagement.noOfActivities ?? null,
      totalUsd,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    const buffer = await renderToBuffer(invoiceElement);

    // Upload to R2 (D-12, D-13)
    const key = `invoices/${engagementId}/${Date.now()}.pdf`;
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: "application/pdf",
      })
    );
    const storageUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    // Create Invoice record in a transaction (D-14)
    // Unique constraint on engagementId is the final race-condition guard
    await prisma.$transaction(async (tx) => {
      await tx.invoice.create({
        data: {
          engagementId,
          storageUrl,
          agreedRateUsd: agreedRateNum,
          noOfActivities:
            noOfActivitiesApplied === 1 && !engagement.noOfActivities
              ? null
              : noOfActivitiesApplied,
          totalUsd,
          rateUnit: rateUnit,
          generatedByClerkId: user.id,
          generatedByName: user.fullName ?? "Unknown",
        },
      });
    });

    return NextResponse.json({ storageUrl });
  } catch (error) {
    // Prisma unique constraint violation (P2002) — double-generate race condition
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Invoice already exists for this engagement" },
        { status: 409 }
      );
    }
    // assertRole throws "Access denied. Required roles: ..."
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
