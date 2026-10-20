"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Layers, QrCode } from "lucide-react";
import { QrDialog } from "@/components/qr-dialog";
import { Card } from "@/components/ui/card";

/** QR para escribir (imprimible) y el enlace de la pantalla (normal o transparente para OBS). */
export function WallLinks({ venue, name, joinPath, screenUrl }: { venue: string; name: string; joinPath: string; screenUrl: string }) {
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };
  const row = "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-ink/5";

  return (
    <Card className="p-4">
      <h2 className="mb-2 font-semibold">Pantalla y QR</h2>
      <a href={screenUrl} target="_blank" rel="noopener" className={row}>
        <ExternalLink className="size-4 text-muted" aria-hidden /> Abrir la pantalla (tele o proyector)
      </a>
      <button onClick={() => copy(screenUrl, "screen")} className={row}>
        {copied === "screen" ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4 text-muted" aria-hidden />} Copiar enlace de la pantalla
      </button>
      <button onClick={() => copy(`${screenUrl}?modo=overlay`, "overlay")} className={row}>
        {copied === "overlay" ? <Check className="size-4 text-ok" aria-hidden /> : <Layers className="size-4 text-muted" aria-hidden />} Copiar versión transparente (sobre el video, OBS)
      </button>
      <button onClick={() => setQr(true)} className={row}>
        <QrCode className="size-4 text-muted" aria-hidden /> QR para que escriban (mostrar / imprimir)
      </button>
      <p className="mt-2 text-xs text-muted">El enlace de la pantalla es secreto: no lo compartas con los invitados. El QR también aparece en la pantalla.</p>
      {qr && <QrDialog path={joinPath} title={`Muro · ${name}`} venue={venue} caption="Escaneá y escribí en el muro (+18)" onClose={() => setQr(false)} />}
    </Card>
  );
}

/** El panel de moderación se actualiza solo (los avisos del Muro llegan por el canal del personal). */
export function LiveRefresh({ ms = 8000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}
