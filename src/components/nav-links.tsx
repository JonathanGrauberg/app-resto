"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Armchair,
  BarChart3,
  Building2,
  CalendarDays,
  ChefHat,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  UtensilsCrossed,
  Users,
  Wallet,
  Wine,
} from "lucide-react";
import { cn } from "@/lib/format";
import type { NavItem } from "./app-shell";

const ICONS = {
  dashboard: LayoutDashboard,
  carta: UtensilsCrossed,
  mesas: LayoutGrid,
  personal: Users,
  reservas: CalendarDays,
  metricas: BarChart3,
  ajustes: Settings,
  tenants: Building2,
  cocina: ChefHat,
  bar: Wine,
  caja: Wallet,
  sala: Armchair,
};

export type NavIcon = keyof typeof ICONS;

export function NavLinks({ items, variant }: { items: NavItem[]; variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const params = useSearchParams();
  // Coincide la ruta y, si el ítem tiene query (ej. "/admin/mesas?vista=sala"), también la query.
  const matches = (href: string) => {
    const [path, query] = href.split("?");
    if (pathname !== path && !pathname.startsWith(path + "/")) return false;
    return [...new URLSearchParams(query)].every(([k, v]) => params.get(k) === v);
  };
  // El ítem activo es el de href más largo que coincide (evita que "/admin" quede siempre activo).
  const active = items
    .filter((i) => matches(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  if (variant === "side") {
    return (
      <nav className="flex flex-col gap-0.5 p-3">
        {items.map(({ href, label, icon }) => {
          const Icon = ICONS[icon];
          return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
              active === href ? "bg-brand-soft font-medium text-brand" : "text-ink/80 hover:bg-ink/5",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex print:hidden border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.slice(0, 5).map(({ href, label, icon }) => {
        const Icon = ICONS[icon];
        return (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
            active === href ? "text-brand" : "text-muted",
          )}
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </Link>
        );
      })}
    </nav>
  );
}
