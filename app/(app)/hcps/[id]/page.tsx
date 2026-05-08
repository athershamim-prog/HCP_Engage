import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HcpStatusBadge, HcpStatusValue } from "@/components/hcp/HcpStatusBadge";
import { DebarmentBadge, DebarmentStatusValue } from "@/components/hcp/DebarmentBadge";
import { DebarmentCheckPanel } from "@/components/hcp/DebarmentCheckPanel";
import { StatusHistoryTimeline } from "@/components/hcp/StatusHistoryTimeline";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hcp = await prisma.hcp.findUnique({
    where: { id },
    select: { fullName: true },
  });
  return {
    title: hcp
      ? `${hcp.fullName} — HCP Engage`
      : "HCP Not Found — HCP Engage",
  };
}

export default async function HcpProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
  const isCompliance = effectiveRoles.includes("compliance");

  // Fetch full HCP data with relations
  const hcp = await prisma.hcp.findUnique({
    where: { id },
    include: {
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
      debarmentChecks: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { determination: true },
      },
    },
  });

  if (!hcp) notFound();

  const latestCheck = hcp.debarmentChecks[0] ?? null;

  return (
    <div className="flex gap-8">
      {/* Left column (65%) */}
      <div className="flex-[65] min-w-0 space-y-6">
        {/* Profile header */}
        <div>
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-[28px] font-semibold text-[hsl(220_13%_18%)] leading-[1.15]">
              {hcp.fullName}
            </h1>
            {hcp.credentials && (
              <span className="text-[12px] text-[hsl(215_16%_47%)] mt-2 font-semibold">
                {hcp.credentials}
              </span>
            )}
          </div>
          <p className="font-mono text-[12px] text-[hsl(215_16%_47%)] mt-1">
            NPI: {hcp.npi}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <HcpStatusBadge status={hcp.status as HcpStatusValue} />
            <DebarmentBadge status={hcp.debarmentStatus as DebarmentStatusValue} />
          </div>
        </div>

        {/* NPPES Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[20px]">Verified HCP Data</CardTitle>
            <p className="text-[12px] text-[hsl(215_16%_47%)]">
              Source: NPPES — pulled {format(new Date(hcp.createdAt), "MMM d, yyyy")}
            </p>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">
                  NUCC Specialty
                </dt>
                <dd className="mt-0.5">
                  {hcp.nuccDisplayName}{" "}
                  <span className="text-[hsl(215_16%_47%)]">({hcp.nuccCode})</span>
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">
                  Primary State
                </dt>
                <dd className="mt-0.5">{hcp.primaryState || "—"}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">
                  HCO Affiliation
                </dt>
                <dd className="mt-0.5">
                  {hcp.hcoAffiliation ?? (
                    <span className="text-[hsl(215_16%_47%)]">
                      No affiliation on record
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">
                  Credentials
                </dt>
                <dd className="mt-0.5">{hcp.credentials ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Debarment Check */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[20px]">Debarment Check</CardTitle>
          </CardHeader>
          <CardContent>
            <DebarmentCheckPanel
              hcpId={hcp.id}
              isCompliance={isCompliance}
              initialCheck={
                latestCheck
                  ? {
                      id: latestCheck.id,
                      oigHit: latestCheck.oigHit,
                      samHit: latestCheck.samHit,
                      oigMatchJson:
                        latestCheck.oigMatchJson as Record<string, unknown> | null,
                      samMatchJson:
                        latestCheck.samMatchJson as Record<string, unknown> | null,
                      createdAt: latestCheck.createdAt,
                      determination: latestCheck.determination
                        ? {
                            outcome: latestCheck.determination
                              .outcome as
                              | "cleared"
                              | "confirmed_exclusion"
                              | "false_positive",
                            rationale: latestCheck.determination.rationale,
                            recordedByName:
                              latestCheck.determination.recordedByName,
                            createdAt: latestCheck.determination.createdAt,
                            checkId: latestCheck.determination.checkId,
                          }
                        : null,
                    }
                  : null
              }
              debarmentCheckedAt={hcp.debarmentCheckedAt}
            />
          </CardContent>
        </Card>

        {/* Status History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[20px]">Status History</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusHistoryTimeline entries={hcp.statusHistory} />
          </CardContent>
        </Card>
      </div>

      {/* Right sidebar (35%) */}
      <div className="flex-[35] min-w-0 space-y-4">
        {/* Set HCP Status — Compliance only (Plan 04 implements this panel) */}
        {isCompliance && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[20px]">Set HCP Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[14px] text-[hsl(215_16%_47%)]">
                Status management panel — implemented in next plan.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quick Facts — both roles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[20px]">Quick Facts</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-[14px]">
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">
                  Date Added
                </dt>
                <dd className="mt-0.5">
                  {format(new Date(hcp.createdAt), "MMM d, yyyy")}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">
                  Added By
                </dt>
                <dd className="mt-0.5">{hcp.addedByName}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">
                  HCP Record ID
                </dt>
                <dd className="mt-0.5 font-mono text-[12px] text-[hsl(215_16%_47%)]">
                  {hcp.id}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
