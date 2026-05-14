import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles, assertRole } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ENGAGEMENT_TYPE_LABELS } from "@/components/engagement/EngagementTable";

export const metadata = { title: "Legal Review Queue — HCP Engage" };

export default async function LegalQueuePage() {
  const user = await currentUser();
  if (!user) notFound();

  const role = (user.publicMetadata as { role?: string }).role;
  const userGrant = await prisma.userGrant.findUnique({
    where: { clerkUserId: user.id },
  });
  const effectiveRoles = getEffectiveRoles({
    role,
    grants: userGrant?.grantedRoles ?? [],
  });

  try {
    assertRole(effectiveRoles, ["legal", "compliance"]);
  } catch {
    notFound();
  }

  const engagements = await prisma.engagement.findMany({
    where: { status: "legal_review" },
    include: {
      hcp: { select: { fullName: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  const count = engagements.length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)]">Legal Review Queue</h1>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
            count > 0
              ? "bg-[hsl(270_60%_55%)] text-white"
              : "bg-[hsl(215_16%_65%)] text-white"
          }`}
          aria-label={`${count} engagements awaiting legal review`}
        >
          {count} pending
        </span>
      </div>
      <p className="text-[14px] text-[hsl(215_16%_47%)] mb-6">
        Engagements referred by Compliance for legal assessment.
      </p>

      {count === 0 ? (
        <div className="text-center py-16">
          <h2 className="text-[20px] font-semibold text-[hsl(220_13%_18%)] mb-1">Queue is clear</h2>
          <p className="text-[14px] text-[hsl(215_16%_47%)]">No engagements are waiting for legal review.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: "20%" }}>HCP Name</TableHead>
              <TableHead style={{ width: "16%" }}>Engagement Type</TableHead>
              <TableHead style={{ width: "11%" }}>Proposed Date</TableHead>
              <TableHead style={{ width: "10%" }}>Compensation</TableHead>
              <TableHead style={{ width: "14%" }}>Submitted By</TableHead>
              <TableHead style={{ width: "13%" }}>Referred to Legal</TableHead>
              <TableHead style={{ width: "16%" }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {engagements.map((engagement) => (
              <TableRow key={engagement.id}>
                <TableCell className="font-medium">{engagement.hcp.fullName}</TableCell>
                <TableCell>{ENGAGEMENT_TYPE_LABELS[engagement.engagementType] ?? engagement.engagementType}</TableCell>
                <TableCell>{format(new Date(engagement.proposedDate), "MMM d, yyyy")}</TableCell>
                <TableCell>${parseFloat(engagement.agreedRateUsd.toString()).toFixed(2)}</TableCell>
                <TableCell>{engagement.submittedByName}</TableCell>
                <TableCell>{formatDistanceToNow(new Date(engagement.updatedAt), { addSuffix: true })}</TableCell>
                <TableCell>
                  <Link
                    href={`/engagements/${engagement.id}`}
                    className="text-[hsl(270_60%_55%)] hover:underline text-[14px] font-medium"
                  >
                    Review &amp; Submit Feedback
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
