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
