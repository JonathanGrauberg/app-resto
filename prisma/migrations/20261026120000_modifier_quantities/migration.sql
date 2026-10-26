-- AlterTable
ALTER TABLE "ModifierGroup" ADD COLUMN     "allowRepeat" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ModifierOption" ADD COLUMN     "available" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ProductModifierGroup" ADD COLUMN     "maxSelect" INTEGER,
ADD COLUMN     "minSelect" INTEGER;

