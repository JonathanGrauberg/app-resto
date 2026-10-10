import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Settings2, Users } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import {
  DAYS,
  DEFAULT_HOURS,
  bookableTables,
  expireReservations,
  getBookingConfig,
  isValidDate,
  localParts,
  zonedToUtc,
} from "@/lib/booking";
import { cn } from "@/lib/format";
import { Agenda, NewBooking } from "./agenda";
import { BookingSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Reservas" };

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Agenda del día (con reservas manuales y eventos multi-mesa) y configuración de las reservas online. */
export default async function AdminReservasPage({ searchParams }: PageProps<"/admin/reservas">) {
  const { tdb, tenant } = await requireTenantRole(ADMIN_ROLES, "RESERVAS");
  const { dia, vista } = await searchParams;
  const cfg = await getBookingConfig(tenant.id);
  const today = localParts(new Date(), cfg.timezone).date;
  const date = typeof dia === "string" && isValidDate(dia) ? dia : today;
  const config = vista === "config";
  const configured = Object.keys(cfg.hours).length > 0;

  const tabs = (
    <div className="mb-5 inline-flex rounded-xl bg-ink/5 p-1" role="tablist" aria-label="Vista">
      {[
        { href: `/admin/reservas?dia=${date}`, label: "Agenda", icon: CalendarDays, on: !config },
        { href: "/admin/reservas?vista=config", label: "Configuración", icon: Settings2, on: config },
      ].map(({ href, label, icon: Icon, on }) => (
        <Link
          key={label}
          href={href}
          role="tab"
          aria-selected={on}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
            on ? "bg-surface shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          <Icon className="size-4" aria-hidden /> {label}
        </Link>
      ))}
    </div>
  );
  const header = (
    <PageHeader
      title="Reservas"
      description="Confirmación automática; la mesa se asigna sola y nunca se pisan dos reservas."
      actions={
        <Link
          href={`/${tenant.slug}/reservar`}
          target="_blank"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:bg-bg"
        >
          <ExternalLink className="size-4" aria-hidden /> Página para reservar
        </Link>
      }
    />
  );

  if (config) {
    const hours = configured ? cfg.hours : DEFAULT_HOURS;
    return (
      <>
        {header}
        {tabs}
        <BookingSettingsForm
          firstTime={!configured}
          values={{
            hours: Object.fromEntries(DAYS.map((d) => [d, (hours[d] ?? []).map(([a, b]) => `${a}-${b}`).join(", ")])),
            bookingDurationMin: cfg.durationMin,
            bookingSlotMin: cfg.slotMin,
            bookingGraceMin: cfg.graceMin,
            bookingLeadMin: cfg.leadMin,
            bookingMaxDays: cfg.maxDays,
            bookingMaxParty: cfg.maxParty,
            waitlistHoldMin: cfg.waitlistHoldMin,
            bookingNotice: cfg.notice ?? "",
          }}
        />
      </>
    );
  }

  await expireReservations(tdb, cfg.graceMin);
  const from = zonedToUtc(date, "00:00", cfg.timezone);
  const to = zonedToUtc(addDays(date, 1), "00:00", cfg.timezone);
  const [reservations, tables, areas] = await Promise.all([
    tdb.reservation.findMany({
      where: { startsAt: { gte: from, lt: to } },
      orderBy: { startsAt: "asc" },
      include: { tables: { include: { table: { select: { number: true } } } } },
    }),
    bookableTables(tdb),
    tdb.area.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const active = reservations.filter((r) => r.status === "CONFIRMED" || r.status === "SEATED");
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <>
      {header}
      {tabs}
      {!configured && (
        <p className="mb-5 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          Todavía no cargaste los horarios: la página pública no ofrece turnos.{" "}
          <Link href="/admin/reservas?vista=config" className="font-semibold underline underline-offset-2">
            Configurar horarios
          </Link>
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Link href={`/admin/reservas?dia=${addDays(date, -1)}`} aria-label="Día anterior" className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface hover:bg-bg">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link href={`/admin/reservas?dia=${addDays(date, 1)}`} aria-label="Día siguiente" className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface hover:bg-bg">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        <h2 className="text-xl font-semibold first-letter:uppercase">
          {date === today ? `Hoy · ${label}` : label}
        </h2>
        {date !== today && (
          <Link href="/admin/reservas" className="text-sm font-medium text-brand">
            Ir a hoy
          </Link>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted">
          <Users className="size-4" aria-hidden /> {active.length} {active.length === 1 ? "reserva" : "reservas"} ·{" "}
          {active.reduce((n, r) => n + r.partySize, 0)} personas
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <Agenda
          timezone={cfg.timezone}
          rows={reservations.map((r) => ({
            id: r.id,
            startsAt: r.startsAt.toISOString(),
            name: r.customerName,
            phone: r.customerPhone,
            email: r.customerEmail,
            party: r.partySize,
            notes: r.notes,
            status: r.status,
            source: r.source,
            tables: r.tables.map((t) => t.table.number).sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
          }))}
        />
        <NewBooking
          key={date}
          date={date}
          tables={tables.map((t) => ({ ...t, area: areas.find((a) => a.id === t.areaId)?.name ?? "" }))}
          durationMin={cfg.durationMin}
        />
      </div>
    </>
  );
}
