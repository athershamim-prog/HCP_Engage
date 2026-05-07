import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

// Load .env.local first (Next.js convention for local secrets)
config({ path: ".env.local" });
// Fall back to .env for non-local environments
config({ path: ".env" });

const connectionString = process.env["DATABASE_URL"] ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts",
  },
  datasource: {
    url: connectionString,
  },
});
