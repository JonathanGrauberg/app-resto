"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Flag, Send } from "lucide-react";
import { cn } from "@/lib/format";
import { useLive } from "@/lib/realtime/use-live";
import { postToChat, reportChatMessage } from "../../muro/actions";

type Msg = { id: string; author: string; text: string; mine: boolean; hidden: boolean; reported: boolean; at: string };

export function ChatView({
  slug,
  code,
  channel,
  name,
  tableLabel,
  me,
  blocked,
  messages,
}: {
  slug: string;
  code: string;
  channel: string;
  name: string;
  tableLabel: string | null;
  me: string;
  blocked: boolean;
  messages: Msg[];
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useLive({ scope: "chat", code, channel, fallbackMs: 6_000 });

  // Al llegar mensajes nuevos, bajar al último.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await postToChat(slug, code, text);
      setError(res.error ?? null);
      if (!res.error) setText("");
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-3">
        <h1 className="text-2xl font-black tracking-tight">{name}</h1>
        <p className="text-sm text-muted">
          {tableLabel ? `Mesa ${tableLabel} · ` : ""}Estás como <strong className="text-ink">{me}</strong> · se borra cuando la mesa se va
        </p>
      </header>

      <div className="flex-1 space-y-2 pb-4">
        {messages.length === 0 && <p className="py-8 text-center text-sm text-muted">Nadie escribió todavía. ¡Rompé el hielo! 🍻</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn("group flex", m.mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2",
                m.mine ? "rounded-br-md bg-brand text-brand-ink" : "rounded-bl-md bg-surface ring-1 ring-line",
                m.hidden && "opacity-50",
              )}
            >
              {!m.mine && <p className="text-xs font-semibold text-brand">{m.author}</p>}
              <p className="break-words">{m.text}</p>
              <p className={cn("mt-0.5 flex items-center justify-end gap-2 text-[10px]", m.mine ? "text-brand-ink/70" : "text-muted")}>
                {m.hidden && <span>oculto por el local</span>}
                {new Date(m.at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                {!m.mine && !m.reported && (
                  <button
                    onClick={() =>
                      start(async () => {
                        const res = await reportChatMessage(slug, code, m.id);
                        setInfo(res.error ?? res.ok ?? null);
                      })
                    }
                    aria-label={`Reportar mensaje de ${m.author}`}
                    title="Reportar"
                    className="rounded p-0.5 opacity-60 hover:opacity-100"
                  >
                    <Flag className="size-3" aria-hidden />
                  </button>
                )}
                {m.reported && <span>reportado</span>}
              </p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      {info && <p className="mb-2 rounded-xl bg-ink/5 px-3 py-2 text-xs text-muted">{info}</p>}
      {blocked ? (
        <p className="rounded-2xl bg-danger-soft p-3 text-sm text-danger">El local te bloqueó en este chat.</p>
      ) : (
        <form onSubmit={send} className="sticky bottom-3 flex items-end gap-2 rounded-2xl bg-bg/80 py-1 backdrop-blur">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={140}
            placeholder="¿Alguien comparte una cerveza? 🍺"
            aria-label="Mensaje"
            className="h-12 flex-1 rounded-full border border-line bg-surface px-4 text-base"
          />
          <button
            type="submit"
            disabled={pending || !text.trim()}
            aria-label="Enviar"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink disabled:opacity-40"
          >
            <Send className="size-5" aria-hidden />
          </button>
        </form>
      )}
      {error && <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
