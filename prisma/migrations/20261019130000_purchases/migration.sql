-- CreateEnum
CREATE TYPE "PurchaseCategory" AS ENUM ('FOOD', 'DRINKS', 'SUPPLIES', 'OTHER');

-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'COMPRAS';

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" TEXT,
    "supplier" TEXT,
    "category" "PurchaseCategory" NOT NULL DEFAULT 'FOOD',
    "amountCents" INTEGER NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Purchase_tenantId_date_idx" ON "Purchase"("tenantId", "date");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

