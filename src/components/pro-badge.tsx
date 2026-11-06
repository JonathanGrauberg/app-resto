import { PRO_GOLD } from "@/lib/brand";
import { cn } from "@/lib/format";

/** Coronita dorada del plan Pro. */
export function ProCrown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4 shrink-0", className)} aria-hidden>
      <path
        d="M3.5 8.2 7.7 11.6 12 4.8l4.3 6.8 4.2-3.4-1.9 10.3H5.4L3.5 8.2Z"
        fill={PRO_GOLD}
        stroke="#b07d00"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect x="5.4" y="19.2" width="13.2" height="2" rx="1" fill={PRO_GOLD} stroke="#b07d00" strokeWidth="1" />
      <circle cx="12" cy="4.6" r="1.4" fill={PRO_GOLD} stroke="#b07d00" strokeWidth="1" />
    </svg>
  );
}

/** "👑 Plan PRO" (con "VIP" si corresponde): para que se note y den ganas de decir "soy PRO". */
export function ProBadge({ vip, className, size = "sm" }: { vip?: boolean; className?: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[#1a1714] font-bold uppercase tracking-wide text-[#fcc107] ring-1 ring-[#fcc107]/70",
        size === "lg" ? "px-3.5 py-1.5 text-sm" : "px-2 py-0.5 text-[10px]",
        className,
      )}
    >
      <ProCrown className={size === "lg" ? "size-5" : "size-3.5"} />
      Plan PRO{vip && " · VIP"}
    </span>
  );
}
