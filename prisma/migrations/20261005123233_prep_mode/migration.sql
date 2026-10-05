-- CreateEnum
CREATE TYPE "PrepMode" AS ENUM ('SEPARATE', 'SINGLE');

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "prepMode" "PrepMode" NOT NULL DEFAULT 'SEPARATE';

