import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES, CAN_MANAGE_TABLES, ROLE_LABEL, STAFF_MANAGER_ROLES, STAFF_ROLES } from "@/lib/auth/permissions";

/** PWA del personal: cabecera compacta, sin barra lateral, pensada para celular y tablet. */
export default async function StaffLayout({ children }: LayoutProps<"/staff">) {
  const { tenant, user, membership } = await requireTenantRole(STAFF_ROLES);

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{tenant.name}</p>
          <p className="truncate text-xs text-muted">
            {user.name} · {ROLE_LABEL[membership.role]}
          </p>
        </div>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {CAN_MANAGE_TABLES.includes(membership.role) && (
            <Link href="/staff/mozo" className="rounded-lg px-3 py-2 hover:bg-ink/5">
              Sala
            </Link>
          )}
          {STAFF_MANAGER_ROLES.includes(membership.role) && (
            <Link href="/staff/caja" className="rounded-lg px-3 py-2 hover:bg-ink/5">
              Caja
            </Link>
          )}
          {ADMIN_ROLES.includes(membership.role) && (
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
      <main className="flex-1 px-4 py-4 sm:px-6">{children}</main>
    </div>
  );
}
