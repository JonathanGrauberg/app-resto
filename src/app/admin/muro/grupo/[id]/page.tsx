import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, EyeOff, Flag, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, Card } from "@/components/ui/card";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { cn } from "@/lib/format";
import { photoOk, roomGone } from "@/lib/muro/data";
import { getRegion } from "@/lib/region-server";
import { blockChatAuthor, closeChatRoom, removeRoomPhoto, setChatMessageHidden } from "../../actions";
import { LiveRefresh } from "../../[id]/wall-links";
import { GroupQr } from "./group-qr";

export const metadata: Metadata = { title: "Grupo de chat" };

/** Moderación de un grupo: reportados primero, ocultar, bloquear y cerrar el grupo. */
export default async function ChatRoomAdminPage({ params }: PageProps<"/admin/muro/grupo/[id]">) {
  const { tdb, tenant } = await requireTenantRole(ADMIN_ROLES, "MURO");
  const { id } = await params;
  const room = await tdb.chatRoom.findUnique({ where: { id } });
  if (!room) notFound();
  const region = await getRegion(tenant.id);
  const messages = await tdb.chatMessage.findMany({ where: { roomId: id }, orderBy: { createdAt: "desc" }, take: 300 });
  const reported = messages.filter((m) => m.reportedBy.length > 0);
  // Chat de una mesa: es privado de la mesa; el local solo ve lo reportado. Entre mesas: ve todo.
  const isPrivate = room.linkedRoomIds.length === 0;
  const gone = roomGone(room);
  const time = (d: Date) => d.toLocaleTimeString(region.locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: region.timezone });

  return (
    <>
      <LiveRefresh />
      <Link href="/admin/muro" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Muro
      </Link>
      <PageHeader
        title={room.name}
        description={`${room.tableLabel ? `Mesa ${room.tableLabel} · ` : "Grupo suelto · "}${gone ? "cerrado" : `abierto desde las ${time(room.createdAt)}`}`}
        actions={
          !gone && (
            <div className="flex gap-2">
              <GroupQr path={`/${tenant.slug}/chat/${room.code}`} name={room.name} venue={tenant.name} />
              <ActionButton
                action={closeChatRoom.bind(null, room.id, "/admin/muro")}
                confirm="¿Cerrar el grupo? Se borran todos los mensajes."
                className="rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger-soft"
              >
                Cerrar y borrar
              </ActionButton>
            </div>
          )
        }
      />

      {room.photoData && (
        <Card className="mb-6 flex items-center gap-4 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={room.photoData} alt="Foto de la mesa" className="size-20 rounded-xl object-cover" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Foto de la mesa</p>
            <p className="text-muted">{photoOk(room) ? "Vigente: la ven las otras mesas." : "Esperando que la apruebe otra persona de la mesa."}</p>
          </div>
          <form action={removeRoomPhoto.bind(null, room.id)}>
            <button className="rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger-soft">Sacar foto</button>
          </form>
        </Card>
      )}

      {reported.length > 0 && (
        <Card className="mb-6 border-danger/40 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Flag className="size-4 text-danger" aria-hidden /> Reportados ({reported.length})
          </h2>
          <ul className="divide-y divide-line">
            {reported.map((m) => (
              <Row key={m.id} m={m} time={time(m.createdAt)} />
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Con 2 reportes de personas distintas, el mensaje se oculta solo hasta que lo revises.</p>
        </Card>
      )}

      {isPrivate ? (
        <Card className="p-4 text-sm text-muted">
          {messages.length} {messages.length === 1 ? "mensaje" : "mensajes"} en el chat de la mesa. Es privado de la mesa: acá solo se ven los
          que alguien reporta.
        </Card>
      ) : (
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Mensajes ({messages.length})</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-muted">{gone ? "El grupo se cerró y sus mensajes se borraron." : "Todavía no hay mensajes."}</p>
        ) : (
          <ul className="divide-y divide-line">
            {messages.map((m) => (
              <Row key={m.id} m={m} time={time(m.createdAt)} />
            ))}
          </ul>
        )}
      </Card>
      )}
    </>
  );
}

function Row({ m, time }: { m: { id: string; authorName: string; text: string; hidden: boolean; reportedBy: string[] }; time: string }) {
  return (
    <li className="flex flex-wrap items-start gap-3 py-2.5">
      <div className={cn("min-w-0 flex-1", m.hidden && "opacity-50")}>
        <p className="text-xs text-muted">
          <strong className="text-ink">{m.authorName}</strong> · {time}
          {m.reportedBy.length > 0 && (
            <Badge className="ml-2" tone="danger">
              {m.reportedBy.length} {m.reportedBy.length === 1 ? "reporte" : "reportes"}
            </Badge>
          )}
          {m.hidden && (
            <Badge className="ml-2" tone="neutral">
              Oculto
            </Badge>
          )}
        </p>
        <p className={cn("break-words", m.hidden && "line-through")}>{m.text}</p>
      </div>
      <div className="flex gap-1">
        <form action={setChatMessageHidden.bind(null, m.id, !m.hidden)}>
          <button className="inline-flex h-9 items-center gap-1 rounded-lg border border-line px-3 text-sm hover:bg-ink/5">
            {m.hidden ? <RotateCcw className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
            {m.hidden ? "Mostrar" : "Ocultar"}
          </button>
        </form>
        <form action={blockChatAuthor.bind(null, m.id)}>
          <button
            className="inline-flex size-9 items-center justify-center rounded-lg border border-line text-danger hover:bg-danger-soft"
            title={`Bloquear a ${m.authorName} en este grupo`}
            aria-label={`Bloquear a ${m.authorName}`}
          >
            <Ban className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    </li>
  );
}
