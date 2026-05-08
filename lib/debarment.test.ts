import { normalizeName, matchOigRecord, matchSamRecord } from "./debarment";

const oigRecordWithNpi = {
  npi: "1234567890",
  lastName: "SMITH",
  firstName: "JOHN",
};

const samRecordWithNpi = {
  npi: "1122334455",
  lastName: "JOHNSON",
  firstName: "ROBERT",
  name: "JOHNSON ROBERT",
};

describe("normalizeName", () => {
  it("uppercases a name", () => {
    expect(normalizeName("Smith")).toBe("SMITH");
  });
  it("trims and uppercases", () => {
    expect(normalizeName("  smith  ")).toBe("SMITH");
  });
});

describe("matchOigRecord", () => {
  it("returns true when NPI matches", () => {
    expect(
      matchOigRecord(
        { npi: "1234567890", lastName: "SMITH", firstName: "JOHN" },
        oigRecordWithNpi
      )
    ).toBe(true);
  });

  it("returns false when NPI does not match", () => {
    expect(
      matchOigRecord(
        { npi: "9999999999", lastName: "SMITH", firstName: "JOHN" },
        oigRecordWithNpi
      )
    ).toBe(false);
  });

  it("returns true on name match when no NPI in record", () => {
    const recordNoNpi = { npi: null, lastName: "SMITH", firstName: "JOHN" };
    expect(
      matchOigRecord({ npi: null, lastName: "SMITH", firstName: "JOHN" }, recordNoNpi)
    ).toBe(true);
  });

  it("returns false on name mismatch when no NPI", () => {
    const recordNoNpi = { npi: null, lastName: "SMITH", firstName: "JOHN" };
    expect(
      matchOigRecord({ npi: null, lastName: "JONES", firstName: "BOB" }, recordNoNpi)
    ).toBe(false);
  });
});

describe("matchSamRecord", () => {
  it("returns true when NPI matches", () => {
    expect(
      matchSamRecord(
        { npi: "1122334455", lastName: "JOHNSON", firstName: "ROBERT" },
        samRecordWithNpi
      )
    ).toBe(true);
  });

  it("returns false when NPI does not match", () => {
    expect(
      matchSamRecord(
        { npi: "9999999999", lastName: "JOHNSON", firstName: "ROBERT" },
        samRecordWithNpi
      )
    ).toBe(false);
  });
});
