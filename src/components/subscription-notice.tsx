import { AlertTriangle, Clock } from "lucide-react";
import { billingState, GRACE_DAYS } from "@/lib/subscription";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { cn } from "@/lib/format";

const day = (d: Date) => d.toLocaleDateString("es", { day: "numeric", month: "long", timeZone: "UTC" });

/** Aviso al dueño del local: la prueba gratis está por terminar o el pago venció. No bloquea nada. */
export async function SubscriptionNotice({ tenantId }: { tenantId: string }) {
  const sub = await db.subscription.findUnique({ where: { tenantId } });
  const s = billingState(sub);
  let tone: "warn" | "danger" | null = null;
  let text = "";
  if (s.kind === "trial" && s.daysLeft <= 5) {
    tone = "warn";
    text = `Tu prueba gratis de ${BRAND.name} termina el ${day(s.until)} (${s.daysLeft === 1 ? "mañana" : `en ${s.daysLeft} días`}). Hablá con nosotros para seguir sin cortes.`;
  } else if (s.kind === "active" && s.daysLeft <= 3) {
    tone = "warn";
    text = `Tu suscripción a ${BRAND.name} vence el ${day(s.until)}. Si ya pagaste, no hace falta que hagas nada.`;
  } else if (s.kind === "overdue") {
    tone = s.days > GRACE_DAYS ? "danger" : "warn";
    text = s.since
      ? `Tu suscripción a ${BRAND.name} venció el ${day(s.since)}. Para seguir usando el sistema, regularizá el pago con nosotros.`
      : `Todavía no registramos el pago de tu suscripción a ${BRAND.name}. Hablá con nosotros para activarla.`;
  }
  if (!tone) return null;
  const Icon = tone === "danger" ? AlertTriangle : Clock;
  return (
    <div
      role="status"
      className={cn(
        "mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        tone === "danger" ? "border-danger/30 bg-danger-soft text-danger" : "border-warn/30 bg-warn-soft text-warn",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{text}</p>
    </div>
  );
}
