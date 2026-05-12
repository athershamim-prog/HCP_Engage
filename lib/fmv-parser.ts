/**
 * Pure utility — no "use server", no Prisma/Clerk imports.
 * Provides SheetJS-based rate card parsing and NUCC taxonomy validation.
 * Requirements: FMV-01, FMV-02
 */

import * as XLSX from "xlsx";

export interface ParsedRateRow {
  specialty_code: string;
  state: string | null;
  engagement_type: string;
  rate_usd: number;
  rate_unit: string;
  rowIndex: number;
}

export interface ValidatedRateRow extends ParsedRateRow {
  nuccValid: boolean;
  nuccDisplayName: string | null;
}

/**
 * Parses an Excel/CSV buffer and returns one ParsedRateRow per data row.
 * Uses SheetJS XLSX.read with type:"buffer"; normalizes values per spec.
 * - specialty_code → toUpperCase().trim()
 * - state → toUpperCase().trim() or null if blank
 * - engagement_type → toLowerCase().trim()
 * - rate_usd → parseFloat
 * - rowIndex → 1-based row number (row 1 is header, so first data row is 2)
 */
export function parseRateCardBuffer(buffer: Buffer): ParsedRateRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: false, // coerce all values to strings; prevents formula injection
  });

  return rawRows.map((row, i) => ({
    specialty_code: String(row["specialty_code"] ?? "").trim().toUpperCase(),
    state: row["state"] ? String(row["state"]).trim().toUpperCase() || null : null,
    engagement_type: String(row["engagement_type"] ?? "").trim().toLowerCase(),
    rate_usd: parseFloat(String(row["rate_usd"] ?? "0")),
    rate_unit: String(row["rate_unit"] ?? "").trim().toLowerCase(),
    rowIndex: i + 2, // 1-based: row 1 is header, first data row is row 2
  }));
}

/**
 * Validates parsed rows against a NUCC taxonomy map.
 * Pure function — no DB calls; the taxonomy map is passed in by the caller.
 * Returns ValidatedRateRow[] with nuccValid and nuccDisplayName for each row.
 */
export function validateNuccCodes(
  rows: ParsedRateRow[],
  taxonomyMap: Map<string, string>
): ValidatedRateRow[] {
  return rows.map((row) => {
    const displayName = taxonomyMap.get(row.specialty_code) ?? null;
    return {
      ...row,
      nuccValid: displayName !== null,
      nuccDisplayName: displayName,
    };
  });
}
