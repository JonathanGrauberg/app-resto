-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "addedById" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "addedBy" TEXT,
ADD COLUMN     "addedById" TEXT;

