"use client";

import { useEffect, useState } from "react";
import { YatayLoader } from "@/components/yatay-loader";
import { cn } from "@/lib/format";

/**
 * Al escanear el QR: el logo de Yatay se arma a pantalla completa (~1,6 s) y se desvanece.
 * Una vez por local y por pestaña (sesión del navegador); no se repite al volver de la carta.
 * Se ve al entrar por el QR de una mesa o por la página de enlaces del local.
 */
export function QrIntro({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("gone");
  useEffect(() => {
    const key = `yatay:intro:${slug}`;
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
    } catch {}
    if (seen) return;
    // Se marca como vista recién al mostrarse (si se marcara antes, el doble efecto de desarrollo la saltearía).
    const markSeen = () => {
      try {
        sessionStorage.setItem(key, "1");
      } catch {}
    };
    // Con "reducir movimiento" el logo aparece armado (sin animación) y dura menos.
    const quiet = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = setTimeout(() => setPhase("show"), 0);
    const t1 = setTimeout(() => {
      markSeen();
      setPhase("fade");
    }, quiet ? 900 : 1700);
    const t2 = setTimeout(() => setPhase("gone"), quiet ? 1300 : 2200);
    return () => [t0, t1, t2].forEach(clearTimeout);
  }, [slug]);
  if (phase === "gone") return null;
  return (
    <div
      aria-hidden
      className={cn("fixed inset-0 z-[90] grid place-items-center bg-[#0b0a09] transition-opacity duration-500", phase === "fade" && "pointer-events-none opacity-0")}
    >
      <YatayLoader className="w-56 max-w-[70vw]" />
    </div>
  );
}
