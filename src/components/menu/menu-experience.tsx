"use client";

import { useState } from "react";
import type { PublicMenu, PublicProduct } from "@/lib/public-menu";
import { MenuBrowser } from "./menu-browser";
import { MenuHero, type Venue } from "./menu-hero";
import { ProductSheet } from "./product-sheet";
import { TableProvider, type TableInfo } from "@/components/table/table-context";

/** Carta completa del comensal: portada rotativa + carta + ficha de producto. */
export function MenuExperience({
  venue,
  menu,
  table,
  notice,
}: {
  venue: Venue;
  menu: PublicMenu;
  /** Si viene de un QR de mesa: carrito compartido, pedidos y barra de mesa. */
  table?: TableInfo;
  notice?: React.ReactNode;
}) {
  const [open, setOpen] = useState<PublicProduct | null>(null);

  const content = (
    <>
      <MenuHero venue={venue} menu={menu} onOpenProduct={setOpen} />
      <div id="carta" className="mx-auto w-full max-w-7xl scroll-mt-4 px-4 sm:px-6 lg:px-10">
        {notice}
        <MenuBrowser menu={menu} onOpenProduct={setOpen} />
      </div>
      {open && <ProductSheet product={open} onClose={() => setOpen(null)} />}
    </>
  );
  return table ? <TableProvider info={table}>{content}</TableProvider> : content;
}
