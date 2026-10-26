import { AppShell, type NavItem } from "@/components/app-shell";
import { RegionProvider } from "@/components/region-provider";
import { StaffLive } from "@/components/staff-live";
import { SubscriptionNotice } from "@/components/subscription-notice";
import { getRegion } from "@/lib/region-server";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES, rolesOf } from "@/lib/auth/permissions";
import { getEnabledModules } from "@/lib/modules";
import { staffChannel } from "@/lib/realtime/server";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { tenant, user, membership } = await requireTenantRole(ADMIN_ROLES);
  const [modules, region] = await Promise.all([getEnabledModules(tenant.id), getRegion(tenant.id)]);

  const nav: NavItem[] = [
    { href: "/admin", label: "Inicio", icon: "dashboard" },
    { href: "/admin/carta", label: "Carta", icon: "carta" },
    { href: "/admin/mesas", label: "Mesas", icon: "mesas" },
    { href: "/admin/mesas?vista=sala", label: "Sala en vivo", icon: "sala" },
    { href: "/admin/personal", label: "Personal", icon: "personal" },
    { href: "/admin/enlaces", label: "Enlaces", icon: "enlaces" },
    ...(modules.has("RESERVAS") ? [{ href: "/admin/reservas", label: "Reservas", icon: "reservas" } as const] : []),
    ...(modules.has("MURO") ? [{ href: "/admin/muro", label: "Muro", icon: "muro" } as const] : []),
    ...(modules.has("COMPRAS") ? [{ href: "/admin/compras", label: "Compras", icon: "compras" } as const] : []),
    ...(modules.has("BI") ? [{ href: "/admin/metricas", label: "Métricas", icon: "metricas" } as const] : []),
    { href: "/admin/ajustes", label: "Ajustes", icon: "ajustes" },
  ];

  return (
    <AppShell title={tenant.name} subtitle="Administración" nav={nav} userName={user.name}>
      <SubscriptionNotice tenantId={tenant.id} />
      <RegionProvider region={region}>{children}</RegionProvider>
      <StaffLive
        channel={staffChannel(tenant.id)}
        membershipId={membership.id}
        roles={rolesOf(membership)}
        salaHref="/admin/mesas?vista=sala"
      />
    </AppShell>
  );
}
