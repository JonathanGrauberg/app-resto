import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentDevice } from "@/lib/auth/devices";
import { db } from "@/lib/db";
import { NotPaired } from "../not-paired";
import { PinPad } from "./pin-pad";

export const metadata: Metadata = { title: "Entrar con PIN" };

/** Pantalla del PIN: cada uno escribe su PIN y entra (en equipos donde se entró con la cuenta del personal). */
export default async function PinLoginPage({ params }: PageProps<"/login/pin/[slug]">) {
  const { slug } = await params;
  const tenant = await db.tenant.findUnique({ where: { slug }, include: { settings: { select: { logoUrl: true } } } });
  if (!tenant || !tenant.active) notFound();

  if (!(await currentDevice(tenant.id))) return <NotPaired venue={tenant.name} />;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
      <div className="w-full max-w-xs">
        <PinPad slug={slug} venue={tenant.name} logoUrl={tenant.settings?.logoUrl ?? null} />
      </div>
    </main>
  );
}
