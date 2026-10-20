"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Check, Flag, Send, Users, X } from "lucide-react";
import { cn } from "@/lib/format";
import type { ChatPageData } from "@/lib/muro/data";
import { useLive } from "@/lib/realtime/use-live";
import { answerBrindis, closeJoint, postToChat, reportChatMessage, sendBrindis, uploadRoomPhoto, voteRoomPhoto } from "../../muro/actions";
import { PhotoCamera } from "./photo-camera";

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
  extra,
  embed = false,
}: {
  slug: string;
  code: string;
  channel: string;
  name: string;
  tableLabel: string | null;
  me: string;
  blocked: boolean;
  messages: Msg[];
  extra: ChatPageData;
  /** Abierto en la ventana sobre la carta de la mesa: los enlaces siguen dentro de la ventana. */
  embed?: boolean;
}) {
  const chatHref = (c: string) => `/${slug}/chat/${c}${embed ? "?embed=1" : ""}`;
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState(false);
  const [camera, setCamera] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useLive({ scope: "chat", code, channel, fallbackMs: 6_000 });

  // Al llegar mensajes nuevos, bajar al último.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Brindis nuevo: que vibre el celular.
  const seen = useRef(extra.incoming.length);
  useEffect(() => {
    if (extra.incoming.length > seen.current) navigator.vibrate?.([120, 60, 120]);
    seen.current = extra.incoming.length;
  }, [extra.incoming.length]);

  const run = (fn: () => Promise<{ ok?: string; error?: string; jointCode?: string }>, after?: (r: { jointCode?: string }) => void) =>
    start(async () => {
      const res = await fn();
      setInfo(res.error ?? res.ok ?? null);
      if (!res.error) after?.(res);
    });

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await postToChat(slug, code, text);
      setError(res.error ?? null);
      if (!res.error) setText("");
    });
  };

  const photo = extra.photo;

  return (
    <div className="flex flex-1 flex-col">
      {/* Pestañas: chat de la mesa y un chat por cada brindis aceptado */}
      {extra.tabs.length > 1 && (
        <nav className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1" aria-label="Chats">
          {extra.tabs.map((t) => (
            <Link
              key={t.code}
              href={chatHref(t.code)}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                t.active ? "bg-ink text-bg" : "bg-surface text-muted ring-1 ring-line hover:text-ink",
              )}
            >
              {t.kind === "brindis" && <span aria-hidden>🍻</span>}
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Encabezado */}
      <header className="mb-3 flex items-center gap-3">
        {extra.isJoint ? (
          <div className="flex -space-x-3">
            {extra.sides.map((s) => (
              <Avatar key={s.label} photo={s.photo} label={s.label} />
            ))}
          </div>
        ) : (
          <Avatar photo={photo?.approved || photo?.mine ? photo.data : null} label={name} />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black tracking-tight">{extra.title || name}</h1>
          <p className="text-sm text-muted">
            {tableLabel ? `Mesa ${tableLabel} · ` : ""}Estás como <strong className="text-ink">{me}</strong> ·{" "}
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden /> {extra.members}
            </span>
          </p>
        </div>
        {extra.isJoint && (
          <button
            onClick={() => window.confirm("¿Cerrar el chat con la otra mesa? Se borran los mensajes.") && run(() => closeJoint(slug, code), () => router.refresh())}
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs hover:bg-ink/5"
          >
            Cerrar
          </button>
        )}
      </header>

      {extra.isJoint && (
        <p className="mb-3 rounded-xl bg-ink/5 px-3 py-2 text-xs text-muted">
          Chat entre mesas: el local puede revisar los mensajes y bloquear a quien no respete las reglas. Se borra cuando alguna mesa se va.
        </p>
      )}

      {/* Brindis recibidos */}
      {extra.incoming.map((i) => (
        <div key={i.id} className="mb-3 animate-fade-up rounded-2xl border border-brand bg-brand-soft p-3">
          <div className="flex items-center gap-3">
            <Avatar photo={i.photo} label={i.label} small />
            <p className="flex-1 text-sm">
              <strong>¡La {i.label} les manda un brindis! 🍻</strong>
              <span className="block text-muted">¿Se suman a un chat con ellos? ({i.people} {i.people === 1 ? "persona" : "personas"})</span>
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => run(() => answerBrindis(slug, code, i.id, false))} disabled={pending} className="flex-1 rounded-full py-2 text-sm hover:bg-ink/5">
              No, gracias
            </button>
            <button
              onClick={() => run(() => answerBrindis(slug, code, i.id, true), (r) => r.jointCode && router.push(chatHref(r.jointCode)))}
              disabled={pending}
              className="flex-1 rounded-full bg-brand py-2 text-sm font-semibold text-brand-ink"
            >
              ¡Sí, sumarnos!
            </button>
          </div>
        </div>
      ))}

      {/* Foto de la mesa: la aprueba otra persona */}
      {photo && !photo.approved && !photo.mine && !photo.voted && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.data} alt="Foto de la mesa por aprobar" className="size-16 rounded-xl object-cover" />
          <p className="flex-1 text-sm">Sacaron la foto de la mesa. ¿La aprueban? Es la que ven las otras mesas.</p>
          <div className="flex flex-col gap-1">
            <button onClick={() => run(() => voteRoomPhoto(slug, code, true))} className="inline-flex items-center gap-1 rounded-full bg-ok px-3 py-1.5 text-xs font-semibold text-white">
              <Check className="size-3.5" aria-hidden /> Sí
            </button>
            <button onClick={() => run(() => voteRoomPhoto(slug, code, false))} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs hover:bg-ink/5">
              <X className="size-3.5" aria-hidden /> No
            </button>
          </div>
        </div>
      )}

      {/* Acciones de la mesa */}
      {!extra.isJoint && !blocked && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => setPicking((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold",
              picking ? "bg-ink text-bg" : "bg-brand text-brand-ink",
            )}
          >
            🍻 Mandar un brindis
          </button>
          <button onClick={() => setCamera(true)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm hover:bg-ink/5">
            <Camera className="size-4" aria-hidden /> {photo ? "Cambiar foto de la mesa" : "Foto de la mesa"}
          </button>
          {photo && !photo.approved && (photo.mine || photo.voted) && (
            <span className="self-center text-xs text-muted">Foto esperando que otra persona de la mesa la apruebe</span>
          )}
        </div>
      )}

      {picking && (
        <div className="mb-3 rounded-2xl border border-line bg-surface p-3">
          <p className="mb-2 text-sm font-semibold">¿A qué mesa le mandan un brindis?</p>
          {extra.candidates.length === 0 ? (
            <p className="text-sm text-muted">Por ahora no hay otras mesas ocupadas.</p>
          ) : (
            <ul className="space-y-1.5">
              {extra.candidates.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <Avatar photo={c.photo} label={c.label} small />
                  <span className="flex-1 text-sm">
                    <strong>{c.label}</strong>
                    <span className="block text-xs text-muted">
                      {c.viaWaiter
                        ? "No tienen el chat abierto: le avisamos a su mozo para que les pregunte"
                        : `${c.people} ${c.people === 1 ? "persona" : "personas"} en el chat`}
                    </span>
                  </span>
                  <button
                    onClick={() => run(() => sendBrindis(slug, code, c.id), () => setPicking(false))}
                    disabled={pending}
                    className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-ink disabled:opacity-50"
                  >
                    Brindis 🍻
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">Si aceptan, se abre un chat entre las dos mesas. Si dicen que no, no se les vuelve a insistir. Máximo 6 brindis por noche.</p>
        </div>
      )}

      {/* Brindis esperando respuesta (los aceptados ya están en las pestañas) */}
      {extra.outgoing.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {extra.outgoing.map((o) => (
            <span key={o.id} className="rounded-full bg-ink/5 px-3 py-1.5 text-xs text-muted">
              Brindis a {o.label}: esperando…
            </span>
          ))}
        </div>
      )}

      {/* Mensajes */}
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
                    onClick={() => run(() => reportChatMessage(slug, code, m.id))}
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
            placeholder={extra.isJoint ? "¡Salud! 🍻" : "¿Alguien comparte una cerveza? 🍺"}
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

      {camera && (
        <PhotoCamera
          onClose={() => setCamera(false)}
          onShot={(dataUrl) =>
            run(
              () => uploadRoomPhoto(slug, code, dataUrl),
              () => setCamera(false),
            )
          }
          busy={pending}
        />
      )}
    </div>
  );
}

function Avatar({ photo, label, small = false }: { photo: string | null; label: string; small?: boolean }) {
  const size = small ? "size-10 text-sm" : "size-14 text-lg";
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt={label} className={cn(size, "shrink-0 rounded-full object-cover ring-2 ring-bg")} />
  ) : (
    <span className={cn(size, "flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand ring-2 ring-bg")}>
      {label.replace(/^Mesa\s+/, "").slice(0, 2).toUpperCase()}
    </span>
  );
}
