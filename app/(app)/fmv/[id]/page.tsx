import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { FmvRateDetailClient } from "@/components/fmv/FmvRateDetailClient";
import type { SerializableRate } from "@/components/fmv/FmvRateDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await prisma.fmvRateCard.findUnique({
    where: { id },
    select: { version: true },
  });
  return {
    title: card
      ? `Rate Card v${card.version} — HCP Engage`
      : "Rate Card Not Found — HCP Engage",
  };
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: "bg-[hsl(142_71%_45%)] text-white",
  pending: "bg-[hsl(38_92%_50%)] text-white",
  superseded: "bg-[hsl(215_16%_65%)] text-white",
};

export default async function FmvRateCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) notFound();

  const card = await prisma.fmvRateCard.findUnique({
    where: { id },
    include: {
      rates: {
        orderBy: [{ nuccCode: "asc" }, { state: "asc" }],
      },
    },
  });
  if (!card) notFound();

  // Convert Prisma Decimal to plain number before passing to Client Component
  // (Decimal is not serializable across the server/client boundary)
  const serializedRates: SerializableRate[] = card.rates.map((r) => ({
    id: r.id,
    nuccCode: r.nuccCode,
    nuccDisplayName: r.nuccDisplayName,
    state: r.state,
    engagementType: r.engagementType,
    rateUsd: parseFloat(r.rateUsd.toString()),
    rateUnit: r.rateUnit,
  }));

  const badgeStyle = STATUS_BADGE_STYLES[card.status] ?? "bg-slate-400 text-white";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/fmv"
        className="text-[12px] text-[hsl(215_16%_47%)] hover:text-[hsl(220_13%_18%)] transition-colors"
      >
        ← Rate Cards
      </Link>

      {/* Page header */}
      <div>
        <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)]">
          Rate Card v{card.version}
        </h1>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <Badge className={badgeStyle}>
            {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
          </Badge>
          <span className="text-[12px] text-[hsl(215_16%_47%)]">
            Uploaded by {card.uploadedByName}
          </span>
          {card.effectiveFrom && (
            <span className="text-[12px] text-[hsl(215_16%_47%)]">
              Effective from {format(new Date(card.effectiveFrom), "MMM d, yyyy 'at' h:mm a")}
            </span>
          )}
          {card.effectiveTo && (
            <span className="text-[12px] text-[hsl(215_16%_47%)]">
              Effective to {format(new Date(card.effectiveTo), "MMM d, yyyy 'at' h:mm a")}
            </span>
          )}
          <span className="text-[12px] text-[hsl(215_16%_47%)]">
            {card.rates.length} rate{card.rates.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Client component: filter bar + rate table */}
      <FmvRateDetailClient rates={serializedRates} />
    </div>
  );
}
