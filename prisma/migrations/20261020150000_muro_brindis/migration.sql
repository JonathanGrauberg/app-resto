-- CreateEnum
CREATE TYPE "ChatInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "ChatRoom" ADD COLUMN     "linkedRoomIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "memberKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "photoApprovals" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "photoBy" TEXT,
ADD COLUMN     "photoData" TEXT;

-- CreateTable
CREATE TABLE "ChatInvite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromRoomId" TEXT NOT NULL,
    "toRoomId" TEXT NOT NULL,
    "status" "ChatInviteStatus" NOT NULL DEFAULT 'PENDING',
    "jointRoomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ChatInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatInvite_toRoomId_status_idx" ON "ChatInvite"("toRoomId", "status");

-- CreateIndex
CREATE INDEX "ChatInvite_fromRoomId_status_idx" ON "ChatInvite"("fromRoomId", "status");

-- AddForeignKey
ALTER TABLE "ChatInvite" ADD CONSTRAINT "ChatInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInvite" ADD CONSTRAINT "ChatInvite_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInvite" ADD CONSTRAINT "ChatInvite_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

