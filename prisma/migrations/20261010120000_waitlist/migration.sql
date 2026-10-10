-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'SEATED', 'LEFT');

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "onlineBookable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "waitlistHoldMin" INTEGER NOT NULL DEFAULT 90;

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "tableLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seatedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_tenantId_status_createdAt_idx" ON "WaitlistEntry"("tenantId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

