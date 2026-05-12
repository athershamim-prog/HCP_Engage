"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EngagementType, RateUnit } from "@prisma/client";

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  advisory_board: "Advisory Board",
  speaker_program: "Speaker Program",
  investigator_research: "Investigator / Research",
  meal_tov: "Meal / TOV",
  training: "Training",
};

export const RATE_UNIT_LABELS: Record<RateUnit, string> = {
  per_hour: "per hour",
  per_day: "per day",
  per_event: "per event",
  flat_fee: "flat fee",
};

export interface SerializableRate {
  id: string;
  nuccCode: string;
  nuccDisplayName: string;
  state: string | null;
  engagementType: EngagementType;
  rateUsd: number; // Decimal converted to plain number server-side before passing to client
  rateUnit: RateUnit;
}

const ROWS_PER_PAGE = 50;

export function FmvRateDetailClient({ rates }: { rates: SerializableRate[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const filtered = rates.filter((r) => {
    const matchSearch =
      search.length === 0 ||
      r.nuccDisplayName.toLowerCase().includes(search.toLowerCase()) ||
      r.nuccCode.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || r.engagementType === typeFilter;
    const matchState =
      stateFilter === "all" ||
      (stateFilter === "national" ? r.state === null : r.state === stateFilter);
    return matchSearch && matchType && matchState;
  });

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleTypeFilter = (v: string | null) => {
    setTypeFilter(v ?? "all");
    setPage(1);
  };
  const handleStateFilter = (v: string | null) => {
    setStateFilter(v ?? "all");
    setPage(1);
  };

  // Derive unique states for the state filter dropdown
  const uniqueStates = Array.from(
    new Set(rates.filter((r) => r.state !== null).map((r) => r.state as string))
  ).sort();

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <Input
          placeholder="Search specialty name or code..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-[300px]"
          aria-label="Search specialty name or code"
        />
        <Select value={typeFilter} onValueChange={handleTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Engagement Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engagement Types</SelectItem>
            {(Object.keys(ENGAGEMENT_TYPE_LABELS) as EngagementType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {ENGAGEMENT_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stateFilter} onValueChange={handleStateFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="national">National</SelectItem>
            {uniqueStates.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rate table */}
      {filtered.length === 0 ? (
        <p className="text-[hsl(215_16%_47%)] text-[14px] py-8">
          No rates found for this version.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[12%] text-[12px] font-semibold">
                  Specialty Code
                </TableHead>
                <TableHead className="w-[22%] text-[12px] font-semibold">
                  Specialty Name
                </TableHead>
                <TableHead className="w-[8%] text-[12px] font-semibold">State</TableHead>
                <TableHead className="w-[18%] text-[12px] font-semibold">
                  Engagement Type
                </TableHead>
                <TableHead className="w-[12%] text-[12px] font-semibold">Rate</TableHead>
                <TableHead className="w-[12%] text-[12px] font-semibold">
                  Rate Unit
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-mono text-[12px]">{rate.nuccCode}</TableCell>
                  <TableCell>{rate.nuccDisplayName}</TableCell>
                  <TableCell>{rate.state ?? "National"}</TableCell>
                  <TableCell>
                    {ENGAGEMENT_TYPE_LABELS[rate.engagementType] ?? rate.engagementType}
                  </TableCell>
                  <TableCell>${rate.rateUsd.toFixed(2)}</TableCell>
                  <TableCell>
                    {RATE_UNIT_LABELS[rate.rateUnit] ?? rate.rateUnit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 mt-4 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-[12px] text-[hsl(215_16%_47%)]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
