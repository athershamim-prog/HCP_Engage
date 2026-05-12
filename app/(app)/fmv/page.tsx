import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { format } from "date-fns";
import { Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { FmvActivateButton } from "./FmvActivateButton";
import { cn } from "@/lib/utils";

export const metadata = { title: "FMV Rate Cards — HCP Engage" };

const PAGE_SIZE = 20;

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-[hsl(142_71%_45%)] text-white border-transparent",
  },
  pending: {
    label: "Pending",
    className: "bg-[hsl(38_92%_50%)] text-white border-transparent",
  },
  superseded: {
    label: "Superseded",
    className: "bg-[hsl(215_16%_65%)] text-white border-transparent",
  },
};

export default async function FmvPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const user = await currentUser();

  const roles = user
    ? getEffectiveRoles({
        role: (user.publicMetadata as { role?: string }).role,
        grants: [],
      })
    : [];
  const isCompliance = roles.includes("compliance");

  const [cards, total] = await Promise.all([
    prisma.fmvRateCard.findMany({
      orderBy: { version: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        version: true,
        status: true,
        uploadedByName: true,
        effectiveFrom: true,
        effectiveTo: true,
        rowCount: true,
      },
    }),
    prisma.fmvRateCard.count(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)]">
          FMV Rate Cards
        </h1>
        {isCompliance && (
          <Link
            href="/fmv/upload"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11 px-4 text-sm font-medium text-white transition-colors"
          >
            <Upload className="h-4 w-4" />
            Upload Rate Card
          </Link>
        )}
      </div>

      {cards.length === 0 ? (
        <EmptyState
          heading="No rate cards uploaded"
          body="Upload an Excel or CSV file to create your first FMV rate card version."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[8%] text-[12px] font-semibold">Version</TableHead>
                <TableHead className="w-[12%] text-[12px] font-semibold">Status</TableHead>
                <TableHead className="w-[20%] text-[12px] font-semibold">Uploaded By</TableHead>
                <TableHead className="w-[16%] text-[12px] font-semibold">Effective From</TableHead>
                <TableHead className="w-[16%] text-[12px] font-semibold">Effective To</TableHead>
                <TableHead className="w-[8%] text-[12px] font-semibold">Rows</TableHead>
                <TableHead className="w-[20%] text-[12px] font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((card, index) => {
                const statusCfg =
                  STATUS_CONFIG[card.status] ?? STATUS_CONFIG.superseded;
                return (
                  <TableRow
                    key={card.id}
                    className={`h-12 ${index % 2 === 1 ? "bg-[hsl(0_0%_96%)]" : "bg-white"}`}
                  >
                    <TableCell className="font-semibold text-[14px]">
                      v{card.version}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "h-6 text-[12px] font-semibold",
                          statusCfg.className
                        )}
                      >
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[14px]">
                      {card.uploadedByName}
                    </TableCell>
                    <TableCell className="text-[14px]">
                      {card.effectiveFrom
                        ? format(new Date(card.effectiveFrom), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-[14px]">
                      {card.effectiveTo
                        ? format(new Date(card.effectiveTo), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-[14px]">{card.rowCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/fmv/${card.id}`}
                          className="text-[14px] font-medium text-[hsl(221_83%_53%)] hover:underline"
                        >
                          View Rates
                        </Link>
                        {isCompliance && card.status === "pending" && (
                          <FmvActivateButton rateCardId={card.id} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/fmv?page=${p}`}
                  className={`inline-flex items-center justify-center rounded-lg h-9 w-9 text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-[hsl(221_83%_53%)] text-white"
                      : "border border-border bg-background hover:bg-muted"
                  }`}
                  aria-label={`Page ${p}`}
                  aria-current={p === page ? "page" : undefined}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
