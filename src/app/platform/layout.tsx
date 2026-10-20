import { AppShell } from "@/components/app-shell";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { BRAND } from "@/lib/brand";

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  const { user } = await requirePlatformAdmin();
  return (
    <AppShell
      title="Plataforma"
      subtitle={BRAND.team}
      nav={[
        { href: "/platform", label: "Resumen", icon: "dashboard" },
        { href: "/platform/locales", label: "Locales", icon: "tenants" },
        { href: "/platform/planes", label: "Planes", icon: "planes" },
      ]}
      userName={user.name}
    >
      {children}
    </AppShell>
  );
}
