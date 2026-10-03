"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type PointerEvent } from "react";
import { Circle, ExternalLink, Plus, Printer, QrCode, RectangleHorizontal, RefreshCw, Settings2, Square, Trash2 } from "lucide-react";
import { QrDialog } from "@/components/qr-dialog";
import type { TableShape, TableStatus } from "@/generated/prisma/enums";
import { STATUS_STYLE } from "@/components/table-map";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input, Switch } from "@/components/ui/field";
import { cn } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";
import {
  createArea,
  createTable,
  deleteArea,
  deleteTable,
  moveTable,
  regenerateQr,
  updateArea,
  updateTable,
} from "./actions";

export type EditorTable = {
  id: string;
  number: string;
  seats: number;
  maxGuests: number;
  shape: TableShape;
  posX: number;
  posY: number;
  width: number;
  height: number;
  status: TableStatus;
  qrToken: string;
  temporary: boolean;
  groupId: string | null;
};
export type EditorArea = { id: string; name: string; width: number; height: number; tables: EditorTable[] };

type Drag = { id: string; pointerX: number; pointerY: number; origX: number; origY: number; x: number; y: number };

const overlaps = (a: EditorTable, b: { posX: number; posY: number; width: number; height: number }) =>
  a.posX < b.posX + b.width && b.posX < a.posX + a.width && a.posY < b.posY + b.height && b.posY < a.posY + a.height;

export function FloorEditor({ areas, slug, venue }: { areas: EditorArea[]; slug: string; venue: string }) {
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Posiciones ya soltadas que el servidor todavía no confirmó (evita el "salto" al soltar).
  const [moved, setMoved] = useState<Record<string, { posX: number; posY: number }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [, start] = useTransition();
  const canvasRef = useRef<HTMLDivElement>(null);

  const area = areas.find((a) => a.id === areaId) ?? areas[0];
  if (!area) return <NewAreaCard first />;

  const tables = area.tables.map((t) => {
    if (drag?.id === t.id) return { ...t, posX: drag.x, posY: drag.y };
    return moved[t.id] ? { ...t, ...moved[t.id] } : t;
  });
  const selected = tables.find((t) => t.id === selectedId) ?? null;

  // Mesas juntadas en este momento (desde Sala): se dibujan con un contorno común y su etiqueta.
  const groups = (() => {
    const byGroup = new Map<string, EditorTable[]>();
    for (const t of tables) if (t.groupId) byGroup.set(t.groupId, [...(byGroup.get(t.groupId) ?? []), t]);
    return [...byGroup.values()].map((members) => {
      const sorted = [...members].sort((a, b) => a.number.localeCompare(b.number, "es", { numeric: true }));
      return {
        key: members[0].groupId!,
        label: sorted.map((m) => m.number).join("+"),
        x1: Math.min(...members.map((m) => m.posX)),
        y1: Math.min(...members.map((m) => m.posY)),
        x2: Math.max(...members.map((m) => m.posX + m.width)),
        y2: Math.max(...members.map((m) => m.posY + m.height)),
      };
    });
  })();

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, t: EditorTable) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(t.id);
    setMessage(null);
    setDrag({ id: t.id, pointerX: e.clientX, pointerY: e.clientY, origX: t.posX, origY: t.posY, x: t.posX, y: t.posY });
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag || !canvasRef.current) return;
    const cell = canvasRef.current.getBoundingClientRect().width / area.width;
    const t = area.tables.find((x) => x.id === drag.id)!;
    const x = Math.min(Math.max(0, drag.origX + Math.round((e.clientX - drag.pointerX) / cell)), area.width - t.width);
    const y = Math.min(Math.max(0, drag.origY + Math.round((e.clientY - drag.pointerY) / cell)), area.height - t.height);
    if (x !== drag.x || y !== drag.y) setDrag({ ...drag, x, y });
  };

  const onPointerUp = () => {
    if (!drag) return;
    const { id, x, y, origX, origY } = drag;
    setDrag(null);
    if (x === origX && y === origY) return;
    const t = area.tables.find((tt) => tt.id === id)!;
    const target = { posX: x, posY: y, width: t.width, height: t.height };
    if (tables.some((o) => o.id !== id && overlaps(o, target))) {
      setMessage("No se puede superponer con otra mesa");
      return;
    }
    setMoved((m) => ({ ...m, [id]: { posX: x, posY: y } }));
    start(async () => {
      const res = await moveTable(id, x, y);
      if (res?.error) {
        setMessage(res.error);
        setMoved((m) => {
          const next = { ...m };
          delete next[id];
          return next;
        });
      }
    });
  };

  const addTable = () =>
    start(async () => {
      const res = await createTable(area.id);
      if (res?.error) setMessage(res.error);
      else if (res?.id) setSelectedId(res.id);
    });

  return (
    <div className="space-y-4">
      {/* Salones */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Salones">
          {areas.map((a) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={a.id === area.id}
              onClick={() => {
                setAreaId(a.id);
                setSelectedId(null);
              }}
              className={cn(
                "rounded-full px-4 py-2 text-sm",
                a.id === area.id ? "bg-ink text-bg" : "bg-surface ring-1 ring-line hover:ring-ink/30",
              )}
            >
              {a.name} <span className="opacity-60">· {a.tables.length}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSelectedId(null)}>
            <Settings2 className="size-4" aria-hidden /> Salón
          </Button>
          <Link
            href={`/admin/mesas/qr?salon=${area.id}`}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:bg-bg"
          >
            <Printer className="size-4" aria-hidden /> Imprimir QR
          </Link>
          <Button onClick={addTable}>
            <Plus className="size-4" aria-hidden /> Añadir mesa
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <div>
          <div
            className="overflow-hidden rounded-2xl border border-line bg-surface"
            style={{
              backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--ink) 14%, transparent) 1px, transparent 1px)",
              backgroundSize: `${100 / area.width}% ${100 / area.height}%`,
            }}
          >
            <div
              ref={canvasRef}
              className="relative w-full select-none"
              style={{ aspectRatio: `${area.width} / ${area.height}` }}
              onPointerDown={(e) => e.target === e.currentTarget && setSelectedId(null)}
            >
              {groups.map((g) => (
                <div
                  key={g.key}
                  className="pointer-events-none absolute rounded-2xl border-2 border-dashed border-brand/70 bg-brand-soft/60"
                  style={{
                    left: `calc(${(g.x1 / area.width) * 100}% - 4px)`,
                    top: `calc(${(g.y1 / area.height) * 100}% - 4px)`,
                    width: `calc(${((g.x2 - g.x1) / area.width) * 100}% + 8px)`,
                    height: `calc(${((g.y2 - g.y1) / area.height) * 100}% + 8px)`,
                  }}
                >
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-ink">
                    {g.label}
                  </span>
                </div>
              ))}
              {tables.map((t) => {
                const style = STATUS_STYLE[t.status];
                const isSel = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onPointerDown={(e) => onPointerDown(e, t)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => setDrag(null)}
                    aria-label={`Mesa ${t.number}, ${t.seats} sillas. Arrastrá para mover.`}
                    className={cn(
                      "absolute flex touch-none flex-col items-center justify-center border-2 text-center leading-tight shadow-sm",
                      drag?.id === t.id ? "z-10 cursor-grabbing shadow-lg" : "cursor-grab transition-[left,top] duration-150",
                      t.shape === "ROUND" ? "rounded-full" : "rounded-xl",
                      style.className,
                      t.temporary && "border-dashed",
                      isSel && "ring-4 ring-brand/40",
                    )}
                    style={{
                      left: `${(t.posX / area.width) * 100}%`,
                      top: `${(t.posY / area.height) * 100}%`,
                      width: `${(t.width / area.width) * 100}%`,
                      height: `${(t.height / area.height) * 100}%`,
                    }}
                  >
                    <span className="text-[clamp(10px,1.8vw,16px)] font-semibold">{t.number}</span>
                    <span className="hidden text-[10px] opacity-70 sm:block">{t.seats} p.</span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Arrastrá las mesas para ubicarlas (se ajustan a la grilla). Tocá una mesa para editarla.
          </p>
          {message && <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{message}</p>}
          {groups.length > 0 && (
            <p className="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm">
              Juntadas ahora: <strong>{groups.map((g) => g.label).join(", ")}</strong>. Se separan solas al cobrar, o desde{" "}
              <Link href="/admin/mesas?vista=sala" className="font-medium text-brand underline-offset-2 hover:underline">
                Sala en vivo
              </Link>
              .
            </p>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-8">
          {selected ? (
            <TablePanel key={selected.id} table={selected} slug={slug} venue={venue} onDeleted={() => setSelectedId(null)} />
          ) : (
            <AreaPanel key={area.id} area={area} onDeleted={() => setAreaId(areas.find((a) => a.id !== area.id)?.id ?? "")} />
          )}
          <NewAreaCard />
        </div>
      </div>
    </div>
  );
}

const SHAPES: { value: TableShape; label: string; icon: typeof Square }[] = [
  { value: "SQUARE", label: "Cuadrada", icon: Square },
  { value: "ROUND", label: "Redonda", icon: Circle },
  { value: "RECT", label: "Rectangular", icon: RectangleHorizontal },
];

function TablePanel({
  table: t,
  slug,
  venue,
  onDeleted,
}: {
  table: EditorTable;
  slug: string;
  venue: string;
  onDeleted: () => void;
}) {
  const [state, action, pending] = useFormAction(updateTable.bind(null, t.id), undefined);
  const [showQr, setShowQr] = useState(false);
  const fe = state?.fieldErrors ?? {};

  return (
    <Card className="p-4">
      <form onSubmit={action} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Mesa {t.number}</h2>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs", STATUS_STYLE[t.status].className)}>
            {STATUS_STYLE[t.status].label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Número" htmlFor="t-number" error={fe.number}>
            <Input id="t-number" name="number" defaultValue={t.number} maxLength={6} required />
          </Field>
          <Field label="Sillas" htmlFor="t-seats" error={fe.seats}>
            <Input id="t-seats" name="seats" type="number" min={1} max={30} defaultValue={t.seats} required />
          </Field>
          <Field label="Tope" htmlFor="t-max" error={fe.maxGuests}>
            <Input id="t-max" name="maxGuests" type="number" min={1} max={40} defaultValue={t.maxGuests} required />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">Tope: máximo de personas permitido (por ejemplo, agregando sillas).</p>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Forma</legend>
          <div className="grid grid-cols-3 gap-2">
            {SHAPES.map(({ value, label, icon: Icon }) => (
              <label
                key={value}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-line p-2 text-xs has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              >
                <input type="radio" name="shape" value={value} defaultChecked={t.shape === value} className="sr-only" />
                <Icon className="size-5" aria-hidden />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ancho" htmlFor="t-w" hint="En celdas">
            <Input id="t-w" name="width" type="number" min={1} max={8} defaultValue={t.width} />
          </Field>
          <Field label="Largo" htmlFor="t-h" hint="En celdas">
            <Input id="t-h" name="height" type="number" min={1} max={8} defaultValue={t.height} />
          </Field>
        </div>

        <Switch name="disabled" defaultChecked={t.status === "DISABLED"} label="Deshabilitada" description="No acepta pedidos ni reservas (y su QR no funciona)" />

        <FormError message={state?.error} />
        <FormSuccess message={state?.ok} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Guardando…" : "Guardar mesa"}
        </Button>
      </form>

      <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
        <button
          type="button"
          onClick={() => setShowQr(true)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-ink/5"
        >
          <QrCode className="size-4 text-muted" aria-hidden /> Mostrar / imprimir QR de esta mesa
        </button>
        <Link href={`/${slug}/m/${t.qrToken}`} target="_blank" className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-ink/5">
          <ExternalLink className="size-4 text-muted" aria-hidden /> Abrir como comensal
        </Link>
        <ActionButton
          action={() => regenerateQr(t.id)}
          confirm="El QR impreso actual dejará de funcionar. ¿Continuar?"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-ink/5"
        >
          <RefreshCw className="size-4 text-muted" aria-hidden /> Regenerar QR
        </ActionButton>
        <ActionButton
          action={async () => {
            const res = await deleteTable(t.id);
            if (!res?.error) onDeleted();
            return res;
          }}
          confirm={`¿Borrar la mesa ${t.number}?`}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-danger hover:bg-danger-soft"
        >
          <Trash2 className="size-4" aria-hidden /> Borrar mesa
        </ActionButton>
      </div>
      {showQr && <QrDialog path={`/${slug}/m/${t.qrToken}`} title={`Mesa ${t.number}`} venue={venue} onClose={() => setShowQr(false)} />}
    </Card>
  );
}

function AreaPanel({ area, onDeleted }: { area: EditorArea; onDeleted: () => void }) {
  const [state, action, pending] = useFormAction(updateArea.bind(null, area.id), undefined);
  const fe = state?.fieldErrors ?? {};
  const seats = area.tables.reduce((n, t) => n + t.seats, 0);

  return (
    <Card className="p-4">
      <form onSubmit={action} className="space-y-4">
        <div>
          <h2 className="font-semibold">Salón</h2>
          <p className="text-sm text-muted">
            {area.tables.length} mesas · {seats} sillas
          </p>
        </div>
        <Field label="Nombre" htmlFor="a-name" error={fe.name}>
          <Input id="a-name" name="name" defaultValue={area.name} required maxLength={30} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ancho del plano" htmlFor="a-w" hint="Celdas (6–40)" error={fe.width}>
            <Input id="a-w" name="width" type="number" min={6} max={40} defaultValue={area.width} />
          </Field>
          <Field label="Largo del plano" htmlFor="a-h" hint="Celdas (4–30)" error={fe.height}>
            <Input id="a-h" name="height" type="number" min={4} max={30} defaultValue={area.height} />
          </Field>
        </div>
        <FormError message={state?.error} />
        <FormSuccess message={state?.ok} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Guardando…" : "Guardar salón"}
        </Button>
      </form>
      <ActionButton
        action={async () => {
          const res = await deleteArea(area.id);
          if (!res?.error) onDeleted();
          return res;
        }}
        confirm={`¿Borrar el salón "${area.name}" y sus ${area.tables.length} mesas?`}
        className="mt-3 flex w-full items-center gap-2 rounded-lg border-t border-line px-2 pt-3 text-left text-sm text-danger"
      >
        <Trash2 className="size-4" aria-hidden /> Borrar salón
      </ActionButton>
    </Card>
  );
}

function NewAreaCard({ first }: { first?: boolean }) {
  const [state, action, pending] = useFormAction(createArea, undefined);
  return (
    <Card className="p-4">
      <form onSubmit={action} key={state?.at ?? 0} className="space-y-3">
        <p className="text-sm font-medium">{first ? "Creá tu primer salón" : "Nuevo salón"}</p>
        <div className="flex gap-2">
          <Input name="name" placeholder="Ej. Terraza, Planta alta" aria-label="Nombre del salón" required maxLength={30} />
          <Button type="submit" variant="secondary" disabled={pending}>
            Crear
          </Button>
        </div>
        <FormError message={state?.error} />
      </form>
    </Card>
  );
}
