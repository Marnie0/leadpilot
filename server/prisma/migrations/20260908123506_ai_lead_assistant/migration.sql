-- CreateEnum
CREATE TYPE "AiUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "lead_insights" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "summary" TEXT NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "urgency" "AiUrgency" NOT NULL,
    "rationale" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "nextActionChannel" "FollowUpChannel" NOT NULL DEFAULT 'CALL',
    "draftMessage" TEXT NOT NULL,
    "signals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "model" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_insights_leadId_key" ON "lead_insights"("leadId");

-- CreateIndex
CREATE INDEX "lead_insights_organizationId_updatedAt_idx" ON "lead_insights"("organizationId", "updatedAt");

-- AddForeignKey
ALTER TABLE "lead_insights" ADD CONSTRAINT "lead_insights_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_insights" ADD CONSTRAINT "lead_insights_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_insights" ADD CONSTRAINT "lead_insights_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
