"use client";

import { createContext, useContext, useMemo } from "react";
import { COUNTRIES, DEFAULT_REGION, currencySymbol, formatMoney, moneyInputValue, parseMoney, type Region } from "@/lib/region";

const RegionContext = createContext<Region>(DEFAULT_REGION);

/** Moneda, formato y textos del país del local para los componentes del cliente. */
export function RegionProvider({ region, children }: { region: Region; children: React.ReactNode }) {
  return <RegionContext.Provider value={region}>{children}</RegionContext.Provider>;
}

export function useRegion() {
  const region = useContext(RegionContext);
  return useMemo(
    () => ({
      region,
      country: COUNTRIES[region.country],
      formatPrice: (cents: number) => formatMoney(cents, region),
      symbol: currencySymbol(region),
      parsePrice: (text: string) => parseMoney(text, region),
      inputValue: (cents: number) => moneyInputValue(cents, region),
    }),
    [region],
  );
}
