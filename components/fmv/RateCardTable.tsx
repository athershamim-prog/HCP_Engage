"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";

export interface RateCardRow {
  rowIndex: number;
  specialty_code: string;
  state: string | null;
  engagement_type: string;
  rate_usd: number;
  rate_unit: string;
  nuccValid: boolean;
  nuccDisplayName: string | null;
}

const ENGAGEMENT_TYPE_LABELS: Record<string, string> = {
  advisory_board: "Advisory Board",
  speaker_program: "Speaker Program",
  investigator_research: "Investigator / Research",
  meal_tov: "Meal / TOV",
  training: "Training",
};

const RATE_UNIT_LABELS: Record<string, string> = {
  per_hour: "per hour",
  per_day: "per day",
  per_event: "per event",
  flat_fee: "flat fee",
};

const NUCC_BADGE_CONFIG = {
  valid: {
    label: "Valid",
    className: "bg-[hsl(142_71%_45%)] text-white border-transparent",
  },
  unrecognized: {
    label: "Unrecognized",
    className: "bg-[hsl(0_72%_51%)] text-white border-transparent",
  },
};

export function RateCardTable({ rows }: { rows: RateCardRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        heading="No rows to display"
        body="The uploaded file did not contain any data rows."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[4%] text-[12px] font-semibold">#</TableHead>
          <TableHead className="w-[14%] text-[12px] font-semibold">Specialty Code</TableHead>
          <TableHead className="w-[20%] text-[12px] font-semibold">Specialty Name</TableHead>
          <TableHead className="w-[8%] text-[12px] font-semibold">State</TableHead>
          <TableHead className="w-[18%] text-[12px] font-semibold">Engagement Type</TableHead>
          <TableHead className="w-[10%] text-[12px] font-semibold">Rate</TableHead>
          <TableHead className="w-[12%] text-[12px] font-semibold">Rate Unit</TableHead>
          <TableHead className="w-[14%] text-[12px] font-semibold">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const badgeConfig = row.nuccValid
            ? NUCC_BADGE_CONFIG.valid
            : NUCC_BADGE_CONFIG.unrecognized;

          return (
            <TableRow
              key={row.rowIndex}
              className={`h-11 ${index % 2 === 1 ? "bg-[hsl(0_0%_96%)]" : "bg-white"}`}
            >
              <TableCell className="text-[14px] text-[hsl(215_16%_47%)]">
                {row.rowIndex}
              </TableCell>
              <TableCell className="font-mono text-[13px]">
                {row.specialty_code}
              </TableCell>
              <TableCell className="text-[14px]">
                {row.nuccDisplayName ?? (
                  <span className="text-[hsl(215_16%_47%)] italic">—</span>
                )}
              </TableCell>
              <TableCell className="text-[14px]">
                {row.state ?? <span className="text-[hsl(215_16%_47%)]">National</span>}
              </TableCell>
              <TableCell className="text-[14px]">
                {ENGAGEMENT_TYPE_LABELS[row.engagement_type] ?? row.engagement_type}
              </TableCell>
              <TableCell className="text-[14px] font-medium">
                ${row.rate_usd.toFixed(2)}
              </TableCell>
              <TableCell className="text-[14px] text-[hsl(215_16%_47%)]">
                {RATE_UNIT_LABELS[row.rate_unit] ?? row.rate_unit}
              </TableCell>
              <TableCell>
                <Badge
                  className={cn("h-6 text-[12px] font-semibold", badgeConfig.className)}
                >
                  {badgeConfig.label}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
