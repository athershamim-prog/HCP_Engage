import { renderToBuffer } from "@react-pdf/renderer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { r2 } from "@/lib/r2";
import { calculateInvoiceTotal } from "@/lib/invoice-calc";
import { InvoiceDocument } from "@/components/pdf/InvoiceDocument";
import React from "react";
import type { Prisma, EngagementType } from "@prisma/client";

export interface InvoicePayload {
  storageUrl: string;
  agreedRateUsd: number;
  noOfActivities: number | null;
  totalUsd: number;
  rateUnit: string;
}

type EngagementForInvoice = {
  id: string;
  engagementType: EngagementType;
  proposedDate: Date;
  agreedRateUsd: Prisma.Decimal;
  noOfActivities: number | null;
  hcp: {
    fullName: string;
    npi: string;
    nuccCode: string | null;
    nuccDisplayName: string | null;
  };
};

export async function buildInvoicePdf(
  engagement: EngagementForInvoice
): Promise<InvoicePayload> {
  const fmvRate = await prisma.fmvRate.findFirst({
    where: {
      rateCard: { status: "active" },
      nuccCode: engagement.hcp.nuccCode ?? undefined,
      engagementType: engagement.engagementType,
    },
    orderBy: { rateCard: { effectiveFrom: "desc" } },
  });

  const rateUnit = fmvRate?.rateUnit ?? "per_hour";
  const agreedRateNum = parseFloat(engagement.agreedRateUsd.toString());
  const { totalUsd, noOfActivitiesApplied } = calculateInvoiceTotal({
    agreedRateUsd: agreedRateNum,
    rateUnit: rateUnit as "per_hour" | "per_day" | "flat_fee" | "per_event",
    noOfActivities: engagement.noOfActivities ?? null,
  });

  const invoiceElement = React.createElement(InvoiceDocument, {
    hcpFullName: engagement.hcp.fullName,
    hcpNpi: engagement.hcp.npi,
    hcpSpecialty: engagement.hcp.nuccDisplayName,
    engagementType: engagement.engagementType,
    proposedDate: engagement.proposedDate.toISOString().split("T")[0],
    agreedRateUsd: agreedRateNum,
    rateUnit,
    noOfActivities: engagement.noOfActivities ?? null,
    totalUsd,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
  const buffer = await renderToBuffer(invoiceElement);

  const key = `invoices/${engagement.id}/${Date.now()}.pdf`;
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    })
  );

  return {
    storageUrl: `${process.env.R2_PUBLIC_URL}/${key}`,
    agreedRateUsd: agreedRateNum,
    noOfActivities:
      noOfActivitiesApplied === 1 && !engagement.noOfActivities
        ? null
        : noOfActivitiesApplied,
    totalUsd,
    rateUnit,
  };
}
