-- CreateEnum
CREATE TYPE "WallModeration" AS ENUM ('AUTO', 'APPROVE');

-- CreateEnum
CREATE TYPE "WallMessageStatus" AS ENUM ('VISIBLE', 'PENDING', 'HIDDEN');

-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'MURO';

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "blockedWords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Wall" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "screenToken" TEXT NOT NULL,
    "moderation" "WallModeration" NOT NULL DEFAULT 'AUTO',
    "blockedKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WallMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "wallId" TEXT NOT NULL,
    "authorKey" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "WallMessageStatus" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WallMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sessionId" TEXT,
    "tableLabel" TEXT,
    "blockedKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "authorKey" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "reportedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wall_code_key" ON "Wall"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Wall_screenToken_key" ON "Wall"("screenToken");

-- CreateIndex
CREATE INDEX "Wall_tenantId_startsAt_idx" ON "Wall"("tenantId", "startsAt");

-- CreateIndex
CREATE INDEX "WallMessage_wallId_status_createdAt_idx" ON "WallMessage"("wallId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_code_key" ON "ChatRoom"("code");

-- CreateIndex
CREATE INDEX "ChatRoom_tenantId_closedAt_idx" ON "ChatRoom"("tenantId", "closedAt");

-- CreateIndex
CREATE INDEX "ChatRoom_sessionId_idx" ON "ChatRoom"("sessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "Wall" ADD CONSTRAINT "Wall_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallMessage" ADD CONSTRAINT "WallMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallMessage" ADD CONSTRAINT "WallMessage_wallId_fkey" FOREIGN KEY ("wallId") REFERENCES "Wall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

