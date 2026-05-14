import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EngagementStatusBadge } from "@/components/engagement/EngagementStatusBadge";
import type { EngagementStatusValue } from "@/components/engagement/EngagementStatusBadge";
import { ActionPanel } from "@/components/engagement/ActionPanel";
import { ENGAGEMENT_TYPE_LABELS } from "@/components/engagement/EngagementTable";
import { DebarmentCheckPanel } from "@/components/hcp/DebarmentCheckPanel";
import { getFmvRate } from "@/lib/fmv-lookup";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const engagement = await prisma.engagement.findUnique({
    where: { id },
    include: { hcp: { select: { fullName: true } } },
  });
  if (!engagement) return { title: "Engagement Not Found — HCP Engage" };
  return {
    title: `${ENGAGEMENT_TYPE_LABELS[engagement.engagementType] ?? engagement.engagementType} — ${engagement.hcp.fullName} — HCP Engage`,
  };
}

export default async function EngagementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) notFound();

  // Role resolution (same pattern as hcps/[id]/page.tsx)
  const role = (user.publicMetadata as { role?: string }).role;
  const userGrant = await prisma.userGrant.findUnique({
    where: { clerkUserId: user.id },
  });
  const effectiveRoles = getEffectiveRoles({
    role,
    grants: userGrant?.grantedRoles ?? [],
  });
  const isBusinessRole =
    effectiveRoles.includes("business") &&
    !effectiveRoles.includes("compliance") &&
    !effectiveRoles.includes("finance");
  const isCompliance = effectiveRoles.includes("compliance");

  const engagement = await prisma.engagement.findUnique({
    where: { id },
    include: {
      hcp: {
        select: {
          id: true,
          fullName: true,
          npi: true,
          nuccCode: true,
          nuccDisplayName: true,
          primaryState: true,
          debarmentCheckedAt: true,
          debarmentChecks: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              oigHit: true,
              samHit: true,
              oigMatchJson: true,
              samMatchJson: true,
              createdAt: true,
              determination: {
                select: {
                  outcome: true,
                  rationale: true,
                  recordedByName: true,
                  createdAt: true,
                  checkId: true,
                },
              },
            },
          },
        },
      },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!engagement) notFound();

  const isLegal = effectiveRoles.includes("legal");

  // Business user ownership check — returns 404 to avoid leaking existence (Pitfall 5, T-02-05-05)
  // Legal users can view all engagements assigned for legal review
  if (isBusinessRole && !isLegal && engagement.submittedByClerkId !== user.id) notFound();

  // FMV rate lookup — non-blocking; null means no active card or no matching rate
  const fmvRate = await getFmvRate({
    nuccCode: engagement.hcp.nuccCode,
    state: engagement.hcp.primaryState,
    engagementType: engagement.engagementType,
    prisma,
  }).catch(() => null);

  // Serialize Decimal for display
  const agreedRateDisplay = parseFloat(engagement.agreedRateUsd.toString()).toFixed(2);
  const proposedDateDisplay = format(new Date(engagement.proposedDate), "MMM d, yyyy");
  const engagementTypeLabel = ENGAGEMENT_TYPE_LABELS[engagement.engagementType] ?? engagement.engagementType;

  return (
    <div className="flex gap-8">
      {/* Left column (65%) */}
      <div className="flex-[65] min-w-0 space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/engagements"
            className="text-[12px] text-[hsl(215_16%_47%)] hover:underline"
          >
            ← Engagements
          </Link>
          <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)] mt-1 leading-[1.2]">
            {engagementTypeLabel}
          </h1>
          <p className="text-[14px] text-[hsl(215_16%_47%)] mt-0.5">
            {engagement.hcp.fullName}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <EngagementStatusBadge status={engagement.status as EngagementStatusValue} />
            <span className="text-[12px] text-[hsl(215_16%_47%)]">
              Updated {formatDistanceToNow(new Date(engagement.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Engagement Details card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[20px]">Engagement Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">HCP</dt>
                <dd className="mt-0.5">
                  {engagement.hcp.fullName}{" "}
                  <span className="text-[hsl(215_16%_47%)] font-mono text-[12px]">
                    NPI: {engagement.hcp.npi}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Engagement Type</dt>
                <dd className="mt-0.5">{engagementTypeLabel}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Proposed Date</dt>
                <dd className="mt-0.5">{proposedDateDisplay}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Compensation</dt>
                <dd className="mt-0.5">${agreedRateDisplay}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">
                  Description / Scope of Work
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{engagement.description}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Debarment Status card — compliance only */}
        {isCompliance && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[20px]">Debarment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <DebarmentCheckPanel
                hcpId={engagement.hcp.id}
                isCompliance={true}
                initialCheck={
                  engagement.hcp.debarmentChecks[0]
                    ? {
                        ...engagement.hcp.debarmentChecks[0],
                        oigMatchJson: engagement.hcp.debarmentChecks[0].oigMatchJson as Record<string, unknown> | null,
                        samMatchJson: engagement.hcp.debarmentChecks[0].samMatchJson as Record<string, unknown> | null,
                      }
                    : null
                }
                debarmentCheckedAt={engagement.hcp.debarmentCheckedAt}
              />
            </CardContent>
          </Card>
        )}

        {/* FMV Reference card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[20px]">FMV Reference</CardTitle>
          </CardHeader>
          <CardContent>
            {fmvRate ? (
              <div className="space-y-1">
                <p className="text-[12px] text-[hsl(215_16%_47%)]">
                  {fmvRate.nuccDisplayName} / {ENGAGEMENT_TYPE_LABELS[fmvRate.engagementType] ?? fmvRate.engagementType} / {fmvRate.state ?? "National"}
                </p>
                <p className="text-[14px] font-medium text-[hsl(220_13%_18%)]">
                  ${Number(fmvRate.rateUsd).toFixed(2)}{" "}
                  <span className="text-[hsl(215_16%_47%)] font-normal">
                    {fmvRate.rateUnit.replace(/_/g, " ")}
                  </span>
                </p>
                <p className="text-[12px] text-[hsl(215_16%_47%)] italic">
                  Shown for reference only. Not enforced at submission.
                </p>
              </div>
            ) : (
              <p className="text-[14px] text-[hsl(215_16%_47%)]">
                No FMV rate on file for this specialty and engagement type.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Proof of Performance card — shown once PoP is attached */}
        {engagement.popDocumentUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[20px]">Proof of Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[12px] text-[hsl(215_16%_47%)] mb-1">Document Reference</p>
              {engagement.popDocumentUrl.startsWith("/api/engagements/pop-file/") ? (
                <a
                  href={engagement.popDocumentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-[hsl(221_83%_53%)] hover:underline break-words"
                >
                  View attached file ↗
                </a>
              ) : (
                <p className="text-[14px] text-[hsl(220_13%_18%)] break-words">
                  {engagement.popDocumentUrl}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status History card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[20px]">Status History</CardTitle>
          </CardHeader>
          <CardContent>
            {engagement.statusHistory.length === 0 ? (
              <p className="text-[14px] text-[hsl(215_16%_47%)]">
                No status history recorded.
              </p>
            ) : (
              <ol className="space-y-3">
                {engagement.statusHistory.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <EngagementStatusBadge status={entry.status as EngagementStatusValue} />
                      <span className="text-[14px] text-[hsl(220_13%_18%)]">
                        {entry.actorName}
                      </span>
                      <span className="text-[12px] text-[hsl(215_16%_47%)]">
                        {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    {entry.reason && (
                      <p className="text-[12px] text-[hsl(215_16%_47%)] ml-1 italic">
                        Reason: {entry.reason}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Rejection Reason callout — only when status = rejected and rejectionReason is set */}
        {engagement.status === "rejected" && engagement.rejectionReason && (
          <div className="border border-[hsl(38_92%_50%)] rounded-lg p-4 bg-[hsl(38_92%_97%)]">
            <p className="text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
              Rejection Reason
            </p>
            <p className="text-[14px] text-[hsl(220_13%_18%)]">
              {engagement.rejectionReason}
            </p>
          </div>
        )}
      </div>

      {/* Right column (35%) */}
      <div className="flex-[35] min-w-0">
        <ActionPanel
          engagementId={engagement.id}
          status={engagement.status as EngagementStatusValue}
          submittedByClerkId={engagement.submittedByClerkId}
          currentUserClerkId={user.id}
          effectiveRoles={effectiveRoles}
          rejectionReason={engagement.rejectionReason}
          popDocumentUrl={engagement.popDocumentUrl}
        />
      </div>
    </div>
  );
}
