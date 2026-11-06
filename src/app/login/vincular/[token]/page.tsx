import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { findPairing } from "@/lib/auth/devices";
import { PairForm } from "./pair-form";

export const metadata: Metadata = { title: "Vincular equipo", robots: { index: false } };

/** Se abre al escanear el QR de acceso del personal: vincula este celular o tablet al local. */
export default async function PairDevicePage({ params }: PageProps<"/login/vincular/[token]">) {
  const { token } = await params;
  const pairing = await findPairing(token);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        {pairing ? (
          <>
            <p className="text-sm text-muted">Vincular este equipo a</p>
            <h1 className="text-2xl font-semibold tracking-tight">{pairing.tenant.name}</h1>
            <p className="mt-2 text-sm text-muted">Después, el personal entra desde acá con su PIN. Se hace una sola vez.</p>
            <PairForm token={token} />
          </>
        ) : (
          <div className="text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ink/5 text-muted">
              <Clock className="size-6" aria-hidden />
            </span>
            <h1 className="mt-4 text-xl font-semibold">Este QR ya no sirve</h1>
            <p className="mt-2 text-sm text-muted">Se usó o venció. Pedile al encargado que genere uno nuevo en Personal → Equipos.</p>
          </div>
        )}
      </Card>
    </main>
  );
}
