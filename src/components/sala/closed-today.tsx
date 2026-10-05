import Link from "next/link";
import { Printer } from "lucide-react";
import { formatPrice } from "@/lib/format";

/** Caja: mesas cobradas en la jornada, con reimpresión de la cuenta (si se perdió el ticket). */
export function ClosedToday({
  rows,
}: {
  rows: { id: string; label: string; closedAt: string; totalCents: number; guests: number; waiterName: string | null }[];
}) {
  const total = rows.reduce((n, r) => n + r.totalCents, 0);
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Mesas cobradas hoy</h2>
        {rows.length > 0 && (
          <p className="text-sm text-muted">
            {rows.length} {rows.length === 1 ? "mesa" : "mesas"} · <span className="font-semibold text-ink">{formatPrice(total)}</span>
          </p>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Todavía no se cobró ninguna mesa.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="w-24 shrink-0 font-semibold">Mesa {r.label}</span>
              <span className="min-w-0 flex-1 truncate text-muted">
                {new Date(r.closedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })} ·{" "}
                {r.guests} pers.{r.waiterName ? ` · ${r.waiterName}` : ""}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatPrice(r.totalCents)}</span>
              <Link
                href={`/staff/cuenta/${r.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 hover:bg-ink/5"
              >
                <Printer className="size-4" aria-hidden /> <span className="hidden sm:inline">Reimprimir</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
