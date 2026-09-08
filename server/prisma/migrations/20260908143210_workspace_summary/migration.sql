-- CreateTable
CREATE TABLE "workspace_summaries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "headline" TEXT NOT NULL,
    "attention" JSONB NOT NULL,
    "trends" JSONB NOT NULL,
    "nextStep" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_summaries_organizationId_key" ON "workspace_summaries"("organizationId");

-- AddForeignKey
ALTER TABLE "workspace_summaries" ADD CONSTRAINT "workspace_summaries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_summaries" ADD CONSTRAINT "workspace_summaries_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
