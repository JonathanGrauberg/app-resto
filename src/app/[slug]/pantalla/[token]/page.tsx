import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { baseUrl } from "@/lib/base-url";
import { db } from "@/lib/db";
import { muroTenant } from "@/lib/muro/data";
import { wallChannel } from "@/lib/realtime/server";
import { ScreenView } from "./screen-view";

export const metadata: Metadata = { title: "Pantalla", robots: { index: false } };

/**
 * Pantalla del muro para la tele o el proyector (enlace secreto del local).
 * `?modo=overlay`: fondo transparente y solo los mensajes, para poner encima del video (OBS, etc.).
 */
export default async function ScreenPage({ params, searchParams }: PageProps<"/[slug]/pantalla/[token]">) {
  const { slug, token } = await params;
  const { modo } = await searchParams;
  const ctx = await muroTenant(slug);
  if (!ctx) notFound();
  const wall = await db.wall.findFirst({ where: { screenToken: token, tenantId: ctx.tenant.id } });
  if (!wall) notFound();
  const messages = await db.wallMessage.findMany({ where: { wallId: wall.id, status: "VISIBLE" }, orderBy: { createdAt: "desc" }, take: 8 });
  const joinUrl = `${await baseUrl()}/${slug}/muro/${wall.code}`;
  const qr = await QRCode.toString(joinUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });

  return (
    <ScreenView
      code={token}
      channel={wallChannel(ctx.tenant.id, wall.id)}
      overlay={modo === "overlay"}
      venue={ctx.tenant.name}
      videoUrl={wall.videoUrl}
      event={wall.name}
      qr={qr}
      joinHost={joinUrl.replace(/^https?:\/\//, "").replace(/\/muro\/.*/, "")}
      messages={messages.map((m) => ({ id: m.id, author: m.authorName, text: m.text }))}
    />
  );
}
