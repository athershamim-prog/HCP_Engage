import { config } from "dotenv";
// Load .env.local first (Next.js convention for local secrets)
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // OIG LEIE dummy records
  await prisma.oigLeieRecord.createMany({
    data: [
      {
        lastName: "SMITH",
        firstName: "JOHN",
        npi: "1234567890",
        exclusionType: "1128a1",
        exclusionDate: "01/15/2020",
        specialty: "Internal Medicine",
        state: "CA",
      },
      {
        lastName: "DOE",
        firstName: "JANE",
        npi: "9876543210",
        exclusionType: "1128b4",
        exclusionDate: "06/01/2019",
        specialty: "Cardiology",
        state: "NY",
      },
      {
        lastName: "LASKOWSKI",
        firstName: "THOMAS",
        npi: "1003000126",
        exclusionType: "1128a1",
        exclusionDate: "03/20/2018",
        specialty: "Family Medicine",
        state: "IL",
      },
    ],
    skipDuplicates: true,
  });

  // SAM.gov dummy records
  await prisma.samGovRecord.createMany({
    data: [
      {
        classificationType: "Individual",
        exclusionType: "Ineligible (Proceedings Pending)",
        exclusionProgram: "Reciprocal",
        agencyName: "Department of Health and Human Services",
        name: "JOHNSON ROBERT",
        firstName: "ROBERT",
        lastName: "JOHNSON",
        npi: "1122334455",
        stateOrProvince: "TX",
        activationDate: "03/10/2021",
        recordStatus: "Active",
      },
    ],
    skipDuplicates: true,
  });

  // NuccTaxonomy — 25 pharma-relevant NUCC codes (fixture data for v1)
  // Full NUCC taxonomy v25.1 has ~900 codes; these cover common pharma engagement specialties.
  // Replace with full dataset after legal review of NUCC licensing for commercial use.
  const nuccFixture = [
    { code: "207Q00000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Family Medicine", specialization: null, displayName: "Family Medicine" },
    { code: "207R00000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Internal Medicine", specialization: null, displayName: "Internal Medicine" },
    { code: "207RC0000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Internal Medicine", specialization: "Cardiovascular Disease", displayName: "Internal Medicine — Cardiovascular Disease" },
    { code: "207RE0101X", grouping: "Allopathic & Osteopathic Physicians", classification: "Internal Medicine", specialization: "Endocrinology, Diabetes & Metabolism", displayName: "Internal Medicine — Endocrinology, Diabetes & Metabolism" },
    { code: "207RH0000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Internal Medicine", specialization: "Hematology", displayName: "Internal Medicine — Hematology" },
    { code: "207RN0300X", grouping: "Allopathic & Osteopathic Physicians", classification: "Internal Medicine", specialization: "Nephrology", displayName: "Internal Medicine — Nephrology" },
    { code: "207RP1001X", grouping: "Allopathic & Osteopathic Physicians", classification: "Internal Medicine", specialization: "Pulmonary Disease", displayName: "Internal Medicine — Pulmonary Disease" },
    { code: "207RR0500X", grouping: "Allopathic & Osteopathic Physicians", classification: "Internal Medicine", specialization: "Rheumatology", displayName: "Internal Medicine — Rheumatology" },
    { code: "207V00000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Obstetrics & Gynecology", specialization: null, displayName: "Obstetrics & Gynecology" },
    { code: "2084P0800X", grouping: "Allopathic & Osteopathic Physicians", classification: "Psychiatry & Neurology", specialization: "Psychiatry", displayName: "Psychiatry & Neurology — Psychiatry" },
    { code: "2084N0400X", grouping: "Allopathic & Osteopathic Physicians", classification: "Psychiatry & Neurology", specialization: "Neurology", displayName: "Psychiatry & Neurology — Neurology" },
    { code: "207W00000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Ophthalmology", specialization: null, displayName: "Ophthalmology" },
    { code: "207X00000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Orthopaedic Surgery", specialization: null, displayName: "Orthopaedic Surgery" },
    { code: "208600000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Surgery", specialization: null, displayName: "Surgery" },
    { code: "207L00000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Anesthesiology", specialization: null, displayName: "Anesthesiology" },
    { code: "207N00000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Dermatology", specialization: null, displayName: "Dermatology" },
    { code: "207P00000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Emergency Medicine", specialization: null, displayName: "Emergency Medicine" },
    { code: "208000000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Pediatrics", specialization: null, displayName: "Pediatrics" },
    { code: "208M00000X", grouping: "Allopathic & Osteopathic Physicians", classification: "Hospitalist", specialization: null, displayName: "Hospitalist" },
    { code: "208D00000X", grouping: "Allopathic & Osteopathic Physicians", classification: "General Practice", specialization: null, displayName: "General Practice" },
    { code: "363L00000X", grouping: "Physician Assistants & Advanced Practice Nursing Providers", classification: "Physician Assistant", specialization: null, displayName: "Physician Assistant" },
    { code: "363A00000X", grouping: "Physician Assistants & Advanced Practice Nursing Providers", classification: "Physician Assistant", specialization: "Medical", displayName: "Physician Assistant — Medical" },
    { code: "364S00000X", grouping: "Physician Assistants & Advanced Practice Nursing Providers", classification: "Clinical Nurse Specialist", specialization: null, displayName: "Clinical Nurse Specialist" },
    { code: "367500000X", grouping: "Physician Assistants & Advanced Practice Nursing Providers", classification: "Nurse Anesthetist, Certified Registered", specialization: null, displayName: "Nurse Anesthetist, Certified Registered" },
    { code: "374700000X", grouping: "Nursing Service Providers", classification: "Registered Nurse", specialization: null, displayName: "Registered Nurse" },
    { code: "376G00000X", grouping: "Nursing Service Providers", classification: "Nurse Practitioner", specialization: null, displayName: "Nurse Practitioner" },
    { code: "103T00000X", grouping: "Behavioral Health & Social Service Providers", classification: "Psychologist", specialization: null, displayName: "Psychologist" },
  ];

  await prisma.nuccTaxonomy.createMany({
    data: nuccFixture.map((row) => ({
      code: row.code.trim().toUpperCase(),
      grouping: row.grouping ?? null,
      classification: row.classification ?? null,
      specialization: row.specialization ?? null,
      displayName: row.displayName,
    })),
    skipDuplicates: true,
  });
  console.log(`NuccTaxonomy: seeded ${nuccFixture.length} records`);

  console.log("Seed complete: OIG LEIE and SAM.gov fixtures inserted.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
