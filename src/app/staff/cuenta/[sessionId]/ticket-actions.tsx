"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, Printer } from "lucide-react";

/** Botones de pantalla (no se imprimen). Con `autoPrint`, abre el diálogo de impresión al cargar. */
export function TicketActions({ autoPrint }: { autoPrint: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!autoPrint) return;
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, [autoPrint]);

  return (
    <div className="mx-auto mb-4 flex w-[76mm] gap-2 print:hidden">
      <button
        onClick={() => router.back()}
        className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line px-3 text-sm hover:bg-ink/5"
      >
        <ArrowLeft className="size-4" aria-hidden /> Volver
      </button>
      <button
        onClick={() => window.print()}
        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-brand-ink"
      >
        <Printer className="size-4" aria-hidden /> Imprimir cuenta
      </button>
    </div>
  );
}
