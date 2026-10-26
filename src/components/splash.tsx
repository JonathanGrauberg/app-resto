"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "./brand-mark";

/** Palmera con un pulso suave: lo que se ve mientras carga una pantalla del panel. */
export function LoadingMark({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
      <span className="relative grid place-items-center">
        <span className="absolute size-20 animate-ping rounded-full bg-brand/15 motion-reduce:animate-none" aria-hidden />
        <BrandMark variant="icon" className="h-14" />
      </span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

/**
 * Pantalla de bienvenida al entrar al panel: el logo a pantalla completa ~1 s y se desvanece.
 * Una vez por sesión del navegador (no en cada cambio de página).
 */
export function EntrySplash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("gone");
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("yatay:splash") === "1";
    } catch {}
    if (seen || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = setTimeout(() => setPhase("show"), 0);
    // Se marca como vista al terminar (si se marcara antes, el doble efecto de desarrollo la saltearía).
    const t1 = setTimeout(() => {
      try {
        sessionStorage.setItem("yatay:splash", "1");
      } catch {}
      setPhase("fade");
    }, 900);
    const t2 = setTimeout(() => setPhase("gone"), 1400);
    return () => [t0, t1, t2].forEach(clearTimeout);
  }, []);
  if (phase === "gone") return null;
  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] grid place-items-center bg-bg transition-opacity duration-500 ${phase === "fade" ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <BrandMark className="h-20 animate-fade-up sm:h-24" priority />
    </div>
  );
}
