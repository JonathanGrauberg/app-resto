"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Printer, X } from "lucide-react";
import QRCode from "qrcode";

/**
 * QR de una mesa en grande: para que los comensales lo escaneen desde el celular del mozo,
 * o para imprimir solo esa mesa (si se rompió o se perdió el cartelito).
 */
export function QrDialog({
  path,
  title,
  venue,
  onClose,
}: {
  /** Ruta pública, ej. `/la-casona/m/<qrToken>`. */
  path: string;
  title: string;
  venue: string;
  onClose: () => void;
}) {
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then(setSvg);
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div data-print-only className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label={`QR ${title}`}>
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm print:hidden" onClick={onClose} aria-label="Cerrar" tabIndex={-1} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center text-[#1a1714] shadow-2xl print:shadow-none">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full hover:bg-black/5 print:hidden"
        >
          <X className="size-5" aria-hidden />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a6b1f]">{venue}</p>
        <p className="mt-1 text-3xl font-black">{title}</p>
        <div className="mx-auto my-5 aspect-square w-full max-w-64 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="font-medium">Escaneá para ver la carta y pedir</p>

        <div className="mt-5 grid grid-cols-2 gap-2 print:hidden">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(url).then(() => setCopied(true));
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-black/10 text-sm font-medium hover:bg-black/5"
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Copiado" : "Copiar enlace"}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a1714] text-sm font-medium text-white hover:bg-black"
          >
            <Printer className="size-4" aria-hidden /> Imprimir
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
