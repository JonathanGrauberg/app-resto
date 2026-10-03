-- AlterTable
ALTER TABLE "ModifierGroup" ADD COLUMN     "ownerProductId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ModifierGroup_ownerProductId_key" ON "ModifierGroup"("ownerProductId");

-- AddForeignKey
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_ownerProductId_fkey" FOREIGN KEY ("ownerProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

