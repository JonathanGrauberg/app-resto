import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AdminAjustesPage() {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  // TenantSettings usa tenantId como PK: se consulta directo por el tenant de la sesión.
  const s = await db.tenantSettings.findUnique({ where: { tenantId: tenant.id } });

  return (
    <>
      <PageHeader title="Ajustes" description="Datos del local, enlaces y apariencia de la carta." />
      <SettingsForm
        values={{
          coverImageUrl: s?.coverImageUrl ?? null,
          logoUrl: s?.logoUrl ?? null,
          shareImageUrl: s?.shareImageUrl ?? null,
          name: tenant.name,
          slug: tenant.slug,
          tagline: s?.tagline ?? null,
          description: s?.description ?? null,
          address: s?.address ?? null,
          phone: s?.phone ?? null,
          instagramUrl: s?.instagramUrl ?? null,
          facebookUrl: s?.facebookUrl ?? null,
          websiteUrl: s?.websiteUrl ?? null,
          googleReviewUrl: s?.googleReviewUrl ?? null,
          menuTheme: s?.menuTheme ?? "DARK",
          prepMode: s?.prepMode ?? "SEPARATE",
        }}
      />
    </>
  );
}
