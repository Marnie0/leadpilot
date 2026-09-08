-- AlterTable
ALTER TABLE "users" ADD COLUMN     "displayCurrency" TEXT;

-- CreateTable
CREATE TABLE "exchange_rates" (
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "asOf" DATE NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("base","quote")
);
