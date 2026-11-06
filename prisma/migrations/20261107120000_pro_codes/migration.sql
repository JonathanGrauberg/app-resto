-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "city" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "vip" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "months" INTEGER,
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedTenantId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProCode_codeHash_key" ON "ProCode"("codeHash");

-- CreateIndex
CREATE INDEX "ProCode_createdAt_idx" ON "ProCode"("createdAt");

