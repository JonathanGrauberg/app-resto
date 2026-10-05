"use client";

import { useState } from "react";
import { BellRing, ReceiptText, ShoppingBag } from "lucide-react";
import { useTable } from "./table-context";

/** Barra fija de la mesa: quién soy, llamar al mozo y ver el pedido compartido. */
export function TableBar() {
  const t = useTable()!;
  const [calling, setCalling] = useState(false);
  const { info } = t;
  const inCart = info.state.cart.reduce((n, i) => n + i.quantity, 0);
  const sent = info.state.orders.filter((o) => o.status !== "REJECTED").length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-2 sm:gap-3 sm:px-2 lg:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{info.diner ? `Hola, ${info.diner.nickname}` : "Estás en"}</p>
          <p className="font-semibold leading-tight">Mesa {info.label}</p>
        </div>

        {info.sessionStatus === "PENDING_PAYMENT" ? (
          info.diner && info.receiptUrl ? (
            <a
              href={info.receiptUrl}
              className="flex h-12 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-ink"
            >
              <ReceiptText className="size-4" aria-hidden /> Ver la cuenta y dividir
            </a>
          ) : (
            <p className="rounded-full bg-warn-soft px-3 py-2 text-sm font-medium text-warn">Cerrando la cuenta</p>
          )
        ) : (
          <>
            <button
              onClick={async () => {
                setCalling(true);
                const res = await t.call();
                setCalling(false);
                if (res.ok) t.toast(res.ok);
                else if (res.error && res.error !== "cancelado") t.toast(res.error);
              }}
              disabled={calling}
              aria-label="Llamar al mozo"
              className="flex h-12 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium disabled:opacity-50"
            >
              <BellRing className="size-4" aria-hidden /> <span className="hidden sm:inline">Llamar</span> mozo
            </button>
            <button
              onClick={t.openOrder}
              className="relative flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-bg"
            >
              <ShoppingBag className="size-4" aria-hidden />
              {inCart > 0 ? "Ver pedido" : sent > 0 ? "Mis pedidos" : "Pedido"}
              {inCart > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-ink ring-2 ring-bg">
                  {inCart}
                </span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
