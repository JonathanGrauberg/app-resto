import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireTenantRole } from "@/lib/auth/guards";
import { CAN_MANAGE_TABLES } from "@/lib/auth/permissions";
import { baseUrl } from "@/lib/base-url";
import { METHOD_LABEL } from "@/lib/billing";
import { formatPrice } from "@/lib/format";
import { ensureReceipt, receiptForStaff } from "@/lib/receipt";
import { TicketActions } from "./ticket-actions";

export const metadata: Metadata = { title: "Cuenta" };

const time = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const date = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Madrid" });

/**
 * Ticket de la cuenta (documento informativo, no es factura) para impresora térmica de 80 mm.
 * Se puede reimprimir siempre desde caja ("Mesas cobradas hoy").
 */
export default async function TicketPage({ params, searchParams }: PageProps<"/staff/cuenta/[sessionId]">) {
  const { tdb, tenant } = await requireTenantRole(CAN_MANAGE_TABLES);
  const { sessionId } = await params;
  const { auto } = await searchParams;

  const session = await tdb.tableSession.findUnique({ where: { id: sessionId }, select: { receiptToken: true } });
  if (!session) notFound();
  if (!session.receiptToken) await ensureReceipt(tdb, sessionId);

  const r = await receiptForStaff(tdb, tenant, sessionId);
  if (!r) notFound();
  const url = `${await baseUrl()}/${tenant.slug}/cuenta/${r.receiptToken}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });

  return (
    <>
      {/* Tamaño de papel de impresora térmica; en impresora común sale centrado. */}
      <style>{`@media print { @page { size: 80mm auto; margin: 3mm; } html, body { background: #fff !important; } }`}</style>

      <TicketActions autoPrint={auto === "1"} />

      <article className="mx-auto w-[76mm] bg-white p-4 font-mono text-[12px] leading-snug text-black shadow-lg print:w-full print:p-0 print:shadow-none">
        <header className="text-center">
          <p className="text-base font-bold uppercase tracking-wide">{r.venue.name}</p>
          {r.venue.address && <p>{r.venue.address}</p>}
          {r.venue.phone && <p>Tel. {r.venue.phone}</p>}
        </header>

        <Rule />
        <p className="flex justify-between">
          <span className="font-bold">Mesa {r.tableLabel}</span>
          <span>{r.guests} {r.guests === 1 ? "comensal" : "comensales"}</span>
        </p>
        <p className="flex justify-between">
          <span>{date(r.openedAt)}</span>
          <span>
            {time(r.openedAt)} – {r.closedAt ? time(r.closedAt) : time(new Date().toISOString())}
          </span>
        </p>
        {r.waiterName && <p>Le atendió: {r.waiterName}</p>}
        <Rule />

        {r.lines.length === 0 && <p className="text-center">Sin consumo</p>}
        {r.lines.map((l) => (
          <div key={l.key}>
            <p className="flex gap-2">
              <span className="w-5 shrink-0 text-right">{l.quantity}</span>
              <span className="min-w-0 flex-1">{l.name}</span>
              <span className="shrink-0 tabular-nums">{l.comped ? "INVITA" : formatPrice(l.totalCents)}</span>
            </p>
            {l.modifiers.length > 0 && <p className="pl-7 text-[11px]">+ {l.modifiers.join(", ")}</p>}
            {l.quantity > 1 && <p className="pl-7 text-[11px]">({formatPrice(l.unitCents)} c/u)</p>}
          </div>
        ))}

        <Rule />
        {(r.compsCents > 0 || r.discountCents > 0) && (
          <>
            <p className="flex justify-between">
              <span>Consumo</span>
              <span className="tabular-nums">{formatPrice(r.consumedCents)}</span>
            </p>
            {r.compsCents > 0 && (
              <p className="flex justify-between">
                <span>Invitación de la casa</span>
                <span className="tabular-nums">−{formatPrice(r.compsCents)}</span>
              </p>
            )}
            {r.discountCents > 0 && (
              <p className="flex justify-between">
                <span>Descuento{r.discountReason ? ` (${r.discountReason})` : ""}</span>
                <span className="tabular-nums">−{formatPrice(r.discountCents)}</span>
              </p>
            )}
          </>
        )}
        <p className="flex justify-between text-base font-bold">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatPrice(r.totalCents)}</span>
        </p>
        <p className="text-right text-[11px]">IVA incluido</p>

        {r.payments.length > 0 && (
          <>
            <Rule />
            {r.payments.map((p, i) => (
              <div key={i}>
                <p className="flex justify-between">
                  <span>{METHOD_LABEL[p.method]}</span>
                  <span className="tabular-nums">{formatPrice(p.amountCents)}</span>
                </p>
                {p.receivedCents != null && p.receivedCents > p.amountCents + p.tipCents && (
                  <p className="flex justify-between pl-3 text-[11px]">
                    <span>Entregado {formatPrice(p.receivedCents)} · Cambio</span>
                    <span className="tabular-nums">{formatPrice(p.receivedCents - p.amountCents - p.tipCents)}</span>
                  </p>
                )}
              </div>
            ))}
            {r.tipsCents > 0 && (
              <p className="flex justify-between">
                <span>Propina · ¡gracias!</span>
                <span className="tabular-nums">{formatPrice(r.tipsCents)}</span>
              </p>
            )}
          </>
        )}

        {r.people.length > 1 && (
          <>
            <Rule />
            <p className="mb-0.5 font-bold">Consumo por persona</p>
            {r.people.map((p) => (
              <p key={p.label} className="flex justify-between">
                <span>{p.label}</span>
                <span className="tabular-nums">{formatPrice(p.totalCents)}</span>
              </p>
            ))}
          </>
        )}

        <Rule />
        <div className="flex items-center gap-3">
          <div className="size-24 shrink-0 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-[11px]">
            Escaneá para ver el detalle de cada persona y <strong>dividir la cuenta</strong> desde el celular. Disponible 24 h.
          </p>
        </div>
        <Rule />
        <p className="text-center text-[11px]">Documento informativo · No válido como factura</p>
        <p className="mt-1 text-center font-bold">¡Gracias por su visita!</p>
      </article>
    </>
  );
}

function Rule() {
  return <hr className="my-2 border-t border-dashed border-black" />;
}
