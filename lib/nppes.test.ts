import { validateNpi, mapNppesResult, NppesHcp } from "./nppes";

const validApiResponse = {
  number: "1234567890",
  basic: {
    first_name: "Jane",
    last_name: "Smith",
    credential: "M.D.",
  },
  taxonomies: [
    { code: "207R00000X", desc: "Internal Medicine", primary: true },
  ],
  addresses: [
    { state: "CA", address_purpose: "LOCATION" },
  ],
};

describe("validateNpi", () => {
  it("returns true for 10-digit numeric NPI", () => {
    expect(validateNpi("1234567890")).toBe(true);
  });
  it("returns false for NPI with fewer than 10 digits", () => {
    expect(validateNpi("123")).toBe(false);
  });
  it("returns false for NPI with non-numeric characters", () => {
    expect(validateNpi("12345abcde")).toBe(false);
  });
});

describe("mapNppesResult", () => {
  it("maps valid API response to NppesHcp", () => {
    const result = mapNppesResult(validApiResponse);
    expect(result.npi).toBe("1234567890");
    expect(result.fullName).toBe("Jane Smith");
    expect(result.credentials).toBe("MD");
    expect(result.nuccCode).toBe("207R00000X");
    expect(result.nuccDisplayName).toBe("Internal Medicine");
    expect(result.primaryState).toBe("CA");
  });

  it("returns Unknown Specialty when no taxonomy", () => {
    const noTaxonomy = { ...validApiResponse, taxonomies: [] };
    const result = mapNppesResult(noTaxonomy);
    expect(result.nuccCode).toBe("");
    expect(result.nuccDisplayName).toBe("Unknown Specialty");
  });

  it("returns null hcoAffiliation when no organization_name", () => {
    const result = mapNppesResult(validApiResponse);
    expect(result.hcoAffiliation).toBeNull();
  });

  it("extracts credentials without dots", () => {
    const result = mapNppesResult(validApiResponse);
    expect(result.credentials).toBe("MD");
  });
});
