import type { Metadata } from "next";
import { ArrowLeft, ShieldAlert, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { currentDevice, devicesOf } from "@/lib/auth/devices";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { regionOf } from "@/lib/region";
import { RemoveDeviceButton } from "./device-tools";

export const metadata: Metadata = { title: "Equipos" };

/** Equipos donde se entró con la cuenta del personal (ahí cada uno entra con su PIN). */
export default async function DevicesPage() {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  const [devices, here, settings] = await Promise.all([
    devicesOf(tenant.id),
    currentDevice(tenant.id),
    db.tenantSettings.findUnique({ where: { tenantId: tenant.id }, select: { country: true, timezone: true, locale: true, currency: true } }),
  ]);
  const region = regionOf(settings);
  const fmt = new Intl.DateTimeFormat(region.locale, { timeZone: region.timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return (
    <>
      <PageHeader
        title="Equipos"
        description="Compus, tablets y celulares donde se entró con la cuenta del personal. Ahí cada uno entra con su PIN. Si se pierde o se cambia un equipo, quitalo de la lista."
        actions={
          <ButtonLink href="/admin/personal" variant="secondary">
            <ArrowLeft className="size-4" aria-hidden /> Personal
          </ButtonLink>
        }
      />

      <div className="space-y-4">
        <Card className="divide-y divide-line">
          {devices.length === 0 && <p className="p-4 text-sm text-muted sm:p-5">Todavía no se entró con la cuenta del personal en ningún equipo.</p>}
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
                  Desde el {fmt.format(d.createdAt)}
                  {d.lastUsedAt ? ` · último ingreso ${fmt.format(d.lastUsedAt)}` : " · sin ingresos todavía"}
                </p>
                {d.pinLocks.map((l) => (
                  <p key={l.lockedAt!.toISOString()} className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-danger">
                    <ShieldAlert className="size-4" aria-hidden />
                    Muchos PIN incorrectos seguidos ({fmt.format(l.lockedAt!)})
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
