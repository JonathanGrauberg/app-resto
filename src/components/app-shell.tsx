import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { BrandMark } from "./brand-mark";
import { NavLinks, type NavIcon } from "./nav-links";
import { EntrySplash } from "./splash";

export type NavItem = { href: string; label: string; icon: NavIcon };

/**
 * Layout de paneles internos (admin, plataforma).
 * Desktop/tablet: barra lateral. Celular: cabecera + barra de navegación inferior.
 */
export function AppShell({
  title,
  subtitle,
  nav,
  userName,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  userName: string;
  /** Algo junto al nombre del local (ej. el logo de Chamullame si lo tienen). */
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1">
      <EntrySplash />
      <aside className="sticky top-0 hidden h-dvh print:!hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="border-b border-line px-5 py-4">
          <Link href="/" className="mb-3 block" aria-label="Yatay">
            <BrandMark className="h-9" />
          </Link>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{title}</p>
              {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
            </div>
            {badge}
          </div>
        </div>
        <NavLinks items={nav} variant="side" />
        <div className="mt-auto border-t border-line p-3">
          <p className="truncate px-2 pb-2 text-sm text-muted">{userName}</p>
          <form action={logout}>
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-ink/5">
              <LogOut className="size-4" aria-hidden /> Salir
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between print:hidden border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark variant="icon" className="h-8" />
            <div className="min-w-0">
            <p className="truncate font-semibold">{title}</p>
            {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
            </div>
          </div>
          <form action={logout}>
            <button aria-label="Salir" className="rounded-lg p-2 hover:bg-ink/5">
              <LogOut className="size-5" aria-hidden />
            </button>
          </form>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 md:py-8 md:pb-8 lg:px-10 print:p-0">{children}</main>

        <NavLinks items={nav} variant="bottom" />
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
