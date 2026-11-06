import Link from "next/link";
import { QrCode } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Este navegador no está vinculado al local: el PIN no sirve hasta que el encargado lo autorice. */
export function NotPaired({ venue }: { venue?: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <QrCode className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Este equipo no está vinculado{venue ? ` a ${venue}` : ""}</h1>
        <p className="mt-2 text-sm text-muted">
          Para entrar con PIN, pedile al encargado que abra <strong>Personal → Equipos</strong> y te muestre el QR de acceso. Lo escaneás una vez con
          este celular o tablet y queda listo.
        </p>
        <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
          ¿Sos el encargado?{" "}
          <Link href="/login?next=/admin/personal/equipos" className="font-medium text-brand">
            Entrá con tu mail
          </Link>{" "}
          y vinculá este equipo.
        </p>
      </Card>
    </main>
  );
}
