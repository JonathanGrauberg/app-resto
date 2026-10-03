import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Métricas" };

export default async function AdminMetricasPage() {
  await requireTenantRole(ADMIN_ROLES, "BI");
  return (
    <>
      <PageHeader title="Métricas" />
      <ComingSoon title="Rotación, estadía y facturación por mesa" phase="Fase 6" />
    </>
  );
}
