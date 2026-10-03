-- CreateEnum
CREATE TYPE "MenuTheme" AS ENUM ('SYSTEM', 'DARK', 'LIGHT');

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "menuTheme" "MenuTheme" NOT NULL DEFAULT 'DARK';
