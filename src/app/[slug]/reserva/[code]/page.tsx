import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck2, CalendarX2, MapPin, Phone, Users } from "lucide-react";
import { MenuThemeScript } from "@/components/menu/menu-theme-script";
import { formatBooking } from "@/lib/booking";
import { getPublicTenant } from "@/lib/public-menu";
import { tenantDb } from "@/lib/tenant-db";
import { CancelBooking } from "./cancel-booking";

export const metadata: Metadata = { title: "Tu reserva", robots: { index: false } };

const STATUS: Record<string, { title: string; ok: boolean }> = {
  CONFIRMED: { title: "Reserva confirmada", ok: true },
  SEATED: { title: "¡Ya estás en tu mesa!", ok: true },
  COMPLETED: { title: "Gracias por venir", ok: true },
  CANCELLED: { title: "Reserva cancelada", ok: false },
  NO_SHOW: { title: "La reserva venció", ok: false },
};

/** Enlace de la reserva (el que recibe el cliente): datos y cancelación. */
export default async function ReservationPage({ params }: PageProps<"/[slug]/reserva/[code]">) {
  const { slug, code } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();
  const r = await tenantDb(tenant.id).reservation.findUnique({ where: { code } });
  if (!r) notFound();
  const tz = tenant.settings?.timezone ?? "Europe/Madrid";
  const st = STATUS[r.status];
  const Icon = st.ok ? CalendarCheck2 : CalendarX2;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <MenuThemeScript slug={tenant.slug} theme={tenant.settings?.menuTheme ?? "DARK"} />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{tenant.name}</p>
      <h1 className="mt-1 flex items-center gap-3 text-3xl font-black tracking-tight sm:text-4xl">
        <Icon className={st.ok ? "size-8 text-ok" : "size-8 text-muted"} aria-hidden /> {st.title}
      </h1>

      <div className="mt-6 space-y-4 rounded-3xl border border-line bg-surface p-5">
        <p className="text-2xl font-bold first-letter:uppercase">{formatBooking(r.startsAt, tz)}</p>
        <p className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-muted" aria-hidden /> {r.partySize} {r.partySize === 1 ? "persona" : "personas"} · a nombre de{" "}
          <strong>{r.customerName}</strong>
        </p>
        {tenant.settings?.address && (
          <p className="flex items-center gap-2 text-sm">
            <MapPin className="size-4 text-muted" aria-hidden /> {tenant.settings.address}
          </p>
        )}
        {tenant.settings?.phone && (
          <p className="flex items-center gap-2 text-sm">
            <Phone className="size-4 text-muted" aria-hidden />
            <a href={`tel:${tenant.settings.phone.replace(/\s/g, "")}`} className="underline-offset-2 hover:underline">
              {tenant.settings.phone}
            </a>
          </p>
        )}
        {r.notes && <p className="rounded-xl bg-ink/5 px-3 py-2 text-sm">“{r.notes}”</p>}
      </div>

      {r.status === "CONFIRMED" && (
        <>
          <p className="mt-4 text-sm text-muted">
            Guardá este enlace: desde acá podés cancelar.
            {r.customerEmail ? ` También te lo mandamos a ${r.customerEmail}.` : ""}
          </p>
          <CancelBooking slug={tenant.slug} code={r.code} />
        </>
      )}
      {r.status === "CANCELLED" && (
        <Link href={`/${tenant.slug}/reservar`} className="mt-6 inline-flex h-12 items-center rounded-full bg-ink px-6 font-semibold text-bg">
          Hacer otra reserva
        </Link>
      )}
      <p className="mt-10 text-center text-sm">
        <Link href={`/${tenant.slug}`} className="text-muted underline-offset-2 hover:underline">
          Ver la carta de {tenant.name}
        </Link>
      </p>
    </main>
  );
}
