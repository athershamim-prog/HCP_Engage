/**
 * Wave 0 test stubs for lib/fmv-parser.ts
 * RED state: fmv-parser.ts does not exist yet — implemented in Plan 02 (fmv-upload wave)
 * Requirements: FMV-01, FMV-02
 */

// Stubs use inline type definitions to avoid importing non-existent file
// Replace with import once lib/fmv-parser.ts exists in Plan 02

describe("parseRateCardBuffer", () => {
  it.todo("parses a valid CSV buffer and returns one ParsedRateRow per data row");
  it.todo("normalizes specialty_code to uppercase (e.g. '207q00000x' becomes '207Q00000X')");
  it.todo("sets state to null when the state column is blank");
  it.todo("sets rowIndex to 2 for the first data row (row 1 is the header)");
  it.todo("parses rate_usd as a number (not string)");
  it.todo("returns empty array for a buffer with only a header row");
  it.todo("normalizes engagement_type to lowercase");
});

describe("NUCC validation (validateNuccCodes)", () => {
  it.todo("marks a row as nuccValid=true when the code exists in the provided NuccTaxonomy map");
  it.todo("marks a row as nuccValid=false when the code is not in the NuccTaxonomy map");
  it.todo("sets nuccDisplayName to the taxonomy displayName for valid rows");
  it.todo("sets nuccDisplayName to null for unrecognized rows");
});
