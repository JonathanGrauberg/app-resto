import { CIRCLE, FULL_WIDTH, LEAVES, LETTERS, TRUNK } from "./yatay-logo-paths";
import { cn } from "@/lib/format";

/**
 * Logo de Yatay que se arma: el círculo aparece, sube el tronco-tenedor, se abren las hojas
 * y entran las letras una por una; después la palmera "respira" mientras siga cargando.
 * Animación en CSS (ver `@keyframes yl-*` en globals.css); respeta "reducir movimiento".
 */
export function YatayLoader({ letters = true, letterColor = "#ffffff", className }: { letters?: boolean; letterColor?: string; className?: string }) {
  return (
    <svg viewBox={`0 0 ${letters ? FULL_WIDTH : 187} 187`} className={cn("yatay-loader", className)} role="img" aria-label="Yatay">
      <path d={CIRCLE.d} fill="#009375" className="yl-circle" />
      <g className="yl-trunk">
        <path d={TRUNK.d} transform={`translate(${TRUNK.x} ${TRUNK.y})`} fill="#ffffff" />
      </g>
      <g className="yl-leaves">
        <path d={LEAVES.d} transform={`translate(${LEAVES.x} ${LEAVES.y})`} fill="#ffffff" />
      </g>
      {letters &&
        LETTERS.map((l, i) => (
          // La posición va en el grupo: la animación (CSS transform) pisaría el `transform` del mismo elemento.
          <g key={i} transform={`translate(${l.x} ${l.y})`}>
            <path d={l.d} fill={letterColor} className="yl-letter" style={{ animationDelay: `${0.85 + i * 0.09}s` }} />
          </g>
        ))}
    </svg>
  );
}

/** Pantalla completa con el logo armándose (carga al escanear el QR de la mesa). */
export function YatayLoadingScreen({ dark = true }: { dark?: boolean }) {
  return (
    <div className={cn("fixed inset-0 z-[90] grid place-items-center", dark ? "bg-[#0b0a09]" : "bg-[#f6f9f8]")} role="status" aria-label="Cargando">
      <YatayLoader className="w-56 max-w-[70vw]" letterColor={dark ? "#ffffff" : "#00806a"} />
    </div>
  );
}
