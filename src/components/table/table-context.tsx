"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { DinerTableState } from "@/lib/table-session";
import { useLive } from "@/lib/realtime/use-live";
import { addToCart, callWaiter, joinTable, submitOrder, updateCartItem } from "@/app/[slug]/m/[qrToken]/actions";
import { JoinDialog } from "./join-dialog";
import { OrderSheet } from "./order-sheet";
import { ReviewPrompt } from "./review-prompt";
import { TableBar } from "./table-bar";

export type TableInfo = {
  slug: string;
  qrToken: string;
  label: string;
  venue: string;
  sessionId: string | null;
  sessionStatus: "NONE" | "OPEN" | "PENDING_PAYMENT";
  /** Enlace a la cuenta (cuando la mesa pidió cobrar). */
  receiptUrl: string | null;
  diner: { nickname: string; dinerId: string } | null;
  channel: string | null;
  reviewUrl: string | null;
  state: DinerTableState;
};

type AddInput = { productId: string; quantity: number; optionIds: string[]; notes?: string };
type Result = { ok?: string; error?: string; round?: number };

type Ctx = {
  info: TableInfo;
  canOrder: boolean;
  add: (input: AddInput) => Promise<Result>;
  setQty: (itemId: string, quantity: number) => Promise<Result>;
  send: () => Promise<Result>;
  call: () => Promise<Result>;
  openOrder: () => void;
  toast: (msg: string) => void;
};

const TableCtx = createContext<Ctx | null>(null);

/** null fuera de una mesa (carta pública sin QR). */
export function useTable() {
  return useContext(TableCtx);
}

export function TableProvider({ info, children }: { info: TableInfo; children: React.ReactNode }) {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const joinResolver = useRef<((joined: boolean) => void) | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // En vivo: lo que hacen los demás comensales y el personal aparece solo.
  useLive({ scope: "mesa", slug: info.slug, channel: info.channel, enabled: !!info.diner, fallbackMs: 12_000 });

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  /** Si el comensal todavía no se unió, pide el apodo; resuelve true cuando ya está en la mesa. */
  const ensureJoined = useCallback(() => {
    if (info.diner) return Promise.resolve(true);
    setJoinOpen(true);
    return new Promise<boolean>((resolve) => {
      joinResolver.current = resolve;
    });
  }, [info.diner]);

  const onJoin = useCallback(
    async (nickname: string) => {
      const res = await joinTable(info.slug, info.qrToken, nickname);
      if (res.error) return res.error;
      setJoinOpen(false);
      joinResolver.current?.(true);
      joinResolver.current = null;
      router.refresh();
      return null;
    },
    [info.slug, info.qrToken, router],
  );

  const value = useMemo<Ctx>(
    () => ({
      info,
      canOrder: info.sessionStatus !== "PENDING_PAYMENT",
      add: async (input) => {
        if (!(await ensureJoined())) return { error: "cancelado" };
        const res = await addToCart(info.slug, info.qrToken, input);
        if (!res.error) router.refresh();
        return res;
      },
      setQty: async (itemId, quantity) => {
        const res = await updateCartItem(info.slug, info.qrToken, itemId, quantity);
        router.refresh();
        return res;
      },
      send: async () => {
        const res = await submitOrder(info.slug, info.qrToken);
        if (!res.error) {
          router.refresh();
          // Invitación a reseñar: una sola vez por mesa, después del primer pedido.
          const key = `review:${info.sessionId}`;
          try {
            if (info.reviewUrl && !localStorage.getItem(key)) {
              localStorage.setItem(key, "1");
              setTimeout(() => setReview(true), 900);
            }
          } catch {}
        }
        return res;
      },
      call: async () => {
        if (!(await ensureJoined())) return { error: "cancelado" };
        const res = await callWaiter(info.slug, info.qrToken);
        router.refresh();
        return res;
      },
      openOrder: () => setOrderOpen(true),
      toast,
    }),
    [info, ensureJoined, router, toast],
  );

  return (
    <TableCtx.Provider value={value}>
      {children}
      <TableBar />
      {orderOpen && <OrderSheet onClose={() => setOrderOpen(false)} />}
      {joinOpen && (
        <JoinDialog
          tableLabel={info.label}
          onJoin={onJoin}
          onCancel={() => {
            setJoinOpen(false);
            joinResolver.current?.(false);
            joinResolver.current = null;
          }}
        />
      )}
      {review && info.reviewUrl && <ReviewPrompt url={info.reviewUrl} venue={info.venue} onClose={() => setReview(false)} />}
      {toastMsg && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4"
        >
          <p className="animate-fade-up rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bg shadow-xl">{toastMsg}</p>
        </div>
      )}
    </TableCtx.Provider>
  );
}
