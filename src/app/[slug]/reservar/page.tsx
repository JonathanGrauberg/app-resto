import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarX2 } from "lucide-react";
import { MenuThemeScript } from "@/components/menu/menu-theme-script";
import { bookableDays, getBookingConfig } from "@/lib/booking";
import { hasModule } from "@/lib/modules";
import { getPublicTenant } from "@/lib/public-menu";
import { BookingForm } from "./booking-form";

export async function generateMetadata({ params }: PageProps<"/[slug]/reservar">): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  return tenant ? { title: `Reservar · ${tenant.name}`, description: `Reservá tu mesa en ${tenant.name}` } : {};
}

/** Reserva pública: personas → día → horario → datos. Confirmación automática. */
export default async function BookingPage({ params }: PageProps<"/[slug]/reservar">) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant || !(await hasModule(tenant.id, "RESERVAS"))) notFound();
  const cfg = await getBookingConfig(tenant.id);
  const days = bookableDays(cfg);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:py-10">
      <MenuThemeScript slug={tenant.slug} theme={tenant.settings?.menuTheme ?? "DARK"} />
      <Link href={`/${tenant.slug}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Carta
      </Link>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{tenant.name}</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">Reservá tu mesa</h1>
        {tenant.settings?.address && <p className="mt-2 text-sm text-muted">{tenant.settings.address}</p>}
      </header>

      {days.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line p-8 text-center">
          <CalendarX2 className="size-8 text-muted" aria-hidden />
          <p className="font-medium">Por ahora no hay reservas online</p>
          <p className="text-sm text-muted">
            {tenant.settings?.phone ? `Podés reservar llamando al ${tenant.settings.phone}.` : "Consultá directamente con el local."}
          </p>
        </div>
      ) : (
        <BookingForm
          slug={tenant.slug}
          venue={tenant.name}
          days={days.map((d) => d.date)}
          maxParty={cfg.maxParty}
          notice={cfg.notice}
          phone={tenant.settings?.phone ?? null}
          durationMin={cfg.durationMin}
        />
      )}
    </main>
  );
}
