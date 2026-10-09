"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Hora en la zona horaria del navegador (no la del servidor ni la del local).
 * En el servidor no se conoce esa zona: muestra "--:--" hasta hidratar.
 */
export function LocalTime({ iso }: { iso: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {mounted ? new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
    </time>
  );
}
