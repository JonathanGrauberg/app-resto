import { AppShell, type NavItem } from "@/components/app-shell";
import { StaffLive } from "@/components/staff-live";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { getEnabledModules } from "@/lib/modules";
import { staffChannel } from "@/lib/realtime/server";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { tenant, user, membership } = await requireTenantRole(ADMIN_ROLES);
  const modules = await getEnabledModules(tenant.id);

  const nav: NavItem[] = [
    { href: "/admin", label: "Inicio", icon: "dashboard" },
    { href: "/admin/carta", label: "Carta", icon: "carta" },
    { href: "/admin/mesas", label: "Mesas", icon: "mesas" },
    { href: "/admin/mesas?vista=sala", label: "Sala en vivo", icon: "sala" },
    { href: "/admin/personal", label: "Personal", icon: "personal" },
    ...(modules.has("RESERVAS") ? [{ href: "/admin/reservas", label: "Reservas", icon: "reservas" } as const] : []),
    ...(modules.has("BI") ? [{ href: "/admin/metricas", label: "Métricas", icon: "metricas" } as const] : []),
    { href: "/admin/ajustes", label: "Ajustes", icon: "ajustes" },
  ];

  return (
    <AppShell title={tenant.name} subtitle="Administración" nav={nav} userName={user.name}>
      {children}
      <StaffLive
        channel={staffChannel(tenant.id)}
        membershipId={membership.id}
        role={membership.role}
        salaHref="/admin/mesas?vista=sala"
      />
    </AppShell>
  );
}
