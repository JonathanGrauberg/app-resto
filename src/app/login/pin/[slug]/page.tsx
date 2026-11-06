import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentDevice } from "@/lib/auth/devices";
import { rolesLabel } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotPaired } from "../not-paired";
import { PinPad } from "./pin-pad";

export const metadata: Metadata = { title: "Entrar con PIN" };

export default async function PinLoginPage({ params }: PageProps<"/login/pin/[slug]">) {
  const { slug } = await params;
  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant || !tenant.active) notFound();

  // Sin equipo vinculado no se muestra ni la lista del personal.
  const device = await currentDevice(tenant.id);
  if (!device) return <NotPaired venue={tenant.name} />;

  const memberships = await db.membership.findMany({
    where: { tenantId: tenant.id, active: true, pinHash: { not: null } },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const people = memberships.map((m) => ({ id: m.id, name: m.user.name, roleLabel: rolesLabel(m) }));

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <p className="text-sm text-muted">Entrar a</p>
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
        </div>
        <PinPad slug={slug} people={people} />
        <p className="text-center text-xs text-muted">Equipo: {device.name}</p>
      </div>
    </main>
  );
}
