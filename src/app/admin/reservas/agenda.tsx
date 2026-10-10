"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Armchair, Globe, Mail, Phone, Plus, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";
import { createStaffBooking, seatReservation, setReservationStatus } from "./actions";

type Row = {
  id: string;
  startsAt: string;
  name: string;
  phone: string | null;
  email: string | null;
  party: number;
  notes: string | null;
  status: "CONFIRMED" | "SEATED" | "NO_SHOW" | "CANCELLED" | "COMPLETED";
  source: "PUBLIC" | "STAFF";
  tables: string[];
};

const STATUS: Record<Row["status"], { label: string; tone: "brand" | "neutral" | "danger" | "ok" }> = {
  CONFIRMED: { label: "Confirmada", tone: "brand" },
  SEATED: { label: "En la mesa", tone: "ok" },
  COMPLETED: { label: "Completada", tone: "neutral" },
  NO_SHOW: { label: "No vino", tone: "danger" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
};

export function Agenda({ rows, timezone }: { rows: Row[]; timezone: string }) {
  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted">
        No hay reservas este día. Las que entren por la web aparecen acá solas (y suena un aviso en caja).
      </Card>
    );
  }
  return (
    <Card className="divide-y divide-line">
      {rows.map((r) => (
        <ReservationRow key={r.id} r={r} timezone={timezone} />
      ))}
    </Card>
  );
}

function ReservationRow({ r, timezone }: { r: Row; timezone: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const run = (fn: () => Promise<{ ok?: string; error?: string } | undefined>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const res = await fn();
      setMsg(res ?? null);
      router.refresh();
    });
  };
  const time = new Date(r.startsAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  const st = STATUS[r.status];
  const done = r.status === "CANCELLED" || r.status === "NO_SHOW";

  return (
    <div className={cn("flex flex-wrap items-start gap-x-4 gap-y-2 p-4", done && "opacity-60", pending && "opacity-60")}>
      <p className="w-14 shrink-0 text-xl font-bold tabular-nums">{time}</p>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className={cn("font-semibold", done && "line-through")}>{r.name}</p>
          <Badge tone={st.tone}>{st.label}</Badge>
          {r.source === "PUBLIC" && (
            <Badge>
              <Globe className="size-3" aria-hidden /> Web
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm">
          <strong>{r.party}</strong> {r.party === 1 ? "persona" : "personas"} · Mesa {r.tables.join("+") || "—"}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
          {r.phone && (
            <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-ink">
              <Phone className="size-3.5" aria-hidden /> {r.phone}
            </a>
          )}
          {r.email && (
            <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:text-ink">
              <Mail className="size-3.5" aria-hidden /> {r.email}
            </a>
          )}
        </p>
        {r.notes && <p className="mt-1 rounded-lg bg-warn-soft px-2 py-1 text-sm text-warn">“{r.notes}”</p>}
        {msg?.error && <p className="mt-2 text-sm text-danger">{msg.error}</p>}
      </div>
      {r.status === "CONFIRMED" && (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            onClick={() => run(() => seatReservation(r.id))}
            disabled={pending}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ok px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Armchair className="size-4" aria-hidden /> Llegaron
          </button>
          <button
            onClick={() => run(() => setReservationStatus(r.id, "NO_SHOW"), `¿Marcar que ${r.name} no vino? La mesa queda libre.`)}
            disabled={pending}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm hover:bg-ink/5"
          >
            <UserX className="size-4" aria-hidden /> No vino
          </button>
          <button
            onClick={() =>
              run(
                () => setReservationStatus(r.id, "CANCELLED"),
                `¿Cancelar la reserva de ${r.name}?${r.email ? " Le avisamos por email." : ""}`,
              )
            }
            disabled={pending}
            aria-label="Cancelar reserva"
            title="Cancelar reserva"
            className="inline-flex size-10 items-center justify-center rounded-xl border border-line text-danger hover:bg-danger-soft"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

type TableOpt = { id: string; number: string; seats: number; area: string };

/** Reserva cargada por el local (teléfono, evento). Mesas automáticas o elegidas a mano (varias = evento). */
export function NewBooking({ date, tables, durationMin }: { date: string; tables: TableOpt[]; durationMin: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(createStaffBooking, undefined);
  const [manual, setManual] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const fe = state?.fieldErrors ?? {};
  const areas = [...new Set(tables.map((t) => t.area))];
  const seats = tables.filter((t) => picked.includes(t.id)).reduce((n, t) => n + t.seats, 0);
  // Reservada: se cierra el formulario y queda el mensaje de confirmación.
  const [seenAt, setSeenAt] = useState(state?.at);
  if (state?.at && state.at !== seenAt) {
    setSeenAt(state?.at);
    setOpen(false);
    setManual(false);
    setPicked([]);
  }

  if (!open) {
    return (
      <div className="space-y-3 lg:sticky lg:top-8">
        <Button className="w-full" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden /> Nueva reserva
        </Button>
        {state?.ok && <FormSuccess message={state.ok} />}
        <p className="text-xs text-muted">Para reservas por teléfono o eventos (varias mesas juntas).</p>
      </div>
    );
  }

  return (
    <Card className="p-4 lg:sticky lg:top-8">
      <form onSubmit={action} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Nueva reserva</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-full p-1.5 hover:bg-ink/5">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Día" htmlFor="nb-date" error={fe.date} className="col-span-3 sm:col-span-1 lg:col-span-3">
            <Input id="nb-date" name="date" type="date" defaultValue={date} required />
          </Field>
          <Field label="Hora" htmlFor="nb-time" error={fe.time} className="col-span-2 sm:col-span-1 lg:col-span-2">
            <Input id="nb-time" name="time" type="time" defaultValue="21:00" required />
          </Field>
          <Field label="Personas" htmlFor="nb-party" error={fe.party}>
            <Input id="nb-party" name="party" type="number" inputMode="numeric" min={1} max={200} defaultValue={2} required />
          </Field>
        </div>
        <Field label="Nombre" htmlFor="nb-name" error={fe.name}>
          <Input id="nb-name" name="name" required maxLength={60} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono" htmlFor="nb-phone" error={fe.phone}>
            <Input id="nb-phone" name="phone" type="tel" maxLength={20} />
          </Field>
          <Field label="Email" htmlFor="nb-email" hint="Le llega la confirmación" error={fe.email}>
            <Input id="nb-email" name="email" type="email" maxLength={120} />
          </Field>
        </div>
        <Field label="Notas" htmlFor="nb-notes" hint="Evento, alergias, celebración…" error={fe.notes}>
          <Textarea id="nb-notes" name="notes" rows={2} maxLength={300} />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Mesa</legend>
          <div className="flex rounded-xl bg-ink/5 p-1 text-sm">
            {[
              { on: !manual, label: "Automática", set: () => (setManual(false), setPicked([])) },
              { on: manual, label: "Elegir mesas", set: () => setManual(true) },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={o.set}
                className={cn("flex-1 rounded-lg py-1.5 font-medium", o.on ? "bg-surface shadow-sm" : "text-muted")}
              >
                {o.label}
              </button>
            ))}
          </div>
          {manual && (
            <div className="mt-3 space-y-2">
              {areas.map((a) => (
                <div key={a}>
                  <p className="mb-1 text-xs text-muted">{a}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tables
                      .filter((t) => t.area === a)
                      .map((t) => (
                        <label
                          key={t.id}
                          className="cursor-pointer rounded-lg border border-line px-2.5 py-1 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand"
                        >
                          <input
                            type="checkbox"
                            name="tableIds"
                            value={t.id}
                            checked={picked.includes(t.id)}
                            onChange={() => setPicked((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                            className="sr-only"
                          />
                          {t.number} <span className="text-xs opacity-60">· {t.seats}</span>
                        </label>
                      ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted">
                {picked.length ? `${picked.length} ${picked.length === 1 ? "mesa" : "mesas"} · ${seats} sillas` : "Elegí una o varias (evento)."}
              </p>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">Ocupa la mesa {durationMin} min. Si se pisa con otra reserva, avisa.</p>
        </fieldset>

        <FormError message={state?.error} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Reservando…" : "Confirmar reserva"}
        </Button>
      </form>
    </Card>
  );
}
