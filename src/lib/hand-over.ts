import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { PLANS } from "@/lib/plans";
import { enablePlanModules } from "@/lib/pro";

export type HandOverOptions = {
  /** Cuenta que ya existe (entra con su contraseña de siempre) o una nueva. */
  owner: { userId: string } | { name: string; email: string; passwordHash: string };
  /** WhatsApp con código de país, o null para dejar el que esté. */
  phone: string | null;
  plan: (typeof PLANS)[number];
  currency: string;
  /** Hasta cuándo es gratis (prueba); null = sin prueba. */
  trialEndsAt: Date | null;
  /** Qué se conserva de lo que cargamos nosotros. */
  keep: { menu: boolean; tables: boolean; branding: boolean; settings: boolean; staff: boolean };
};

/**
 * Entrega un local armado por nosotros (demo) a su dueño real: queda a su nombre, en el plan elegido,
 * sin movimientos de prueba, sin equipos vinculados ni sesiones abiertas, y con lo que se elija conservar.
 */
export async function handOverTenant(tenantId: string, o: HandOverOptions) {
  await db.$transaction(
    async (tx) => {
      const where = { tenantId };

      // 1) Movimientos de prueba: siempre se borran.
      await tx.chatInvite.deleteMany({ where });
      await tx.chatMessage.deleteMany({ where });
      await tx.chatRoom.deleteMany({ where });
      await tx.wallMessage.deleteMany({ where });
      await tx.wall.deleteMany({ where });
      await tx.notification.deleteMany({ where });
      await tx.cartItem.deleteMany({ where });
      await tx.payment.deleteMany({ where });
      await tx.orderItem.deleteMany({ where });
      await tx.order.deleteMany({ where });
      await tx.tableSession.deleteMany({ where });
      await tx.cashShift.deleteMany({ where });
      await tx.reservation.deleteMany({ where });
      await tx.waitlistEntry.deleteMany({ where });
      await tx.event.deleteMany({ where });
      await tx.purchase.deleteMany({ where });

      // 2) Equipos vinculados y sesiones abiertas (incluida la de quien armó la demo).
      await tx.devicePairing.deleteMany({ where });
      await tx.staffDevice.deleteMany({ where });
      await tx.authSession.deleteMany({ where });

      // 3) Lo que se elige no conservar.
      if (!o.keep.menu) {
        await tx.translation.deleteMany({ where });
        await tx.product.deleteMany({ where });
        await tx.modifierGroup.deleteMany({ where });
        await tx.category.deleteMany({ where });
      }
      if (!o.keep.tables) {
        await tx.table.deleteMany({ where });
        await tx.tableGroup.deleteMany({ where });
        await tx.area.deleteMany({ where });
      }
      if (!o.keep.branding) {
        await tx.tenantSettings.update({
          where,
          data: {
            tagline: null,
            description: null,
            coverImageUrl: null,
            logoUrl: null,
            shareImageUrl: null,
            address: null,
            phone: null,
            instagramUrl: null,
            facebookUrl: null,
            websiteUrl: null,
            googleReviewUrl: null,
            linksEnabled: false,
            linksTheme: "dark",
            links: Prisma.DbNull,
          },
        });
      }
      if (!o.keep.settings) {
        await tx.tenantSettings.update({
          where,
          data: {
            openingHours: Prisma.DbNull,
            bookingHours: Prisma.DbNull,
            menuTheme: "DARK",
            prepMode: "SEPARATE",
            extraLocales: [],
            bookingDurationMin: 90,
            bookingSlotMin: 30,
            bookingGraceMin: 15,
            bookingLeadMin: 60,
            bookingMaxDays: 30,
            bookingMaxParty: 8,
            bookingNotice: null,
            waitlistHoldMin: 90,
            blockedWords: [],
          },
        });
      }

      // 4) Personal: los dueños de la demo se van siempre; el resto, según se elija.
      const owner =
        "userId" in o.owner
          ? { id: o.owner.userId }
          : await tx.user.create({ data: { email: o.owner.email, name: o.owner.name, passwordHash: o.owner.passwordHash }, select: { id: true } });
      const leaving = await tx.membership.findMany({
        where: { tenantId, userId: { not: owner.id }, ...(o.keep.staff ? { role: "OWNER" } : {}) },
        select: { id: true, userId: true },
      });
      await tx.membership.deleteMany({ where: { id: { in: leaving.map((m) => m.id) } } });
      await tx.membership.upsert({
        where: { tenantId_userId: { tenantId, userId: owner.id } },
        update: { role: "OWNER", extraRoles: [], active: true },
        create: { tenantId, userId: owner.id, role: "OWNER" },
      });
      // Usuarios de la demo que ya no pertenecen a ningún local: se borran.
      await tx.user.deleteMany({
        where: { id: { in: leaving.map((m) => m.userId) }, isPlatformAdmin: false, memberships: { none: {} } },
      });

      // 5) Plan y prueba gratis.
      const sub = {
        planId: o.plan.id,
        trialEndsAt: o.trialEndsAt,
        paidUntil: null,
        cancelledAt: null,
        vip: false,
        source: "entrega",
        ...(o.phone ? { contactPhone: o.phone } : {}),
      };
      await tx.subscription.upsert({
        where,
        update: sub,
        create: { tenantId, currency: o.currency, ...sub },
      });
      await tx.tenant.update({ where: { id: tenantId }, data: { active: true } });
    },
    { timeout: 60_000, maxWait: 15_000 },
  );
  await enablePlanModules(tenantId, o.plan);
}
