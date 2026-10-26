"use client";

import { useEffect, useState } from "react";
import { YatayLoader } from "@/components/yatay-loader";
import { cn } from "@/lib/format";

/**
 * Al escanear el QR: el logo de Yatay se arma a pantalla completa (~1,6 s) y se desvanece.
 * Una vez por local y por sesión del navegador; no se repite al volver de la carta.
 */
export function QrIntro({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("gone");
  useEffect(() => {
    const key = `yatay:intro:${slug}`;
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
      sessionStorage.setItem(key, "1");
    } catch {}
    if (seen || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = setTimeout(() => setPhase("show"), 0);
    const t1 = setTimeout(() => setPhase("fade"), 1700);
    const t2 = setTimeout(() => setPhase("gone"), 2200);
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
