import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PLANS, PRO_PLAN_ID, PUBLIC_PLAN_IDS } from "@/lib/plans";
import { addMonths, todayISO } from "@/lib/subscription";
import { HandOverForm } from "./hand-over-form";

export const metadata: Metadata = { title: "Entregar local" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Entregar al cliente un local que armamos nosotros: queda a su nombre y eligen qué se conserva. */
export default async function HandOverPage({ params }: PageProps<"/platform/locales/[id]/entregar">) {
  await requirePlatformAdmin();
  const { id } = await params;
  const where = { tenantId: id };
  const tenant = await db.tenant.findUnique({
    where: { id },
    include: { settings: true, subscription: { select: { contactPhone: true } } },
  });
  if (!tenant) notFound();

  const [categories, products, areas, tables, owners, staff, sessions, orders, reservations] = await Promise.all([
    db.category.count({ where }),
    db.product.count({ where }),
    db.area.count({ where }),
    db.table.count({ where }),
    db.membership.findMany({ where: { ...where, role: "OWNER" }, select: { user: { select: { name: true, email: true } } } }),
    db.membership.count({ where: { ...where, role: { not: "OWNER" } } }),
    db.tableSession.count({ where }),
    db.order.count({ where }),
    db.reservation.count({ where }),
  ]);
  const s = tenant.settings;
  const branding = [
    s?.logoUrl && "logo",
    s?.coverImageUrl && "portada",
    (s?.tagline || s?.description) && "textos",
    (s?.instagramUrl || s?.facebookUrl) && "redes",
    s?.linksEnabled && "página de enlaces",
  ].filter(Boolean);
  const hours = !!(s?.openingHours || s?.bookingHours);

  return (
    <>
      <Link href={`/platform/locales/${id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {tenant.name}
      </Link>
      <PageHeader
        title={`Entregar ${tenant.name}`}
        description="Para cuando un local que armaron ustedes (carta, mesas…) dice que sí: queda a nombre del dueño, con los meses gratis, y eligen qué se conserva de lo que cargaron."
      />
      <HandOverForm
        tenantId={id}
        slug={tenant.slug}
        plans={PLANS.filter((p) => (PUBLIC_PLAN_IDS as readonly string[]).includes(p.id)).map((p) => ({ id: p.id, label: p.label }))}
        defaultPlan={PRO_PLAN_ID}
        defaultTrial={addMonths(new Date(`${todayISO()}T12:00:00Z`), 3).toISOString().slice(0, 10)}
        defaultPhone={tenant.subscription?.contactPhone ?? ""}
        demoOwners={owners.map((o) => o.user.email ?? o.user.name)}
        summary={{
          menu: products
            ? `${plural(products, "producto", "productos")} en ${plural(categories, "categoría", "categorías")}, con precios, fotos y opciones`
            : "Todavía no hay carta cargada",
          tables: tables ? `${plural(tables, "mesa", "mesas")} en ${plural(areas, "salón", "salones")}, con sus QR` : "Todavía no hay mesas",
          branding: branding.length ? `Cargado: ${branding.join(", ")}` : "Todavía no hay logo ni portada",
          settings: hours ? "Horarios, reservas, cocina/barra e idiomas (hay horarios cargados)" : "Horarios, reservas, cocina/barra e idiomas",
          staff: staff ? `${plural(staff, "persona", "personas")} además del dueño` : "No hay más personal cargado",
          always: [
            sessions ? `${plural(sessions, "mesa abierta o cobrada", "mesas abiertas o cobradas")} y ${plural(orders, "pedido", "pedidos")}` : null,
            reservations ? plural(reservations, "reserva", "reservas") : null,
          ].filter((x): x is string => !!x),
        }}
      />
    </>
  );
}
