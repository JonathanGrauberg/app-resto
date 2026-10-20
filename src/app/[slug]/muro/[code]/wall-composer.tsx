"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/format";
import { useLive } from "@/lib/realtime/use-live";
import { postToWall } from "../actions";

type Msg = { id: string; author: string; text: string; mine: boolean };

export function WallComposer({
  slug,
  code,
  channel,
  name,
  guestName,
  open,
  approval,
  blocked,
  messages,
  mine,
}: {
  slug: string;
  code: string;
  channel: string;
  name: string;
  guestName: string;
  open: boolean;
  approval: boolean;
  blocked: boolean;
  messages: Msg[];
  mine: { id: string; text: string; status: string }[];
}) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  useLive({ scope: "muro", code, channel, fallbackMs: 10_000 });

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await postToWall(slug, code, text);
      setMsg(res);
      if (!res.error) setText("");
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Muro · {name}</h1>
        <p className="mt-1 text-sm text-muted">
          Escribís como <strong className="text-ink">{guestName}</strong>. Lo que mandes sale en la pantalla del local
          {approval ? " cuando el local lo apruebe" : ""}.
        </p>
      </div>

      {blocked ? (
        <p className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">El local te bloqueó en este muro.</p>
      ) : !open ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          El muro de este evento no está abierto ahora. Se puede escribir desde un rato antes del evento hasta que termina.
        </p>
      ) : (
        <form onSubmit={send} className="space-y-2">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={140}
              rows={2}
              placeholder="¡Que vivan los novios! 🎉"
              aria-label="Tu mensaje"
              className="min-h-14 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-base"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              aria-label="Mandar al muro"
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink disabled:opacity-40"
            >
              <Send className="size-5" aria-hidden />
            </button>
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>Sin insultos, quejas ni datos de contacto.</span>
            <span className="tabular-nums">{text.length}/140</span>
          </div>
          {msg && (
            <p className={cn("rounded-xl px-3 py-2 text-sm", msg.error ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok")} role="status">
              {msg.error ?? msg.ok}
            </p>
          )}
        </form>
      )}

      {mine.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Tus mensajes sin publicar</p>
          {mine.map((m) => (
            <p key={m.id} className="rounded-xl bg-ink/5 px-3 py-2 text-sm">
              {m.text}
              <span className="block text-xs text-muted">{m.status === "PENDING" ? "Esperando aprobación del local" : "El local lo ocultó"}</span>
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">En el muro</p>
        {messages.length === 0 && <p className="text-sm text-muted">Todavía nadie escribió. ¡Arrancá vos!</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn("rounded-2xl px-4 py-2.5", m.mine ? "bg-brand-soft" : "bg-surface ring-1 ring-line")}>
            <p className="text-xs font-semibold text-brand">{m.author}</p>
            <p className="break-words">{m.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
