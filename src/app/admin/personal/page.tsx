import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { FormSuccess } from "@/components/ui/field";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES, ROLE_LABEL, ROLE_ORDER, canManageRoles, hasRole, rolesOf, sortRoles } from "@/lib/auth/permissions";
import { cn } from "@/lib/format";
import { tableLabelOf } from "@/lib/table-session";

export const metadata: Metadata = { title: "Personal" };

export default async function AdminPersonalPage({ searchParams }: PageProps<"/admin/personal">) {
  const { tdb, tenant, membership: me } = await requireTenantRole(ADMIN_ROLES);
  const { ok } = await searchParams;

  const [members, open] = await Promise.all([
    tdb.membership.findMany({ include: { user: { select: { name: true, email: true, passwordHash: true } } } }),
    // Mesas abiertas con mozo: para mostrar quién está libre.
    tdb.tableSession.findMany({
      where: { status: { not: "CLOSED" }, waiterId: { not: null } },
      include: { table: { select: { number: true, groupId: true } } },
    }),
  ]);
  const tablesOf = new Map<string, string[]>();
  for (const s of open) {
    tablesOf.set(s.waiterId!, [...(tablesOf.get(s.waiterId!) ?? []), await tableLabelOf(tdb, s.table)]);
  }
  const waiters = members.filter((m) => m.active && hasRole(m, ["MOZO"]));
  const free = waiters.filter((m) => !tablesOf.has(m.id));
  members.sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
      a.user.name.localeCompare(b.user.name),
  );

  return (
    <>
      <PageHeader
        title="Personal"
        description={`Mozos, cocina y bar entran con PIN en /login/pin/${tenant.slug}`}
        actions={
          <ButtonLink href="/admin/personal/nuevo">
            <Plus className="size-4" aria-hidden /> Nueva persona
          </ButtonLink>
        }
      />
      {typeof ok === "string" && (
        <div className="mb-6">
          <FormSuccess message={ok} />
        </div>
      )}
      {waiters.length > 0 && (
        <p className="mb-3 text-sm">
          <span className={cn("font-semibold", free.length ? "text-ok" : "text-warn")}>{free.length === 1 ? "1 mozo libre" : `${free.length} mozos libres`}</span>
          <span className="text-muted">
            {" "}
            de {waiters.length}
            {free.length > 0 && ` · ${free.map((m) => m.user.name).join(", ")}`}
          </span>
        </p>
      )}
      <Card className="divide-y divide-line">
        {members.map((m) => {
          const editable = canManageRoles(me, rolesOf(m));
          const tables = tablesOf.get(m.id);
          const isWaiter = m.active && hasRole(m, ["MOZO"]);
          const row = (
            <>
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full font-semibold",
                  m.active ? "bg-brand-soft text-brand" : "bg-ink/5 text-muted",
                )}
              >
                {m.user.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium", !m.active && "text-muted")}>
                  {m.user.name}
                  {m.id === me.id && <span className="ml-1.5 text-xs font-normal text-muted">(vos)</span>}
                </p>
                <p className="truncate text-sm text-muted">
                  {isWaiter && (
                    <span className={cn("font-medium", tables ? "text-brand" : "text-ok")}>
                      {tables ? `Atiende ${tables.length === 1 ? "la mesa" : "las mesas"} ${tables.join(", ")}` : "Libre"}
                      {" · "}
                    </span>
                  )}
                  {m.user.email ?? "Solo PIN"}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {sortRoles(rolesOf(m)).map((r) => (
                  <Badge key={r} tone="brand">
                    {ROLE_LABEL[r]}
                  </Badge>
                ))}
                {m.pinHash && <Badge>PIN</Badge>}
                {!m.active && <Badge tone="danger">Inactivo</Badge>}
              </div>
              {editable && <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />}
            </>
          );
          return editable ? (
            <Link key={m.id} href={`/admin/personal/${m.id}`} className="flex items-center gap-3 p-3 hover:bg-bg sm:p-4">
              {row}
            </Link>
          ) : (
            <div key={m.id} className="flex items-center gap-3 p-3 sm:p-4">
              {row}
            </div>
          );
        })}
      </Card>
    </>
  );
}
