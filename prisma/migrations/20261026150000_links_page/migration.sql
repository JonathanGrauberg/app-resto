-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "links" JSONB,
ADD COLUMN     "linksEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linksTheme" TEXT NOT NULL DEFAULT 'dark';

