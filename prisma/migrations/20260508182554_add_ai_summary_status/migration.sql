-- CreateEnum
CREATE TYPE "AiSummaryStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "thought_versions" ADD COLUMN     "aiSummaryErrorMessage" TEXT,
ADD COLUMN     "aiSummaryStatus" "AiSummaryStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';

-- Backfill from historical data
UPDATE "thought_versions" SET "aiSummaryStatus" = 'COMPLETED' WHERE "aiSummary" IS NOT NULL;

UPDATE "thought_versions" AS tv
SET "aiSummaryStatus" = 'FAILED'
WHERE tv."aiSummary" IS NULL
  AND EXISTS (
    SELECT 1 FROM "thought_diffs" td WHERE td."toVersionId" = tv.id
  );
