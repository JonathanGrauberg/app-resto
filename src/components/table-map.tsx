import type { TableShape, TableStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/format";

export type MapTable = {
  id: string;
  number: string;
  seats: number;
  shape: TableShape;
  posX: number;
  posY: number;
  width: number;
  height: number;
  status: TableStatus;
  waiterName?: string | null;
  guests?: number | null;
};

export const STATUS_STYLE: Record<TableStatus, { label: string; className: string }> = {
  FREE: { label: "Libre", className: "border-line bg-surface text-ink" },
  OCCUPIED: { label: "Ocupada", className: "border-brand bg-brand-soft text-brand" },
  PENDING_PAYMENT: { label: "Pendiente de cobro", className: "border-warn bg-warn-soft text-warn" },
  DISABLED: { label: "Deshabilitada", className: "border-dashed border-line bg-bg text-muted" },
};

/**
 * Plano de un salón (solo lectura). La grilla escala al ancho disponible,
 * así funciona igual en celular, tablet y PC.
 * El editor arrastrable llega en Fase 1.
 */
export function TableMap({
  width,
  height,
  tables,
  hrefFor,
}: {
  width: number;
  height: number;
  tables: MapTable[];
  hrefFor?: (t: MapTable) => string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[radial-gradient(circle,_rgb(0_0_0/0.06)_1px,_transparent_1px)] bg-[size:24px_24px] bg-surface">
      <div
        className="relative w-full"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {tables.map((t) => {
          const style = STATUS_STYLE[t.status];
          const Tag = hrefFor ? "a" : "div";
          return (
            <Tag
              key={t.id}
              href={hrefFor?.(t)}
              title={`Mesa ${t.number} · ${t.seats} sillas · ${style.label}`}
              className={cn(
                "absolute flex flex-col items-center justify-center border-2 text-center leading-tight shadow-sm transition-transform",
                hrefFor && "hover:scale-[1.03]",
                t.shape === "ROUND" ? "rounded-full" : "rounded-xl",
                style.className,
              )}
              style={{
                left: `${(t.posX / width) * 100}%`,
                top: `${(t.posY / height) * 100}%`,
                width: `${(t.width / width) * 100}%`,
                height: `${(t.height / height) * 100}%`,
              }}
            >
              <span className="text-[clamp(10px,2.2vw,16px)] font-semibold">{t.number}</span>
              <span className="hidden text-[10px] opacity-70 sm:block">
                {t.guests ? `${t.guests}/${t.seats}` : `${t.seats} p.`}
              </span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

export function TableLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted">
      {Object.entries(STATUS_STYLE).map(([key, s]) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className={cn("size-3 rounded border-2", s.className)} /> {s.label}
        </span>
      ))}
    </div>
  );
}
