"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, X } from "lucide-react";

/**
 * Selfie de la mesa SOLO con la cámara en vivo (no se puede elegir una foto de la galería).
 * Se recorta cuadrada y se achica en el celular (480 px, JPEG) antes de enviarla.
 */
export function PhotoCamera({ onClose, onShot, busy }: { onClose: () => void; onShot: (dataUrl: string) => void; busy: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 } }, audio: false });
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
      } catch {
        setError("No pudimos abrir la cámara. Revisá que el navegador tenga permiso para usarla.");
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const take = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const side = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    // Espejo, como se ve en la pantalla al sacarse una selfie.
    ctx.translate(480, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, 480, 480);
    setShot(canvas.toDataURL("image/jpeg", 0.72));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal aria-label="Foto de la mesa">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">Foto de la mesa</p>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 hover:bg-ink/5">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-black">
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt="Foto sacada" className="size-full object-cover" />
          ) : (
            <video ref={video} playsInline muted className="size-full -scale-x-100 object-cover" />
          )}
        </div>
        {error && <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-muted">
          Solo con la cámara, en el momento. Otra persona de la mesa la tiene que aprobar, y el local la puede sacar. Se borra cuando la mesa se va.
        </p>
        <div className="mt-3 flex gap-2">
          {shot ? (
            <>
              <button onClick={() => setShot(null)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-3 text-sm hover:bg-ink/5">
                <RotateCcw className="size-4" aria-hidden /> Otra
              </button>
              <button onClick={() => onShot(shot)} disabled={busy} className="flex-1 rounded-full bg-brand py-3 text-sm font-semibold text-brand-ink disabled:opacity-50">
                {busy ? "Subiendo…" : "Usar esta"}
              </button>
            </>
          ) : (
            <button onClick={take} disabled={!!error} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-bg disabled:opacity-40">
              <Camera className="size-4" aria-hidden /> Sacar foto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
