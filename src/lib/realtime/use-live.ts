"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Escucha avisos en tiempo real y refresca la pantalla al recibirlos.
 * - `scope: "staff"` → canal del local (personal logueado).
 * - `scope: "mesa"`  → canal de la mesa del comensal.
 * Si Ably no está configurado o se cae la conexión, refresca cada `fallbackMs`.
 * `onEvent` permite reaccionar a un aviso (sonido, notificación) además de refrescar.
 */
export function useLive({
  scope,
  slug,
  channel,
  enabled = true,
  fallbackMs = 15_000,
  onEvent,
}: {
  scope: "staff" | "mesa";
  slug?: string;
  /** Nombre del canal a escuchar (lo arma el servidor; acá solo se usa). */
  channel: string | null;
  enabled?: boolean;
  fallbackMs?: number;
  onEvent?: (data: Record<string, unknown>) => void;
}) {
  const router = useRouter();
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !channel) return;
    let cancelled = false;
    let live = false;
    let realtime: { close: () => void } | null = null;
    const url = `/api/realtime/token?scope=${scope}${slug ? `&slug=${encodeURIComponent(slug)}` : ""}`;

    // Respaldo: si no hay conexión en vivo, refrescar periódicamente con la pestaña visible.
    const poll = setInterval(() => {
      if (!live && document.visibilityState === "visible") router.refresh();
    }, fallbackMs);

    (async () => {
      const probe = await fetch(url).then((r) => r.json()).catch(() => null);
      if (cancelled || !probe || probe.disabled || probe.error) return;
      const Ably = await import("ably");
      if (cancelled) return;
      const client = new Ably.Realtime({
        authCallback: async (_params, cb) => {
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`token ${res.status}`);
            cb(null, await res.json());
          } catch (err) {
            cb(err instanceof Error ? err.message : "token", null);
          }
        },
      });
      realtime = client;
      client.connection.on((change) => {
        live = change.current === "connected";
        // Al reconectar, refrescar por si se perdió algún aviso mientras estaba caído.
        if (change.current === "connected" && change.previous && change.previous !== "initialized") router.refresh();
      });
      await client.channels.get(channel).subscribe("evt", (msg) => {
        onEventRef.current?.((msg.data ?? {}) as Record<string, unknown>);
        router.refresh();
      });
    })();

    return () => {
      cancelled = true;
      clearInterval(poll);
      realtime?.close();
    };
  }, [enabled, channel, scope, slug, fallbackMs, router]);
}
