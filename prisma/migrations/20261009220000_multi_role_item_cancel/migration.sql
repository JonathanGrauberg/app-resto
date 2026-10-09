-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "extraRoles" "Role"[] DEFAULT ARRAY[]::"Role"[];

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "cancelReason" TEXT;

