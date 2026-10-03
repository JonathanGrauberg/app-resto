import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PinPad } from "./pin-pad";

export const metadata: Metadata = { title: "Entrar con PIN" };

export default async function PinLoginPage({ params }: PageProps<"/login/pin/[slug]">) {
  const { slug } = await params;
  const tenant = await db.tenant.findUnique({
    where: { slug },
    include: {
      memberships: {
        where: { active: true, pinHash: { not: null } },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!tenant || !tenant.active) notFound();

  const people = tenant.memberships.map((m) => ({ id: m.id, name: m.user.name, role: m.role }));

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <p className="text-sm text-muted">Entrar a</p>
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
        </div>
        <PinPad slug={slug} people={people} />
      </div>
    </main>
  );
}
