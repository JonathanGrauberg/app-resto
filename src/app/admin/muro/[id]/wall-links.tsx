"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Clapperboard, Copy, ExternalLink, Layers, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, FormSuccess, Input } from "@/components/ui/field";
import { useFormAction } from "@/lib/use-form-action";
import { setWallVideo } from "../actions";
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

/** Video o lista de YouTube que se reproduce detrás de los mensajes. */
export function WallVideoForm({ wallId, videoUrl }: { wallId: string; videoUrl: string | null }) {
  const [state, action, pending] = useFormAction(setWallVideo.bind(null, wallId), undefined);
  return (
    <Card className="p-4">
      <form onSubmit={action} className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Clapperboard className="size-4" aria-hidden /> Video de fondo (opcional)
        </h2>
        <p className="text-xs text-muted">
          Pegá un video o una lista de YouTube: se reproduce en loop detrás de los mensajes, sin OBS. Arranca sin sonido; en la pantalla hay un
          botón para activarlo.
        </p>
        <Input name="videoUrl" defaultValue={videoUrl ?? ""} placeholder="https://www.youtube.com/watch?v=… o …playlist?list=…" aria-label="Enlace de YouTube" />
        <FormError message={state?.error} />
        <FormSuccess message={state?.ok} />
        <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
          {pending ? "Guardando…" : "Guardar video"}
        </Button>
        <p className="text-[11px] text-muted">
          Algunos videos no se pueden reproducir fuera de YouTube (lo decide quien lo subió): si queda en negro, probá con otro. La
          música en público la cubre el local (SADAIC / AADI-CAPIF, SGAE).
        </p>
      </form>
    </Card>
  );
}
