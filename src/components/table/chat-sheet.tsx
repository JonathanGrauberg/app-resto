"use client";

import { X } from "lucide-react";

/** El chat de la mesa en una ventana sobre la carta (sin salir ni abrir otra pestaña). */
export function ChatSheet({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50 backdrop-blur-sm" role="dialog" aria-modal aria-label="Chat de la mesa">
      <button className="h-[6dvh] w-full shrink-0" aria-label="Cerrar chat" onClick={onClose} />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl bg-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="mx-auto h-1.5 w-10 rounded-full bg-ink/15" aria-hidden />
          <button onClick={onClose} aria-label="Cerrar chat" className="absolute right-3 top-2 flex size-9 items-center justify-center rounded-full hover:bg-ink/5">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <iframe src={src} title="Chat de la mesa" allow="camera" className="min-h-0 w-full flex-1 border-0 bg-bg" />
      </div>
    </div>
  );
}
