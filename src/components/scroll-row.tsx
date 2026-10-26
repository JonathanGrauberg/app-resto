"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/format";

/**
 * Fila que se desliza de costado (categorías, chips). Avisa que hay más:
 * bordes difuminados; en compu, flechas; en celular, una flechita que late hasta que la persona desliza.
 * Mantiene a la vista el elemento activo (`aria-current="true"` o `aria-selected="true"`) cuando cambia `activeKey`.
 */
export function ScrollRow({
  children,
  className,
  rowClassName,
  activeKey,
  arrowClassName,
  label,
  role,
}: {
  children: React.ReactNode;
  /** Contenedor externo (posición, ancho, márgenes). */
  className?: string;
  /** La fila que se desliza (gap, padding). */
  rowClassName?: string;
  activeKey?: string | number;
  arrowClassName?: string;
  label?: string;
  role?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [touched, setTouched] = useState(false);

  const measure = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = rowRef.current;
    const ro = el ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el);
    return () => ro?.disconnect();
  }, [measure]);

  useEffect(() => {
    const row = rowRef.current;
    const item = row?.querySelector<HTMLElement>('[aria-current="true"], [aria-selected="true"]');
    if (!row || !item) return;
    const pad = 48;
    if (item.offsetLeft - pad < row.scrollLeft) row.scrollTo({ left: item.offsetLeft - pad, behavior: "smooth" });
    else if (item.offsetLeft + item.offsetWidth + pad > row.scrollLeft + row.clientWidth)
      row.scrollTo({ left: item.offsetLeft + item.offsetWidth + pad - row.clientWidth, behavior: "smooth" });
  }, [activeKey]);

  const page = (dir: 1 | -1) => rowRef.current?.scrollBy({ left: dir * rowRef.current.clientWidth * 0.8, behavior: "smooth" });
  const arrow = cn(
    "absolute top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-bg/85 ring-1 ring-ink/15 backdrop-blur-md hover:bg-bg sm:flex",
    arrowClassName,
  );

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={rowRef}
        role={role}
        aria-label={label}
        onScroll={() => {
          measure();
          setTouched(true);
        }}
        className={cn("relative flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", rowClassName)}
      >
        {children}
      </div>
      {edges.left && <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-bg to-transparent sm:w-14" />}
      {edges.right && <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-bg to-transparent sm:w-14" />}
      {edges.left && (
        <button type="button" onClick={() => page(-1)} aria-label="Ver anteriores" className={cn(arrow, "left-1")}>
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      )}
      {edges.right && (
        <button type="button" onClick={() => page(1)} aria-label="Ver más" className={cn(arrow, "right-1")}>
          <ChevronRight className="size-5" aria-hidden />
        </button>
      )}
      {/* Celular: pista de que se puede deslizar, hasta que la persona lo hace. */}
      {edges.right && !touched && (
        <span aria-hidden className="pointer-events-none absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-bg/80 ring-1 ring-ink/15 sm:hidden">
          <ChevronRight className="size-4 animate-[nudge_1.4s_ease-in-out_infinite] motion-reduce:animate-none" />
        </span>
      )}
    </div>
  );
}
