-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "staffUsername" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_staffUsername_key" ON "TenantSettings"("staffUsername");

