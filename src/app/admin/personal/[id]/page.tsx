import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/app-shell";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES, canManageRoles, rolesOf } from "@/lib/auth/permissions";
import { StaffForm } from "../staff-form";

export const metadata: Metadata = { title: "Personal" };

export default async function StaffPage({ params }: PageProps<"/admin/personal/[id]">) {
  const { tdb, membership: me } = await requireTenantRole(ADMIN_ROLES);
  const { id } = await params;
  const isNew = id === "nuevo";

  const m = isNew ? null : await tdb.membership.findUnique({ where: { id }, include: { user: true } });
  if (!isNew && !m) notFound();
  if (m && !canManageRoles(me, rolesOf(m))) forbidden();

  const roles = Object.values(Role).filter((r) => canManageRoles(me, [r]));

  return (
    <>
      <Link href="/admin/personal" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Personal
      </Link>
      <PageHeader title={m ? m.user.name : "Nueva persona"} />
      <StaffForm
        isSelf={m?.id === me.id}
        roles={roles}
        values={
          m
            ? {
                id: m.id,
                name: m.user.name,
                roles: rolesOf(m),
                email: m.user.email ?? "",
                hasPassword: !!m.user.passwordHash,
                hasPin: !!m.pinHash,
                active: m.active,
              }
            : { name: "", roles: ["MOZO"], email: "", hasPassword: false, hasPin: false, active: true }
        }
      />
    </>
  );
}
