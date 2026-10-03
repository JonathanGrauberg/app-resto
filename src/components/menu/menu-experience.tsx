"use client";

import { useState } from "react";
import type { PublicMenu, PublicProduct } from "@/lib/public-menu";
import { MenuBrowser } from "./menu-browser";
import { MenuHero, type Venue } from "./menu-hero";
import { ProductSheet } from "./product-sheet";

/** Carta completa del comensal: portada rotativa + carta + ficha de producto. */
export function MenuExperience({
  venue,
  menu,
  tableNumber,
  notice,
}: {
  venue: Venue;
  menu: PublicMenu;
  tableNumber?: string;
  notice?: React.ReactNode;
}) {
  const [open, setOpen] = useState<PublicProduct | null>(null);

  return (
    <>
      <MenuHero venue={venue} menu={menu} onOpenProduct={setOpen} />
      <div id="carta" className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-6 lg:px-10">
        {notice}
        <MenuBrowser menu={menu} onOpenProduct={setOpen} />
      </div>
      {open && <ProductSheet product={open} tableNumber={tableNumber} onClose={() => setOpen(null)} />}
    </>
  );
}
