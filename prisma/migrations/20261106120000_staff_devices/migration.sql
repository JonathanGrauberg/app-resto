-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN     "deviceId" TEXT;

-- CreateTable
CREATE TABLE "StaffDevice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "StaffDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevicePairing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevicePairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PinLock" (
    "deviceId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "PinLock_pkey" PRIMARY KEY ("deviceId","membershipId")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffDevice_tokenHash_key" ON "StaffDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffDevice_tenantId_idx" ON "StaffDevice"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "DevicePairing_tokenHash_key" ON "DevicePairing"("tokenHash");

-- CreateIndex
CREATE INDEX "DevicePairing_tenantId_idx" ON "DevicePairing"("tenantId");

-- CreateIndex
CREATE INDEX "AuthSession_deviceId_idx" ON "AuthSession"("deviceId");

-- AddForeignKey
ALTER TABLE "StaffDevice" ADD CONSTRAINT "StaffDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevicePairing" ADD CONSTRAINT "DevicePairing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinLock" ADD CONSTRAINT "PinLock_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "StaffDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

