import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { baseUrl } from "@/lib/base-url";
import { db } from "@/lib/db";
import { isLinkTheme, readLinks } from "@/lib/links";
import { hasModule } from "@/lib/modules";
import { LinksForm } from "./links-form";

export const metadata: Metadata = { title: "Enlaces" };

/** Página de enlaces del local (tipo Linktree): lo primero que se ve al escanear el QR. */
export default async function AdminLinksPage() {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  const [s, hasBooking, base] = await Promise.all([
    db.tenantSettings.findUnique({ where: { tenantId: tenant.id } }),
    hasModule(tenant.id, "RESERVAS"),
    baseUrl(),
  ]);

  return (
    <>
      <PageHeader
        title="Enlaces"
        description="Tu página con la carta, redes, reseñas y cómo llegar. Se ve al escanear el QR de la mesa y la podés compartir en tu Instagram."
      />
      <LinksForm
        initial={{ enabled: s?.linksEnabled ?? false, theme: s && isLinkTheme(s.linksTheme) ? s.linksTheme : "dark", links: readLinks(s) }}
        venue={{ name: tenant.name, tagline: s?.tagline ?? null, logoUrl: s?.logoUrl ?? null, coverImageUrl: s?.coverImageUrl ?? null }}
        publicUrl={`${base}/${tenant.slug}/enlaces`}
        hasBooking={hasBooking}
        country={s?.country ?? "AR"}
      />
    </>
  );
}
