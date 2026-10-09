import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { StaffLive } from "@/components/staff-live";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES, CAN_MANAGE_TABLES, hasRole, rolesLabel, rolesOf, STAFF_MANAGER_ROLES, STAFF_ROLES } from "@/lib/auth/permissions";
import { cn } from "@/lib/format";
import { getPrepMode } from "@/lib/prep";
import { staffChannel } from "@/lib/realtime/server";

/** PWA del personal: cabecera compacta, sin barra lateral, pensada para celular y tablet. */
export default async function StaffLayout({ children }: LayoutProps<"/staff">) {
  const { tenant, user, membership } = await requireTenantRole(STAFF_ROLES);
  const prepMode = await getPrepMode(tenant.id);
  const isAdmin = hasRole(membership, ADMIN_ROLES);
  // Con un solo rol de pantalla (ej. solo cocina) no hace falta menú para cambiar de pantalla.
  const multi = isAdmin || rolesOf(membership).length > 1;

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 print:hidden border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{tenant.name}</p>
          <p className="truncate text-xs text-muted">
            {user.name} · {rolesLabel(membership)}
          </p>
        </div>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {hasRole(membership, CAN_MANAGE_TABLES) && (
            <Link href="/staff/mozo" className="rounded-lg px-3 py-2 hover:bg-ink/5">
              Sala
            </Link>
          )}
          {hasRole(membership, STAFF_MANAGER_ROLES) && (
            <Link href="/staff/caja" className="rounded-lg px-3 py-2 hover:bg-ink/5">
              Caja
            </Link>
          )}
          {/* Cocina y barra: a quien tenga ese rol además de otros (en celular, admin los ve desde su panel). */}
          {(hasRole(membership, ["COCINA"]) || (prepMode === "SINGLE" && hasRole(membership, ["BAR"])) || isAdmin) && multi && (
            <Link href="/staff/cocina" className={cn("rounded-lg px-3 py-2 hover:bg-ink/5", isAdmin && "hidden sm:block")}>
              Cocina
            </Link>
          )}
          {prepMode === "SEPARATE" && (hasRole(membership, ["BAR"]) || isAdmin) && multi && (
            <Link href="/staff/bar" className={cn("rounded-lg px-3 py-2 hover:bg-ink/5", isAdmin && "hidden sm:block")}>
              Bar
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-ink/5">
              Admin
            </Link>
          )}
        </nav>
        <form action={logout}>
          <button className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm hover:bg-ink/5">
            <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Salir</span>
          </button>
        </form>
      </header>
      <main className="flex-1 px-4 py-4 sm:px-6 print:p-0">{children}</main>
      <StaffLive
        channel={staffChannel(tenant.id)}
        membershipId={membership.id}
        roles={rolesOf(membership)}
        salaHref={hasRole(membership, ["CAJA"]) ? "/staff/caja" : "/staff/mozo"}
        singleScreen={prepMode === "SINGLE"}
      />
    </div>
  );
}
