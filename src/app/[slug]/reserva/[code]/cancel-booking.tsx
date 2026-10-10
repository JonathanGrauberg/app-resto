"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError } from "@/components/ui/field";
import { cancelBooking } from "../../reservar/actions";

export function CancelBooking({ slug, code }: { slug: string; code: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="mt-6 h-12 w-full rounded-full border border-line text-sm font-semibold text-danger hover:bg-danger-soft"
      >
        Cancelar la reserva
      </button>
    );
  }
  return (
    <div className="mt-6 space-y-3 rounded-2xl border border-danger/40 bg-danger-soft/40 p-4">
      <p className="text-sm font-medium">¿Seguro? La mesa queda libre para otra persona.</p>
      <FormError message={error} />
      <div className="flex gap-2">
        <button onClick={() => setConfirming(false)} className="h-11 flex-1 rounded-full text-sm hover:bg-ink/5">
          No, mantener
        </button>
        <button
          onClick={() =>
            start(async () => {
              const res = await cancelBooking(slug, code);
              if (res.error) return setError(res.error);
              router.refresh();
            })
          }
          disabled={pending}
          className="h-11 flex-1 rounded-full bg-danger text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Cancelando…" : "Sí, cancelar"}
        </button>
      </div>
    </div>
  );
}
