import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { pairedTenants } from "@/lib/auth/devices";
import { NotPaired } from "./not-paired";

export const metadata: Metadata = { title: "Entrar con PIN" };

/** Entrada con PIN: va directo al local al que está vinculado este equipo. Sin equipo vinculado, no hay PIN. */
export default async function PinTenantPage() {
  const venues = await pairedTenants();
  if (venues.length === 1) redirect(`/login/pin/${venues[0].slug}`);
  if (!venues.length) return <NotPaired />;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-3">
        <h1 className="text-center text-xl font-semibold">¿A qué local entrás?</h1>
        <Card className="divide-y divide-line">
          {venues.map((v) => (
            <Link key={v.slug} href={`/login/pin/${v.slug}`} className="flex items-center justify-between p-4 font-medium hover:bg-bg">
              {v.name}
              <ChevronRight className="size-4 text-muted" aria-hidden />
            </Link>
          ))}
        </Card>
      </div>
    </main>
  );
}
