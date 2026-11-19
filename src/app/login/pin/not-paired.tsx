import Link from "next/link";
import { KeyRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** En este equipo todavía no se entró con la cuenta del personal: el PIN aparece después de eso. */
export function NotPaired({ venue }: { venue?: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <KeyRound className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Primero, la cuenta del personal</h1>
        <p className="mt-2 text-sm text-muted">
          Entrá una vez en este equipo con el usuario y la contraseña del personal{venue ? ` de ${venue}` : ""}. Después cada uno entra con su PIN.
        </p>
        <ButtonLink href="/login" className="mt-5 w-full">
          Entrar con usuario y contraseña
        </ButtonLink>
        <p className="mt-4 text-xs text-muted">
          ¿No los tenés? Pedíselos al encargado. <Link href="/" className="text-brand">Ir al inicio</Link>
        </p>
      </Card>
    </main>
  );
}
