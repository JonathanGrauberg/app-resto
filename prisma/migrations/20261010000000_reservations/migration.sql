-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('PUBLIC', 'STAFF');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "seatedAt" TIMESTAMP(3),
ADD COLUMN     "source" "ReservationSource" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "bookingDurationMin" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "bookingGraceMin" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "bookingHours" JSONB,
ADD COLUMN     "bookingLeadMin" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "bookingMaxDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "bookingMaxParty" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "bookingNotice" TEXT,
ADD COLUMN     "bookingSlotMin" INTEGER NOT NULL DEFAULT 30;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_code_key" ON "Reservation"("code");


-- Anti-solapamiento garantizado por la base: una mesa no puede tener dos reservas activas
-- con horarios que se pisan, aunque lleguen dos pedidos de reserva al mismo tiempo.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "ReservationTable"
  ADD CONSTRAINT "ReservationTable_no_overlap"
  EXCLUDE USING gist ("tableId" WITH =, tsrange("startsAt", "endsAt") WITH &&)
  WHERE (active);
