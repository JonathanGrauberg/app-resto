"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CalendarDays, Clock, Loader2, Minus, Plus, Users } from "lucide-react";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/format";
import { book, getSlots } from "./actions";

type Slot = { time: string; available: boolean };

const dayLabel = (date: string, i: number) => {
  if (i === 0) return { top: "Hoy", bottom: shortDate(date) };
  if (i === 1) return { top: "Mañana", bottom: shortDate(date) };
  const d = new Date(`${date}T12:00:00Z`);
  return { top: d.toLocaleDateString("es-ES", { weekday: "short", timeZone: "UTC" }), bottom: shortDate(date) };
};
const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });

export function BookingForm({
  slug,
  venue,
  days,
  maxParty,
  notice,
  phone,
  durationMin,
}: {
  slug: string;
  venue: string;
  days: string[];
  maxParty: number;
  notice: string | null;
  phone: string | null;
  durationMin: number;
}) {
  const router = useRouter();
  const [party, setParty] = useState(2);
  const [date, setDate] = useState(days[0]);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});

  // Cada vez que cambia el día o la cantidad, se vuelve a consultar la disponibilidad.
  useEffect(() => {
    startLoading(async () => {
      const res = await getSlots(slug, date, party);
      setSlots(res);
      setTime((t) => (t && res.some((s) => s.time === t && s.available) ? t : null));
    });
  }, [slug, date, party]);

  const lunch = slots?.filter((s) => s.time < "17:00") ?? [];
  const dinner = slots?.filter((s) => s.time >= "17:00") ?? [];
  const anyFree = slots?.some((s) => s.available);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!time) return setError("Elegí un horario");
    const f = new FormData(e.currentTarget);
    startSending(async () => {
      const res = await book(slug, {
        date,
        time,
        party,
        name: String(f.get("name") ?? ""),
        phone: String(f.get("phone") ?? ""),
        email: String(f.get("email") ?? ""),
        notes: String(f.get("notes") ?? ""),
        consent: (f.get("consent") === "on") as true,
        website: String(f.get("website") ?? ""),
      });
      if ("code" in res) return router.push(`/${slug}/reserva/${res.code}`);
      setError(res.error);
      setFe(res.fieldErrors ?? {});
      // Si el horario se ocupó mientras completaba, se refresca la grilla.
      if (!res.fieldErrors) setSlots(await getSlots(slug, date, party));
    });
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* Personas */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
          <Users className="size-4" aria-hidden /> ¿Cuántos son?
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-2xl border border-line bg-surface">
            <button type="button" onClick={() => setParty((p) => Math.max(1, p - 1))} disabled={party <= 1} className="p-4 disabled:opacity-30" aria-label="Una persona menos">
              <Minus className="size-5" aria-hidden />
            </button>
            <span className="w-12 text-center text-3xl font-bold tabular-nums" aria-live="polite">
              {party}
            </span>
            <button type="button" onClick={() => setParty((p) => Math.min(maxParty, p + 1))} disabled={party >= maxParty} className="p-4 disabled:opacity-30" aria-label="Una persona más">
              <Plus className="size-5" aria-hidden />
            </button>
          </div>
          <p className="text-sm text-muted">
            {party === 1 ? "persona" : "personas"}
            {party >= maxParty && (
              <span className="block">¿Son más? {phone ? `Llamanos al ${phone}.` : "Consultá con el local."}</span>
            )}
          </p>
        </div>
      </section>

      {/* Día */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
          <CalendarDays className="size-4" aria-hidden /> Día
        </h2>
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2" role="radiogroup" aria-label="Día">
          {days.map((d, i) => {
            const l = dayLabel(d, i);
            const on = d === date;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setDate(d)}
                className={cn(
                  "flex w-20 shrink-0 snap-start flex-col items-center rounded-2xl border py-3 capitalize transition-colors",
                  on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface hover:border-ink/30",
                )}
              >
                <span className="text-sm font-semibold">{l.top}</span>
                <span className={cn("text-xs", on ? "opacity-80" : "text-muted")}>{l.bottom}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Horario */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
          <Clock className="size-4" aria-hidden /> Horario
          {loading && <Loader2 className="size-4 animate-spin" aria-label="Buscando horarios" />}
        </h2>
        {slots === null ? (
          <p className="text-sm text-muted">Buscando horarios…</p>
        ) : !anyFree ? (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
            No quedan mesas para {party} {party === 1 ? "persona" : "personas"} ese día. Probá otro día
            {phone ? ` o llamanos al ${phone}` : ""}.
          </p>
        ) : (
          <div className={cn("space-y-4 transition-opacity", loading && "opacity-50")}>
            {[
              { label: "Mediodía", list: lunch },
              { label: "Noche", list: dinner },
            ]
              .filter((g) => g.list.length)
              .map((g) => (
                <div key={g.label}>
                  <p className="mb-2 text-xs text-muted">{g.label}</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={`Horarios ${g.label}`}>
                    {g.list.map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        role="radio"
                        aria-checked={time === s.time}
                        disabled={!s.available}
                        onClick={() => setTime(s.time)}
                        className={cn(
                          "rounded-xl border py-2.5 text-sm font-semibold tabular-nums transition-colors",
                          time === s.time
                            ? "border-brand bg-brand text-brand-ink"
                            : s.available
                              ? "border-line bg-surface hover:border-ink/30"
                              : "border-transparent text-muted/50 line-through",
                        )}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            <p className="text-xs text-muted">La mesa queda reservada {durationMin >= 60 ? `${Math.round((durationMin / 60) * 10) / 10} h` : `${durationMin} min`}.</p>
          </div>
        )}
      </section>

      {/* Datos */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Tus datos</h2>
        <Field label="Nombre" htmlFor="b-name" error={fe.name}>
          <Input id="b-name" name="name" autoComplete="name" required maxLength={60} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono" htmlFor="b-phone" hint="Por si hay que avisarte algo" error={fe.phone}>
            <Input id="b-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={20} />
          </Field>
          <Field label="Email (opcional)" htmlFor="b-email" hint="Te mandamos la confirmación" error={fe.email}>
            <Input id="b-email" name="email" type="email" autoComplete="email" maxLength={120} />
          </Field>
        </div>
        <Field label="Comentarios (opcional)" htmlFor="b-notes" hint="Alergias, silla para bebé, celebración…" error={fe.notes}>
          <Textarea id="b-notes" name="notes" maxLength={300} rows={2} />
        </Field>
        {/* Trampa para bots: invisible para las personas. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        {notice && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm">{notice}</p>}
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
          <span className="text-muted">
            Acepto que {venue} use estos datos solo para gestionar mi reserva (confirmarla, avisarme cambios). No se usan para
            publicidad.
          </span>
        </label>
        {fe.consent && <p className="text-xs text-danger">{fe.consent}</p>}
      </section>

      <FormError message={error} />
      <button
        type="submit"
        disabled={sending || !time}
        className="sticky bottom-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink text-base font-semibold text-bg shadow-xl disabled:opacity-40"
      >
        {sending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : time ? (
          `Reservar · ${party} ${party === 1 ? "persona" : "personas"} · ${shortDate(date)} · ${time}`
        ) : (
          "Elegí un horario"
        )}
      </button>
    </form>
  );
}
