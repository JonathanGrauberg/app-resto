import { AppShell } from "@/components/app-shell";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  const { user } = await requirePlatformAdmin();
  return (
    <AppShell
      title="Plataforma"
      subtitle="Equipo app-resto"
      nav={[{ href: "/platform", label: "Locales", icon: "tenants" }]}
      userName={user.name}
    >
      {children}
    </AppShell>
  );
}
