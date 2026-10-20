import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { regionOf } from "@/lib/region";

/** Región del local (moneda, formato, zona horaria). Cacheado por request. */
export const getRegion = cache(async (tenantId: string) => {
  const s = await db.tenantSettings.findUnique({
    where: { tenantId },
    select: { country: true, currency: true, locale: true, timezone: true },
  });
  return regionOf(s);
});
