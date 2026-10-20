"use client";

import { useState } from "react";
import { Maximize } from "lucide-react";
import { cn } from "@/lib/format";
import { useLive } from "@/lib/realtime/use-live";

type Msg = { id: string; author: string; text: string };

/** Mensajes grandes que entran desde abajo; el más nuevo, destacado. Se actualiza solo. */
export function ScreenView({
  code,
  channel,
  overlay,
  venue,
  event,
  qr,
  joinHost,
  messages,
}: {
  code: string;
  channel: string;
  overlay: boolean;
  venue: string;
  event: string;
  qr: string;
  joinHost: string;
  messages: Msg[];
}) {
  const [full, setFull] = useState(false);
  useLive({ scope: "muro", code, channel, fallbackMs: 4_000 });
  // Más viejo arriba, más nuevo abajo (como un chat en vivo).
  const list = [...messages].reverse();

  return (
    <div
      className={cn("fixed inset-0 z-50 flex overflow-hidden", overlay ? "bg-transparent" : "bg-[#0b0a09] text-[#f5f2ed]")}
      style={overlay ? { background: "transparent" } : undefined}
    >
      {/* Fondo transparente de verdad para OBS: también el body del sitio. */}
      {overlay && <style>{`html, body { background: transparent !important; }`}</style>}

      <div className={cn("flex min-w-0 flex-1 flex-col justify-end gap-3 p-[3vw]", overlay ? "max-w-[45vw]" : "")}>
        {!overlay && (
          <header className="mb-auto">
            <p className="text-[1.4vw] font-semibold uppercase tracking-[0.3em] text-[#e2bd7a]">{venue}</p>
            <h1 className="text-[4.5vw] font-black leading-none tracking-tight">{event}</h1>
          </header>
        )}
        {list.length === 0 && !overlay && <p className="text-[2vw] text-white/60">Escaneá el QR y escribí el primer mensaje 🎉</p>}
        {list.map((m, i) => {
          const newest = i === list.length - 1;
          return (
            <div
              key={m.id}
              className={cn(
                "w-fit max-w-full animate-fade-up rounded-[1.5vw] px-[1.6vw] py-[0.9vw] shadow-2xl",
                newest ? "bg-[#e2bd7a] text-[#17130d]" : "bg-black/70 text-white backdrop-blur",
                // Los más viejos se van apagando.
                !newest && i < list.length - 4 && "opacity-60",
              )}
            >
              <p className={cn("font-bold", newest ? "text-[1.3vw] text-[#17130d]/70" : "text-[1.1vw] text-[#e2bd7a]")}>{m.author}</p>
              <p className={cn("break-words font-semibold leading-tight", newest ? "text-[2.8vw]" : "text-[2vw]")}>{m.text}</p>
            </div>
          );
        })}
      </div>

      {!overlay && (
        <aside className="flex w-[22vw] shrink-0 flex-col items-center justify-end gap-[1vw] p-[3vw]">
          <div className="rounded-[1.5vw] bg-white p-[1.2vw]">
            <div className="size-[15vw] [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
          </div>
          <p className="text-center text-[1.5vw] font-bold leading-tight">Escaneá y escribí en el muro</p>
          <p className="text-center text-[1vw] text-white/50">{joinHost}</p>
        </aside>
      )}

      {!full && (
        <button
          onClick={() => {
            document.documentElement.requestFullscreen?.().catch(() => {});
            setFull(true);
          }}
          className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur hover:bg-white/20"
        >
          <Maximize className="size-4" aria-hidden /> Pantalla completa
        </button>
      )}
    </div>
  );
}
