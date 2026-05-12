/**
 * Wave 0 test stubs for actions/fmv.ts
 * RED state: actions/fmv.ts does not exist yet — implemented in Plan 02 (fmv-upload wave)
 * Requirements: FMV-03
 * Note: Tests will use a mocked Prisma client when implemented
 */

describe("activateRateCard (FMV-03)", () => {
  it.todo("sets the target rate card status from 'pending' to 'active' and sets effectiveFrom to current time");
  it.todo("sets the previously active rate card status to 'superseded' and sets effectiveTo to current time");
  it.todo("performs the close-prior + activate-new as a single atomic Prisma $transaction (race-safe)");
  it.todo("throws an error when the target rate card is not in 'pending' state (updateMany returns count=0)");
  it.todo("does not fail when there is no prior active card (first activation)");
});

describe("parseRateCardAction (FMV-01, FMV-02)", () => {
  it.todo("returns parsed rows with NUCC validation status per row");
  it.todo("returns hasErrors=true when any row has nuccValid=false");
  it.todo("returns hasErrors=false when all rows have nuccValid=true");
  it.todo("returns error when no file is provided in FormData");
});
