/**
 * Tests for lib/fmv-parser.ts
 * Requirements: FMV-01, FMV-02
 */

import * as XLSX from "xlsx";
import { parseRateCardBuffer, validateNuccCodes } from "@/lib/fmv-parser";

function makeBuffer(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

const HEADER = ["specialty_code", "state", "engagement_type", "rate_usd", "rate_unit"];

describe("parseRateCardBuffer", () => {
  it("parses a valid CSV buffer and returns one ParsedRateRow per data row", () => {
    const buf = makeBuffer([HEADER, ["207Q00000X", "CA", "advisory_board", "350.00", "per_hour"]]);
    const rows = parseRateCardBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].specialty_code).toBe("207Q00000X");
  });

  it("normalizes specialty_code to uppercase (e.g. '207q00000x' becomes '207Q00000X')", () => {
    const buf = makeBuffer([HEADER, ["207q00000x", "CA", "advisory_board", "350.00", "per_hour"]]);
    const rows = parseRateCardBuffer(buf);
    expect(rows[0].specialty_code).toBe("207Q00000X");
  });

  it("sets state to null when the state column is blank", () => {
    const buf = makeBuffer([HEADER, ["207Q00000X", "", "advisory_board", "350.00", "per_hour"]]);
    const rows = parseRateCardBuffer(buf);
    expect(rows[0].state).toBeNull();
  });

  it("sets rowIndex to 2 for the first data row (row 1 is the header)", () => {
    const buf = makeBuffer([HEADER, ["207Q00000X", "CA", "advisory_board", "350.00", "per_hour"]]);
    const rows = parseRateCardBuffer(buf);
    expect(rows[0].rowIndex).toBe(2);
  });

  it("parses rate_usd as a number (not string)", () => {
    const buf = makeBuffer([HEADER, ["207Q00000X", "CA", "advisory_board", "350.50", "per_hour"]]);
    const rows = parseRateCardBuffer(buf);
    expect(typeof rows[0].rate_usd).toBe("number");
    expect(rows[0].rate_usd).toBeCloseTo(350.50);
  });

  it("returns empty array for a buffer with only a header row", () => {
    const buf = makeBuffer([HEADER]);
    const rows = parseRateCardBuffer(buf);
    expect(rows).toHaveLength(0);
  });

  it("normalizes engagement_type to lowercase", () => {
    const buf = makeBuffer([HEADER, ["207Q00000X", "CA", "ADVISORY_BOARD", "350.00", "per_hour"]]);
    const rows = parseRateCardBuffer(buf);
    expect(rows[0].engagement_type).toBe("advisory_board");
  });
});

describe("NUCC validation (validateNuccCodes)", () => {
  const taxonomyMap = new Map([["207Q00000X", "Family Medicine"]]);

  it("marks a row as nuccValid=true when the code exists in the provided NuccTaxonomy map", () => {
    const row = { specialty_code: "207Q00000X", state: "CA", engagement_type: "advisory_board", rate_usd: 350, rate_unit: "per_hour", rowIndex: 2 };
    const [validated] = validateNuccCodes([row], taxonomyMap);
    expect(validated.nuccValid).toBe(true);
  });

  it("marks a row as nuccValid=false when the code is not in the NuccTaxonomy map", () => {
    const row = { specialty_code: "INVALID", state: null, engagement_type: "training", rate_usd: 100, rate_unit: "flat_fee", rowIndex: 2 };
    const [validated] = validateNuccCodes([row], taxonomyMap);
    expect(validated.nuccValid).toBe(false);
  });

  it("sets nuccDisplayName to the taxonomy displayName for valid rows", () => {
    const row = { specialty_code: "207Q00000X", state: "CA", engagement_type: "advisory_board", rate_usd: 350, rate_unit: "per_hour", rowIndex: 2 };
    const [validated] = validateNuccCodes([row], taxonomyMap);
    expect(validated.nuccDisplayName).toBe("Family Medicine");
  });

  it("sets nuccDisplayName to null for unrecognized rows", () => {
    const row = { specialty_code: "INVALID", state: null, engagement_type: "training", rate_usd: 100, rate_unit: "flat_fee", rowIndex: 2 };
    const [validated] = validateNuccCodes([row], taxonomyMap);
    expect(validated.nuccDisplayName).toBeNull();
  });
});
