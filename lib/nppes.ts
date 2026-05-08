export interface NppesHcp {
  npi: string;
  firstName: string;
  lastName: string;
  fullName: string;
  credentials: string | null;
  nuccCode: string;
  nuccDisplayName: string;
  primaryState: string;
  hcoAffiliation: string | null;
}

export function validateNpi(npi: string): boolean {
  return /^\d{10}$/.test(npi);
}

// Maps NPPES API response to our internal NppesHcp type.
// NPPES API docs: https://npiregistry.cms.hhs.gov/api-page
// Response structure: { results: Array<{ number, basic, taxonomies, addresses, ... }> }
export function mapNppesResult(apiResult: Record<string, unknown>): NppesHcp {
  const basic = apiResult.basic as Record<string, string> | undefined;
  const taxonomies = apiResult.taxonomies as Array<{ code: string; desc: string; primary: boolean }> | undefined;
  const addresses = apiResult.addresses as Array<{ state: string; address_purpose: string }> | undefined;

  // Full name
  const firstName = basic?.first_name ?? basic?.authorized_official_first_name ?? "";
  const lastName = basic?.last_name ?? basic?.authorized_official_last_name ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") ||
    (basic?.organization_name ?? "Unknown");

  // Credentials: from basic.credential (e.g., "M.D.") — normalize to "MD"
  const rawCredential = basic?.credential ?? "";
  const credentials = rawCredential.replace(/\./g, "").trim() || null;

  // NUCC taxonomy — use the primary taxonomy or first available
  const primaryTaxonomy = taxonomies?.find((t) => t.primary) ?? taxonomies?.[0];
  const nuccCode = primaryTaxonomy?.code ?? "";
  const nuccDisplayName = primaryTaxonomy?.desc ?? "Unknown Specialty";

  // Primary state — use "LOCATION" address if available, else first address
  const locationAddress = addresses?.find((a) => a.address_purpose === "LOCATION") ?? addresses?.[0];
  const primaryState = locationAddress?.state ?? "";

  // HCO affiliation — NPPES does not have a direct "HCO affiliation" field.
  // Use organization_name from basic if this is an individual with an org association,
  // or check if the NPI belongs to an organization subpart.
  // For v1: use basic.organization_name if present, else null.
  const hcoAffiliation = basic?.organization_name ?? null;

  return {
    npi: String(apiResult.number ?? ""),
    firstName,
    lastName,
    fullName,
    credentials,
    nuccCode,
    nuccDisplayName,
    primaryState,
    hcoAffiliation,
  };
}

export async function fetchNppesHcp(npi: string): Promise<NppesHcp | null> {
  if (!validateNpi(npi)) throw new Error("Invalid NPI format");

  const url = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&enumeration_type=&taxonomy_description=&name_purpose=&first_name=&use_first_name_alias=&last_name=&organization_name=&address_purpose=&city=&state=&postal_code=&country_code=&limit=1&skip=0&pretty=&version=2.1`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 }, // No caching — NPI lookups must be fresh
  });

  if (!res.ok) throw new Error(`NPPES API error: ${res.status}`);

  const data = await res.json() as { result_count: number; results: Array<Record<string, unknown>> };

  if (data.result_count === 0 || !data.results?.length) return null;

  return mapNppesResult(data.results[0]);
}
