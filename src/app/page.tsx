import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Landing provisoria (se reemplaza cuando haya nombre y branding). */
export default function Home() {
  const demo = [
    { href: "/la-casona", title: "Carta pública", text: "Lo que ve un comensal sin mesa." },
    { href: "/admin/mesas", title: "Mesa por QR", text: "Desde Admin → Mesas, abrí el enlace QR de cualquier mesa." },
    { href: "/login", title: "Panel del local", text: "Admin, caja y personal." },
    { href: "/login/pin/la-casona", title: "Entrar con PIN", text: "Mozos, cocina y bar." },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12">
      <p className="text-sm font-medium uppercase tracking-wider text-brand">app-resto · demo local</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        Carta QR, pedidos, sala, cocina, caja y reservas para tu restaurante.
      </h1>
      <p className="mt-3 text-muted">Entorno de desarrollo con el local de ejemplo &ldquo;La Casona&rdquo;.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {demo.map((d) => (
          <Link key={d.href} href={d.href}>
            <Card className="flex h-full items-center gap-3 p-4 transition-colors hover:border-brand">
              <div className="flex-1">
                <p className="font-medium">{d.title}</p>
                <p className="text-sm text-muted">{d.text}</p>
              </div>
              <ArrowRight className="size-4 text-muted" aria-hidden />
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <ButtonLink href="/login" size="lg">
          Entrar
        </ButtonLink>
      </div>
    </main>
  );
}
