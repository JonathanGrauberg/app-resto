import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { FormSuccess } from "@/components/ui/field";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES, ROLE_LABEL, canManageRole } from "@/lib/auth/permissions";
import { cn } from "@/lib/format";

export const metadata: Metadata = { title: "Personal" };

const ROLE_ORDER = ["OWNER", "ADMIN", "CAJA", "MOZO", "COCINA", "BAR"] as const;

export default async function AdminPersonalPage({ searchParams }: PageProps<"/admin/personal">) {
  const { tdb, tenant, membership: me } = await requireTenantRole(ADMIN_ROLES);
  const { ok } = await searchParams;

  const members = await tdb.membership.findMany({
    include: { user: { select: { name: true, email: true, passwordHash: true } } },
  });
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
      <Card className="divide-y divide-line">
        {members.map((m) => {
          const editable = canManageRole(me.role, m.role);
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
                <p className="truncate text-sm text-muted">{m.user.email ?? "Solo PIN"}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                <Badge tone="brand">{ROLE_LABEL[m.role]}</Badge>
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
