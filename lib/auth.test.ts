import { getEffectiveRoles, canAccessRoute } from "./auth";

describe("getEffectiveRoles", () => {
  it("returns primary role only when no grants", () => {
    expect(getEffectiveRoles({ role: "compliance", grants: [] })).toEqual(["compliance"]);
  });

  it("returns union of primary role and granted roles", () => {
    const result = getEffectiveRoles({ role: "compliance", grants: ["business", "finance"] });
    expect(result).toContain("compliance");
    expect(result).toContain("business");
    expect(result).toContain("finance");
    expect(result).toHaveLength(3);
  });

  it("returns business role only when no grants", () => {
    expect(getEffectiveRoles({ role: "business", grants: [] })).toEqual(["business"]);
  });

  it("returns empty array when role is undefined", () => {
    expect(getEffectiveRoles({ role: undefined, grants: [] })).toEqual([]);
  });
});

describe("canAccessRoute", () => {
  it("allows business user to access /hcps", () => {
    expect(canAccessRoute({ effectiveRoles: ["business"], route: "/hcps" })).toBe(true);
  });

  it("denies finance user access to /hcps", () => {
    expect(canAccessRoute({ effectiveRoles: ["finance"], route: "/hcps" })).toBe(false);
  });

  it("allows finance user access to /dashboard", () => {
    expect(canAccessRoute({ effectiveRoles: ["finance"], route: "/dashboard" })).toBe(true);
  });

  it("allows expanded compliance user (with business grant) access to /hcps", () => {
    expect(canAccessRoute({ effectiveRoles: ["compliance", "business"], route: "/hcps" })).toBe(true);
  });

  it("allows nested routes under /hcps for business role", () => {
    expect(canAccessRoute({ effectiveRoles: ["business"], route: "/hcps/abc123" })).toBe(true);
  });
});
