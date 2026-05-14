/**
 * Tests for app/api/engagements/[id]/invoice/route.ts
 * Requirements: CONT-02, CONT-03
 * Wave 0 — these tests FAIL until the route handler is created in Wave 2.
 *
 * Strategy: Mock Prisma, Clerk auth, and R2 client.
 * Test role gating, idempotency (unique constraint → 409), and happy path.
 */

// These tests are skipped at Wave 0 (module doesn't exist yet).
// Wave 2 implementation will un-skip and implement full mocks.
describe.skip("POST /api/engagements/[id]/invoice", () => {
  it("returns 401 when called without authentication", () => {
    // Implement in Wave 2 after route.ts is created
    expect(true).toBe(true);
  });
  it("returns 403 when called by a non-compliance role (finance or business)", () => {
    // Implement in Wave 2
    expect(true).toBe(true);
  });
  it("returns 409 when invoice already exists for the engagement (P2002 unique constraint)", () => {
    // Implement in Wave 2
    expect(true).toBe(true);
  });
  it("returns 400 when engagement status is not completed", () => {
    // Implement in Wave 2
    expect(true).toBe(true);
  });
  it("returns 400 when popDocumentUrl is not set", () => {
    // Implement in Wave 2
    expect(true).toBe(true);
  });
  it("returns 200 with storageUrl on successful invoice generation", () => {
    // Implement in Wave 2
    expect(true).toBe(true);
  });
});
