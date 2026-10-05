import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenantRole } from "@/lib/auth/guards";
import { METHOD_LABEL } from "@/lib/billing";
import { cn, formatPrice } from "@/lib/format";
import { shiftSummary } from "@/lib/shift";
import { CloseShiftForm, PrintButton } from "./close-shift-form";

export const metadata: Metadata = { title: "Turno de caja" };

const dt = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

/** Resumen y arqueo de un turno de caja (imprimible). */
export default async function ShiftPage({ params }: PageProps<"/staff/caja/turno/[shiftId]">) {
  const { tdb, tenant } = await requireTenantRole(["OWNER", "ADMIN", "CAJA"], "CAJA");
  const { shiftId } = await params;
  const exists = await tdb.cashShift.findUnique({ where: { id: shiftId }, select: { id: true } });
  if (!exists) notFound();
  const s = await shiftSummary(tdb, shiftId);
  const open = !s.closedAt;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/staff/caja" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink print:hidden">
        <ArrowLeft className="size-4" aria-hidden /> Caja
      </Link>

      <article className="space-y-5 rounded-2xl border border-line bg-surface p-5 print:border-0 print:p-0">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{tenant.name}</p>
          <h1 className="text-2xl font-bold">{open ? "Turno abierto" : "Cierre de turno"}</h1>
          <p className="text-sm text-muted">
            {dt(s.openedAt)} → {s.closedAt ? dt(s.closedAt) : "ahora"} · {s.tables} {s.tables === 1 ? "mesa cobrada" : "mesas cobradas"}
          </p>
        </header>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Cobrado por forma de pago</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {s.byMethod.map((m) => (
                <tr key={m.method} className={cn(m.count === 0 && "text-muted")}>
                  <td className="py-2">{METHOD_LABEL[m.method]}</td>
                  <td className="py-2 text-right text-muted">{m.count === 1 ? "1 pago" : `${m.count} pagos`}</td>
                  <td className="py-2 text-right tabular-nums">{formatPrice(m.amountCents)}</td>
                  <td className="py-2 pl-3 text-right text-xs tabular-nums text-muted">{m.tipCents ? `+${formatPrice(m.tipCents)} prop.` : ""}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">Total cobrado</td>
                <td />
                <td className="py-2 text-right tabular-nums">{formatPrice(s.salesCents)}</td>
                <td className="py-2 pl-3 text-right text-xs tabular-nums">{s.tipsCents ? `+${formatPrice(s.tipsCents)} prop.` : ""}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Invitaciones" value={formatPrice(s.compsCents)} />
          <Stat label="Descuentos" value={formatPrice(s.discountsCents)} />
        </section>

        <section className="rounded-xl bg-ink/5 p-4 text-sm">
          <h2 className="mb-2 font-semibold">Efectivo (arqueo)</h2>
          <Line label="Efectivo inicial" value={formatPrice(s.openingCashCents)} />
          <Line label="+ Cobros en efectivo" value={formatPrice(s.byMethod.find((m) => m.method === "CASH")!.amountCents)} />
          <Line label="+ Propinas en efectivo" value={formatPrice(s.byMethod.find((m) => m.method === "CASH")!.tipCents)} />
          <div className="mt-1 flex justify-between border-t border-line pt-2 font-semibold">
            <span>Debería haber</span>
            <span className="tabular-nums">{formatPrice(s.expectedCashCents)}</span>
          </div>
          {s.countedCashCents != null && (
            <>
              <Line label="Contado" value={formatPrice(s.countedCashCents)} />
              <div
                className={cn(
                  "mt-2 flex justify-between rounded-lg px-3 py-2 font-semibold",
                  s.differenceCents === 0 ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger",
                )}
              >
                <span>{s.differenceCents === 0 ? "Cuadra perfecto" : s.differenceCents! > 0 ? "Sobra" : "Falta"}</span>
                <span className="tabular-nums">{formatPrice(Math.abs(s.differenceCents!))}</span>
              </div>
            </>
          )}
          {s.notes && <p className="mt-2 text-muted">Notas: {s.notes}</p>}
        </section>

        {open ? (
          <CloseShiftForm shiftId={s.id} expectedCents={s.expectedCashCents} />
        ) : (
          <div className="flex justify-end print:hidden">
            <PrintButton />
          </div>
        )}
        <p className="text-center text-xs text-muted">Resumen interno · No es un documento fiscal</p>
      </article>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
