/**
 * Wave 0 test stubs for actions/engagement.ts
 * RED state: actions/engagement.ts does not exist yet — implemented in Plan 03 (engagement-form wave)
 * Requirements: ENG-01, ENG-02, ENG-03
 */

describe("submitEngagement (ENG-02)", () => {
  it.todo("transitions engagement from draft to submitted when called by the submitter");
  it.todo("returns error when engagement is not in draft state (updateMany returns count=0)");
  it.todo("creates an EngagementStatusHistory record with actorClerkId and actorName");
});

describe("approveEngagement (ENG-02, ENG-03)", () => {
  it.todo("transitions engagement from submitted to approved when called by compliance or finance user");
  it.todo("returns error when engagement is not in submitted state");
  it.todo("returns error when called by a business user (role guard)");
  it.todo("sets reviewedByClerkId, reviewedByName, and reviewedAt on the engagement record");
});

describe("rejectEngagement (ENG-02, ENG-03)", () => {
  it.todo("transitions engagement from submitted to rejected with a rejection reason");
  it.todo("returns error when rejection reason is less than 10 characters");
  it.todo("returns error when engagement is not in submitted state");
  it.todo("stores rejectionReason on the engagement record");
});

describe("completeEngagement (ENG-02, ENG-03)", () => {
  it.todo("transitions engagement from approved to completed when called by the original submitter");
  it.todo("returns error when engagement is not in approved state");
  it.todo("returns error when called by a user who did not submit the engagement");
});

describe("business user ownership guard (ENG-01 — Pitfall 5)", () => {
  it.todo("returns 404 (not 403) when a business user tries to access another user's engagement");
  it.todo("allows a business user to access their own engagement");
});
