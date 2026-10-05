-- AlterTable
ALTER TABLE "TableSession" ADD COLUMN     "receiptToken" TEXT,
ADD COLUMN     "tableLabel" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TableSession_receiptToken_key" ON "TableSession"("receiptToken");

