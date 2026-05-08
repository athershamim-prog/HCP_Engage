import { prisma } from "@/lib/prisma";

export interface DebarmentResult {
  oigHit: boolean;
  samHit: boolean;
  oigMatch: {
    lastName: string;
    firstName: string | null;
    npi: string | null;
    exclusionType: string;
    exclusionDate: string;
    specialty: string | null;
    state: string | null;
  } | null;
  samMatch: {
    name: string;
    firstName: string | null;
    lastName: string | null;
    npi: string | null;
    exclusionType: string;
    activationDate: string;
    stateOrProvince: string | null;
  } | null;
}

export function normalizeName(name: string): string {
  return name.trim().toUpperCase();
}

export function matchOigRecord(
  hcp: { npi: string | null; lastName: string; firstName: string },
  record: { npi: string | null; lastName: string; firstName: string | null }
): boolean {
  // NPI match takes priority — if both have NPI, must match
  if (hcp.npi && record.npi) {
    return hcp.npi === record.npi;
  }
  // Fall back to name matching (both last AND first name, normalized)
  const lastMatch = normalizeName(hcp.lastName) === normalizeName(record.lastName);
  const firstMatch =
    record.firstName === null ||
    normalizeName(hcp.firstName) === normalizeName(record.firstName);
  return lastMatch && firstMatch;
}

export function matchSamRecord(
  hcp: { npi: string | null; lastName: string; firstName: string },
  record: {
    npi: string | null;
    lastName: string | null;
    firstName: string | null;
    name: string;
  }
): boolean {
  if (hcp.npi && record.npi) {
    return hcp.npi === record.npi;
  }
  if (record.lastName && record.firstName) {
    return (
      normalizeName(hcp.lastName) === normalizeName(record.lastName) &&
      normalizeName(hcp.firstName) === normalizeName(record.firstName)
    );
  }
  // Last resort: check if name field contains last name
  return normalizeName(record.name).includes(normalizeName(hcp.lastName));
}

/**
 * Runs debarment check for an HCP against local OIG LEIE and SAM.gov tables.
 * D-11b: Local pre-seeded tables only in v1. No live external API calls.
 */
export async function runDebarmentCheck(hcp: {
  npi: string;
  lastName: string;
  firstName: string;
}): Promise<DebarmentResult> {
  // Query OIG LEIE — search by NPI first, then by last name as fallback
  const oigCandidates = await prisma.oigLeieRecord.findMany({
    where: {
      OR: [
        { npi: hcp.npi },
        { lastName: { equals: hcp.lastName.toUpperCase(), mode: "insensitive" } },
      ],
    },
  });

  const oigMatchRecord = oigCandidates.find((r) =>
    matchOigRecord(
      { npi: hcp.npi, lastName: hcp.lastName, firstName: hcp.firstName },
      { npi: r.npi ?? null, lastName: r.lastName, firstName: r.firstName ?? null }
    )
  );

  // Query SAM.gov — search by NPI first, then by last name as fallback
  const samCandidates = await prisma.samGovRecord.findMany({
    where: {
      AND: [
        { recordStatus: "Active" },
        {
          OR: [
            { npi: hcp.npi },
            { lastName: { equals: hcp.lastName.toUpperCase(), mode: "insensitive" } },
            { name: { contains: hcp.lastName.toUpperCase(), mode: "insensitive" } },
          ],
        },
      ],
    },
  });

  const samMatchRecord = samCandidates.find((r) =>
    matchSamRecord(
      { npi: hcp.npi, lastName: hcp.lastName, firstName: hcp.firstName },
      {
        npi: r.npi ?? null,
        lastName: r.lastName ?? null,
        firstName: r.firstName ?? null,
        name: r.name,
      }
    )
  );

  return {
    oigHit: !!oigMatchRecord,
    samHit: !!samMatchRecord,
    oigMatch: oigMatchRecord
      ? {
          lastName: oigMatchRecord.lastName,
          firstName: oigMatchRecord.firstName ?? null,
          npi: oigMatchRecord.npi ?? null,
          exclusionType: oigMatchRecord.exclusionType,
          exclusionDate: oigMatchRecord.exclusionDate,
          specialty: oigMatchRecord.specialty ?? null,
          state: oigMatchRecord.state ?? null,
        }
      : null,
    samMatch: samMatchRecord
      ? {
          name: samMatchRecord.name,
          firstName: samMatchRecord.firstName ?? null,
          lastName: samMatchRecord.lastName ?? null,
          npi: samMatchRecord.npi ?? null,
          exclusionType: samMatchRecord.exclusionType,
          activationDate: samMatchRecord.activationDate,
          stateOrProvince: samMatchRecord.stateOrProvince ?? null,
        }
      : null,
  };
}
