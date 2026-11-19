-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "staffPasswordHash" TEXT;

-- CreateTable
CREATE TABLE "StaffLoginLock" (
    "tenantId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLoginLock_pkey" PRIMARY KEY ("tenantId","ipHash")
);

-- AddForeignKey
ALTER TABLE "StaffLoginLock" ADD CONSTRAINT "StaffLoginLock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

