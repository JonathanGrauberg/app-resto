"use client";

import { useState, type FormEvent } from "react";

/** Primera vez en la mesa: un apodo para que los demás sepan quién pidió qué (opcional). */
export function JoinDialog({
  tableLabel,
  onJoin,
  onCancel,
}: {
  tableLabel: string;
  onJoin: (nickname: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const err = await onJoin(name);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal aria-label="Unirte a la mesa">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} aria-label="Cancelar" tabIndex={-1} />
      <form
        onSubmit={submit}
        className="relative w-full space-y-4 rounded-t-3xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-3xl"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Mesa {tableLabel}</p>
          <h2 className="mt-1 text-xl font-bold">¿Cómo te llamamos?</h2>
          <p className="mt-1 text-sm text-muted">
            Así tu mesa ve quién pidió cada cosa. Pueden pedir todos desde su celular y todo va al mismo pedido.
          </p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="Tu nombre o apodo (opcional)"
          aria-label="Tu nombre o apodo"
          className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-base focus:border-brand focus:outline-none"
        />
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-50"
        >
          {busy ? "Entrando…" : "Entrar a la mesa"}
        </button>
      </form>
    </div>
  );
}
