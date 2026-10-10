import "server-only";

/**
 * Email transaccional con Resend (API HTTP, sin SDK).
 * Sin RESEND_API_KEY no se envía nada: la reserva funciona igual y la confirmación se ve en pantalla.
 * Con el dominio de prueba de Resend (onboarding@resend.dev) solo llega al email de la cuenta de Resend;
 * para clientes reales hay que verificar el dominio propio y poner EMAIL_FROM.
 */
export async function sendEmail(msg: { to: string; subject: string; html: string; replyTo?: string | null }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: true as const };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Reservas <onboarding@resend.dev>",
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    });
    if (!res.ok) console.error("Resend:", res.status, await res.text());
    return { ok: res.ok };
  } catch (e) {
    // Un fallo de email nunca debe romper la reserva.
    console.error("Resend:", e);
    return { ok: false };
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plantilla simple y legible en cualquier cliente de correo. */
export function bookingEmail(opts: {
  venue: string;
  title: string;
  lines: [string, string][];
  intro: string;
  link?: { href: string; label: string };
  footer?: string;
}) {
  const rows = opts.lines
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f5f3ef;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="margin:0;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#b4884d;font-weight:700">${esc(opts.venue)}</p>
<h1 style="margin:6px 0 16px;font-size:24px">${esc(opts.title)}</h1>
<p style="margin:0 0 16px;line-height:1.5">${esc(opts.intro)}</p>
<table style="border-collapse:collapse;margin:0 0 20px;font-size:15px">${rows}</table>
${opts.link ? `<p style="margin:0 0 20px"><a href="${esc(opts.link.href)}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${esc(opts.link.label)}</a></p>` : ""}
${opts.footer ? `<p style="margin:0;font-size:13px;color:#666;line-height:1.5">${esc(opts.footer)}</p>` : ""}
</div></body></html>`;
}
