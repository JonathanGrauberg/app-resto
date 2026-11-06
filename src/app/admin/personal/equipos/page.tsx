import type { Metadata } from "next";
import { ArrowLeft, ShieldAlert, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { currentDevice, devicesOf, PAIRING_MINUTES } from "@/lib/auth/devices";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { regionOf } from "@/lib/region";
import { PairHereForm, PairQrButton, RemoveDeviceButton } from "./device-tools";

export const metadata: Metadata = { title: "Equipos" };

/** Equipos desde los que el personal puede entrar con PIN. */
export default async function DevicesPage() {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  const [devices, here, settings, members] = await Promise.all([
    devicesOf(tenant.id),
    currentDevice(tenant.id),
    db.tenantSettings.findUnique({ where: { tenantId: tenant.id }, select: { country: true, timezone: true, locale: true, currency: true } }),
    db.membership.findMany({ where: { tenantId: tenant.id }, select: { id: true, user: { select: { name: true } } } }),
  ]);
  const region = regionOf(settings);
  const nameOf = new Map(members.map((m) => [m.id, m.user.name]));
  const fmt = new Intl.DateTimeFormat(region.locale, { timeZone: region.timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return (
    <>
      <PageHeader
        title="Equipos"
        description="El personal entra con PIN solo desde estos celulares, tablets o compus. Así, aunque alguien adivine un PIN, no puede entrar desde otro lado."
        actions={
          <ButtonLink href="/admin/personal" variant="secondary">
            <ArrowLeft className="size-4" aria-hidden /> Personal
          </ButtonLink>
        }
      />

      <div className="space-y-4">
        <Card className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
          <div className="min-w-56 flex-1">
            <p className="font-medium">Vincular un celular o tablet</p>
            <p className="text-sm text-muted">Mostrá el QR y que lo escaneen con el equipo. Se hace una sola vez por equipo.</p>
          </div>
          <PairQrButton venue={tenant.name} minutes={PAIRING_MINUTES} />
        </Card>

        {!here && <PairHereForm />}

        <Card className="divide-y divide-line">
          {devices.length === 0 && <p className="p-4 text-sm text-muted sm:p-5">Todavía no hay equipos vinculados: nadie puede entrar con PIN.</p>}
          {devices.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Smartphone className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {d.name} {d.id === here?.id && <Badge tone="brand">Este equipo</Badge>}
                </p>
                <p className="text-sm text-muted">
                  Vinculado el {fmt.format(d.createdAt)}
                  {d.lastUsedAt ? ` · último ingreso ${fmt.format(d.lastUsedAt)}` : " · sin ingresos todavía"}
                </p>
                {d.pinLocks.map((l) => (
                  <p key={l.membershipId} className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-danger">
                    <ShieldAlert className="size-4" aria-hidden />
                    {nameOf.get(l.membershipId) ?? "Alguien"} quedó bloqueado por PIN incorrectos ({fmt.format(l.lockedAt!)})
                  </p>
                ))}
              </div>
              <RemoveDeviceButton id={d.id} name={d.name} />
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
