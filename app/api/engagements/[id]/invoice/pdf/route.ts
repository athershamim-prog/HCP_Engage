import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles } from "@/lib/auth";
import { InvoiceDocument } from "@/components/pdf/InvoiceDocument";
import React from "react";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: engagementId } = await params;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userGrant = await prisma.userGrant.findUnique({ where: { clerkUserId: userId } });
  const roles = getEffectiveRoles({
    role: (user.publicMetadata as { role?: string }).role,
    grants: userGrant?.grantedRoles ?? [],
  });

  const isCompliance = roles.includes("compliance");
  const isFinance = roles.includes("finance");
  if (!isCompliance && !isFinance) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      hcp: { select: { fullName: true, npi: true, nuccDisplayName: true } },
      invoice: true,
    },
  });

  if (!engagement || !engagement.invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const inv = engagement.invoice;
  const invoiceElement = React.createElement(InvoiceDocument, {
    hcpFullName: engagement.hcp.fullName,
    hcpNpi: engagement.hcp.npi,
    hcpSpecialty: engagement.hcp.nuccDisplayName,
    engagementType: engagement.engagementType,
    proposedDate: engagement.proposedDate.toISOString().split("T")[0],
    agreedRateUsd: parseFloat(inv.agreedRateUsd.toString()),
    rateUnit: inv.rateUnit,
    noOfActivities: inv.noOfActivities,
    totalUsd: parseFloat(inv.totalUsd.toString()),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  const buffer = await renderToBuffer(invoiceElement);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${engagementId}.pdf"`,
    },
  });
}
