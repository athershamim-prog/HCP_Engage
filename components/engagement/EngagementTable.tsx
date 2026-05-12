"use client";

import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EngagementStatusBadge } from "./EngagementStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { EngagementStatusValue } from "./EngagementStatusBadge";
import { cn } from "@/lib/utils";

export const ENGAGEMENT_TYPE_LABELS: Record<string, string> = {
  advisory_board:        "Advisory Board",
  speaker_program:       "Speaker Program",
  investigator_research: "Investigator / Research",
  meal_tov:              "Meal / TOV",
  training:              "Training",
};

export interface EngagementRow {
  id: string;
  engagementType: string;
  status: EngagementStatusValue;
  proposedDate: Date | string;
  compensationUsd: number;
  submittedByName: string;
  updatedAt: Date | string;
  hcp: { fullName: string };
}

export function EngagementTable({
  engagements,
  isFiltered,
}: {
  engagements: EngagementRow[];
  isFiltered?: boolean;
}) {
  if (engagements.length === 0) {
    if (isFiltered) {
      return (
        <EmptyState
          heading="No engagements match your filters"
          body="Try adjusting the status or type filter, or clear all filters."
        />
      );
    }
    return (
      <EmptyState
        heading="No engagements yet"
        body="Create your first engagement request to start the approval workflow."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[20%] text-[12px] font-semibold">HCP Name</TableHead>
          <TableHead className="w-[16%] text-[12px] font-semibold">Engagement Type</TableHead>
          <TableHead className="w-[12%] text-[12px] font-semibold">Status</TableHead>
          <TableHead className="w-[12%] text-[12px] font-semibold">Proposed Date</TableHead>
          <TableHead className="w-[10%] text-[12px] font-semibold">Compensation</TableHead>
          <TableHead className="w-[14%] text-[12px] font-semibold">Submitted By</TableHead>
          <TableHead className="w-[8%] text-[12px] font-semibold">Last Updated</TableHead>
          <TableHead className="w-[8%] text-[12px] font-semibold">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {engagements.map((engagement, index) => (
          <TableRow
            key={engagement.id}
            className={cn(
              "h-12 cursor-pointer hover:bg-[hsl(220_14%_96%)] transition-colors",
              index % 2 === 1 ? "bg-[hsl(0_0%_96%)]" : "bg-white",
              engagement.status === "rejected" ? "text-[hsl(215_16%_47%)]" : ""
            )}
            onClick={() => { window.location.href = `/engagements/${engagement.id}`; }}
          >
            <TableCell className="font-semibold text-[14px] text-[hsl(221_83%_53%)]">
              <Link
                href={`/engagements/${engagement.id}`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {engagement.hcp.fullName}
              </Link>
            </TableCell>
            <TableCell className="text-[14px]">
              {ENGAGEMENT_TYPE_LABELS[engagement.engagementType] ?? engagement.engagementType}
            </TableCell>
            <TableCell>
              <EngagementStatusBadge status={engagement.status} />
            </TableCell>
            <TableCell className="text-[14px]">
              {format(new Date(engagement.proposedDate), "MMM d, yyyy")}
            </TableCell>
            <TableCell className="text-[14px]">
              ${Number(engagement.compensationUsd).toFixed(2)}
            </TableCell>
            <TableCell className="text-[14px]">{engagement.submittedByName}</TableCell>
            <TableCell className="text-[14px] text-[hsl(215_16%_47%)]">
              {formatDistanceToNow(new Date(engagement.updatedAt), { addSuffix: true })}
            </TableCell>
            <TableCell>
              <Link
                href={`/engagements/${engagement.id}`}
                className="text-[14px] text-[hsl(221_83%_53%)] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
