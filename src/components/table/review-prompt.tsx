"use client";

import { Star } from "lucide-react";

/** Invitación a dejar reseña en Google (una vez por mesa, después del primer pedido). */
export function ReviewPrompt({ url, venue, onClose }: { url: string; venue: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal aria-label="Dejar reseña">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Ahora no" tabIndex={-1} />
      <div className="relative w-full space-y-4 rounded-t-3xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center sm:max-w-sm sm:rounded-3xl">
        <div className="flex justify-center gap-1 text-brand" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-6 fill-current" />
          ))}
        </div>
        <div>
          <h2 className="text-xl font-bold">¡Pedido enviado!</h2>
          <p className="mt-1 text-sm text-muted">
            Mientras esperás, ¿nos ayudás con una reseña de {venue} en Google? Son 30 segundos.
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-brand font-semibold text-brand-ink"
        >
          Dejar reseña
        </a>
        <button onClick={onClose} className="w-full py-2 text-sm text-muted">
          Ahora no
        </button>
      </div>
    </div>
  );
}
