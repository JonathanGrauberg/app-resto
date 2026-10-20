import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageCircleOff } from "lucide-react";
import { MenuThemeScript } from "@/components/menu/menu-theme-script";
import { JoinGate } from "@/components/muro/join-gate";
import { db } from "@/lib/db";
import { chatPageData, muroTenant, roomGone } from "@/lib/muro/data";
import { readDiner } from "@/lib/diner";
import { readGuest } from "@/lib/muro/guest";
import { chatChannel } from "@/lib/realtime/server";
import { ChatView } from "./chat-view";

export const metadata: Metadata = { title: "Chat de la mesa", robots: { index: false } };

/** Chat de una mesa o grupo (se entra por el QR que arma el mozo). */
export default async function ChatPage({ params, searchParams }: PageProps<"/[slug]/chat/[code]">) {
  const { slug, code } = await params;
  // Embebido en la carta de la mesa (ventana sobre la carta): sin encabezado del local.
  const embed = (await searchParams).embed === "1";
  const ctx = await muroTenant(slug);
  if (!ctx) notFound();
  const room = await db.chatRoom.findFirst({ where: { code, tenantId: ctx.tenant.id } });
  if (!room) notFound();
  const theme = <MenuThemeScript slug={ctx.tenant.slug} theme={ctx.tenant.settings?.menuTheme ?? "DARK"} />;

  if (roomGone(room)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        {theme}
        <MessageCircleOff className="size-10 text-muted" aria-hidden />
        <h1 className="text-xl font-semibold">Este chat ya se cerró</h1>
        <p className="max-w-sm text-sm text-muted">Los chats de mesa se borran cuando la mesa se va. ¡Gracias por venir a {ctx.tenant.name}!</p>
      </main>
    );
  }

  const guest = await readGuest();
  const [messages, extra] = guest
    ? await Promise.all([
        db.chatMessage.findMany({ where: { roomId: room.id }, orderBy: { createdAt: "asc" }, take: 200 }),
        chatPageData(room, guest.key),
      ])
    : [[], null];

  return (
    <main className={embed ? "mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-3" : "mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6"}>
      {theme}
      {!embed && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{ctx.tenant.name}</p>}
      {!guest ? (
        <div className="mt-2">
          <JoinGate
            slug={slug}
            title={room.name}
            kind={room.linkedRoomIds.length ? "joint" : "table"}
            defaultName={(await readDiner(ctx.tenant.id))?.nickname ?? ""}
            subtitle={
              room.linkedRoomIds.length
                ? "Chat compartido entre dos mesas que se mandaron un brindis. Se borra cuando alguna se va."
                : "El chat de la mesa: para hablar entre todos sin pararse. Se borra cuando la mesa se va."
            }
          />
        </div>
      ) : (
        <ChatView
          embed={embed}
          extra={extra!}
          slug={slug}
          code={code}
          channel={chatChannel(ctx.tenant.id, room.id)}
          name={room.name}
          tableLabel={room.tableLabel}
          me={guest.name}
          blocked={room.blockedKeys.includes(guest.key)}
          messages={messages
            .filter((m) => !m.hidden || m.authorKey === guest.key)
            .map((m) => ({
              id: m.id,
              author: m.authorName,
              text: m.text,
              mine: m.authorKey === guest.key,
              hidden: m.hidden,
              reported: m.reportedBy.includes(guest.key),
              at: m.createdAt.toISOString(),
            }))}
        />
      )}
    </main>
  );
}
