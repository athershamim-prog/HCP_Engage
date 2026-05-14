-- Migration: rename compensationUsd → agreedRateUsd, add noOfActivities, create Invoice table
-- Applied manually via prisma db execute (project uses db push workflow, no prior migration history)

-- Step 1: Rename the column (preserves all data)
ALTER TABLE "Engagement" RENAME COLUMN "compensationUsd" TO "agreedRateUsd";

-- Step 2: Add noOfActivities column
ALTER TABLE "Engagement" ADD COLUMN "noOfActivities" INTEGER;

-- Step 3: Create Invoice table
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "agreedRateUsd" DECIMAL(10,2) NOT NULL,
    "noOfActivities" INTEGER,
    "totalUsd" DECIMAL(10,2) NOT NULL,
    "rateUnit" TEXT NOT NULL,
    "generatedByClerkId" TEXT NOT NULL,
    "generatedByName" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- Step 4: Add unique constraint on engagementId
CREATE UNIQUE INDEX "Invoice_engagementId_key" ON "Invoice"("engagementId");

-- Step 5: Add foreign key constraint
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
