import "server-only";
import { baseUrl } from "@/lib/base-url";
import { formatBooking } from "@/lib/booking";
import { bookingEmail, sendEmail } from "@/lib/email";

type Mailable = {
  code: string;
  customerName: string;
  customerEmail: string | null;
  partySize: number;
  startsAt: Date;
};
type Venue = { name: string; slug: string; address?: string | null; phone?: string | null; timezone: string };

/** Email al cliente: confirmación o cancelación (si dejó email). */
export async function mailBooking(kind: "confirmed" | "cancelled", r: Mailable, v: Venue, cancelledByVenue = false) {
  if (!r.customerEmail) return;
  const when = formatBooking(r.startsAt, v.timezone);
  const link = `${await baseUrl()}/${v.slug}/reserva/${r.code}`;
  const lines: [string, string][] = [
    ["Cuándo", when],
    ["Personas", String(r.partySize)],
    ["A nombre de", r.customerName],
    ...(v.address ? ([["Dirección", v.address]] as [string, string][]) : []),
  ];
  const html =
    kind === "confirmed"
      ? bookingEmail({
          venue: v.name,
          title: "Reserva confirmada",
          intro: `¡Te esperamos! Tu mesa en ${v.name} está reservada.`,
          lines,
          link: { href: link, label: "Ver o cancelar la reserva" },
          footer: `Si no podés venir, cancelala desde el enlace así la mesa queda para otra persona.${v.phone ? ` Teléfono del local: ${v.phone}.` : ""}`,
        })
      : bookingEmail({
          venue: v.name,
          title: "Reserva cancelada",
          intro: cancelledByVenue
            ? `${v.name} canceló tu reserva. Si tenés dudas, comunicate con el local.`
            : "Cancelaste tu reserva. ¡Te esperamos otro día!",
          lines,
          footer: v.phone ? `Teléfono del local: ${v.phone}.` : undefined,
        });
  await sendEmail({
    to: r.customerEmail,
    subject: kind === "confirmed" ? `Reserva confirmada · ${v.name} · ${when}` : `Reserva cancelada · ${v.name}`,
    html,
  });
}
