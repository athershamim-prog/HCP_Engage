"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HcpStatusBadge } from "./HcpStatusBadge";
import { DebarmentBadge } from "./DebarmentBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { HcpSearchResult } from "@/actions/hcp";
import type { HcpStatusValue } from "./HcpStatusBadge";
import type { DebarmentStatusValue } from "./DebarmentBadge";

export function HcpTable({
  hcps,
  emptyQuery,
}: {
  hcps: HcpSearchResult[];
  emptyQuery?: string;
}) {
  if (hcps.length === 0) {
    if (emptyQuery) {
      return (
        <EmptyState
          heading={`No results for "${emptyQuery}"`}
          body="Try a different name or verify the NPI number."
        />
      );
    }
    return (
      <EmptyState
        heading="No HCPs in your directory"
        body="Search by NPI to add your first HCP and begin compliance tracking."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[22%] text-[12px] font-semibold">HCP Name</TableHead>
          <TableHead className="w-[10%] text-[12px] font-semibold">NPI</TableHead>
          <TableHead className="w-[10%] text-[12px] font-semibold">Credentials</TableHead>
          <TableHead className="w-[18%] text-[12px] font-semibold">Specialty</TableHead>
          <TableHead className="w-[8%] text-[12px] font-semibold">State</TableHead>
          <TableHead className="w-[12%] text-[12px] font-semibold">Status</TableHead>
          <TableHead className="w-[12%] text-[12px] font-semibold">Debarment</TableHead>
          <TableHead className="w-[8%] text-[12px] font-semibold">Last Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {hcps.map((hcp, index) => (
          <TableRow
            key={hcp.id}
            className={`h-12 cursor-pointer hover:bg-[hsl(220_14%_96%)] transition-colors ${
              index % 2 === 1 ? "bg-[hsl(0_0%_96%)]" : "bg-white"
            }`}
            onClick={() => { window.location.href = `/hcps/${hcp.id}`; }}
          >
            <TableCell className="font-semibold text-[14px] text-[hsl(221_83%_53%)]">
              <Link
                href={`/hcps/${hcp.id}`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {hcp.fullName}
              </Link>
            </TableCell>
            <TableCell className="font-mono text-[14px]">{hcp.npi}</TableCell>
            <TableCell className="text-[14px] max-w-0 truncate" title={hcp.credentials ?? ""}>
              {hcp.credentials ?? "—"}
            </TableCell>
            <TableCell className="text-[14px] max-w-0 truncate" title={hcp.nuccDisplayName}>
              {hcp.nuccDisplayName}
            </TableCell>
            <TableCell className="text-[14px]">{hcp.primaryState}</TableCell>
            <TableCell>
              <HcpStatusBadge status={hcp.status as HcpStatusValue} />
            </TableCell>
            <TableCell>
              <DebarmentBadge status={hcp.debarmentStatus as DebarmentStatusValue} />
            </TableCell>
            <TableCell className="text-[14px] text-[hsl(215_16%_47%)]">
              {formatDistanceToNow(new Date(hcp.updatedAt), { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
