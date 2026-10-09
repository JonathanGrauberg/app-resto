import type { Metadata } from "next";
import Link from "next/link";
import { Armchair, PencilRuler } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ClosedToday } from "@/components/sala/closed-today";
import { SalaView } from "@/components/sala/sala-view";
import { TableLegend } from "@/components/table-map";
import { requireTenantRole } from "@/lib/auth/guards";
import { getPublicMenu } from "@/lib/public-menu";
import { ADMIN_ROLES, rolesOf } from "@/lib/auth/permissions";
import { cn } from "@/lib/format";
import { getClosedToday, getSalaData } from "@/lib/sala";
import { FloorEditor } from "./floor-editor";

export const metadata: Metadata = { title: "Mesas" };

/**
 * Dos vistas del mismo salón:
 * - Diseño: armar el plano (se hace al configurar el local).
 * - Sala en vivo: las mismas acciones que mozo y caja, para que el dueño/admin
 *   pueda resolver cualquier mesa si el personal no está.
 */
export default async function AdminMesasPage({ searchParams }: PageProps<"/admin/mesas">) {
  const { tenant, tdb, membership } = await requireTenantRole(ADMIN_ROLES);
  const { vista } = await searchParams;
  const live = vista === "sala";

  const tabs = (
    <div className="mb-5 inline-flex rounded-xl bg-ink/5 p-1" role="tablist" aria-label="Vista">
      {[
        { href: "/admin/mesas", label: "Diseño del plano", icon: PencilRuler, on: !live },
        { href: "/admin/mesas?vista=sala", label: "Sala en vivo", icon: Armchair, on: live },
      ].map(({ href, label, icon: Icon, on }) => (
        <Link
          key={href}
          href={href}
          role="tab"
          aria-selected={on}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
            on ? "bg-surface shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          <Icon className="size-4" aria-hidden /> {label}
        </Link>
      ))}
    </div>
  );

  if (live) {
    const [data, closed, menu] = await Promise.all([getSalaData(tdb), getClosedToday(tdb), getPublicMenu(tenant.id)]);
    return (
      <>
        <PageHeader title="Salones y mesas" description="Operación en vivo: lo mismo que ven mozos y caja." />
        {tabs}
        <SalaView
          data={data}
          me={{ membershipId: membership.id, roles: rolesOf(membership) }}
          slug={tenant.slug}
          venue={tenant.name}
          menu={menu}
        />
        <ClosedToday rows={closed} />
      </>
    );
  }

  const areas = await tdb.area.findMany({
    orderBy: { sortOrder: "asc" },
    include: { tables: { where: { archivedAt: null }, orderBy: { number: "asc" } } },
  });

  return (
    <>
      <PageHeader title="Salones y mesas" description="Diseñá el plano de cada salón." actions={<TableLegend />} />
      {tabs}
      <FloorEditor
        slug={tenant.slug}
        venue={tenant.name}
        areas={areas.map((a) => ({
          id: a.id,
          name: a.name,
          width: a.width,
          height: a.height,
          tables: a.tables.map((t) => ({
            id: t.id,
            number: t.number,
            seats: t.seats,
            maxGuests: t.maxGuests,
            shape: t.shape,
            posX: t.posX,
            posY: t.posY,
            width: t.width,
            height: t.height,
            status: t.status,
            qrToken: t.qrToken,
            temporary: t.temporary,
            groupId: t.groupId,
          })),
        }))}
      />
    </>
  );
}
