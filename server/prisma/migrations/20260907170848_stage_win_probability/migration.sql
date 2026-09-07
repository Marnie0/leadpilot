-- AlterTable
ALTER TABLE "pipeline_stages" ADD COLUMN     "winProbability" INTEGER NOT NULL DEFAULT 0;

-- Backfill the stages that already exist. Without this every workspace created
-- before this migration would forecast zero revenue, because the column default
-- is 0 and nothing else ever writes these rows.
UPDATE "pipeline_stages" SET "winProbability" = CASE "key"
  WHEN 'NEW'       THEN 10
  WHEN 'CONTACTED' THEN 25
  WHEN 'QUALIFIED' THEN 50
  WHEN 'PROPOSAL'  THEN 75
  WHEN 'WON'       THEN 100
  ELSE 0
END;
