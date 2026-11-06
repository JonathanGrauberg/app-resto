import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Card } from "@/components/ui/card";
import { BRAND } from "@/lib/brand";
import { PLAN_FEATURES } from "@/lib/plans";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Creá tu local gratis",
  description: `Registrá tu restaurante, bar o heladería en ${BRAND.name} y tené tu carta QR hoy.`,
};

/** Registro de un local nuevo: arranca en el plan Gratis (o en su plan, si trae un código PRO). */
export default async function SignupPage({ searchParams }: PageProps<"/registro">) {
  const { codigo } = await searchParams;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
      <div className="grid w-full max-w-4xl gap-8 md:grid-cols-[1fr_26rem] md:items-center">
        <div>
          <Link href="/" aria-label="Inicio">
            <BrandMark className="h-14" priority />
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">Tu carta QR hoy, gratis.</h1>
          <p className="mt-3 text-muted">Creá tu local en un minuto. Cuando quieras pedidos desde la mesa, cocina, caja y reservas, pasás al plan Pro.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {PLAN_FEATURES.carta.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> {f}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-medium text-brand">
              Iniciá sesión
            </Link>
          </p>
        </div>
        <Card className="p-5 sm:p-6">
          <SignupForm withCode={codigo === "1"} />
        </Card>
      </div>
    </main>
  );
}
