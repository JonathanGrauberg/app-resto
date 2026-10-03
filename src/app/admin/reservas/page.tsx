import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Reservas" };

export default async function AdminReservasPage() {
  await requireTenantRole(ADMIN_ROLES, "RESERVAS");
  return (
    <>
      <PageHeader title="Reservas" />
      <ComingSoon title="Reservas y eventos" phase="Fase 5" />
    </>
  );
}
