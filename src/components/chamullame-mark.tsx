import { cn } from "@/lib/format";

/**
 * Logo provisorio de Chamullame (la app social que se suma a Yatay): un globito de diálogo naranja
 * con "CH". Se reemplaza acá cuando esté el logo definitivo.
 */
export function ChamullameMark({ className, title = "Chamullame" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 56" className={cn("h-8 w-auto", className)} role="img" aria-label={title}>
      <path
        d="M32 3C16.5 3 4 12.4 4 24c0 6.4 3.8 12.1 9.8 16L9 52l14-8.3c2.9.6 5.9.9 9 .9 15.5 0 28-9.4 28-21S47.5 3 32 3Z"
        fill="#ff8a3d"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text x="32" y="32" textAnchor="middle" fontSize="22" fontWeight="900" fontStyle="italic" fill="#2b3a9a" fontFamily="'Arial Black', 'Segoe UI', system-ui, sans-serif">
        CH
      </text>
    </svg>
  );
}

/** Logo + nombre ("Chamullame"). */
export function ChamullameWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-black italic tracking-tight", className)}>
      <ChamullameMark className="h-[1.6em]" />
      Chamullame
    </span>
  );
}
