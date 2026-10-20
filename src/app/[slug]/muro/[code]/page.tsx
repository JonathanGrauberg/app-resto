import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuThemeScript } from "@/components/menu/menu-theme-script";
import { JoinGate } from "@/components/muro/join-gate";
import { db } from "@/lib/db";
import { muroTenant, wallOpen } from "@/lib/muro/data";
import { readGuest } from "@/lib/muro/guest";
import { wallChannel } from "@/lib/realtime/server";
import { WallComposer } from "./wall-composer";

export const metadata: Metadata = { title: "Muro", robots: { index: false } };

/** Escribir en el muro del evento (se entra por el QR del evento). */
export default async function WallPage({ params }: PageProps<"/[slug]/muro/[code]">) {
  const { slug, code } = await params;
  const ctx = await muroTenant(slug);
  if (!ctx) notFound();
  const wall = await db.wall.findFirst({ where: { code, tenantId: ctx.tenant.id } });
  if (!wall) notFound();
  const guest = await readGuest();

  const [visible, mine] = await Promise.all([
    db.wallMessage.findMany({ where: { wallId: wall.id, status: "VISIBLE" }, orderBy: { createdAt: "desc" }, take: 30 }),
    guest
      ? db.wallMessage.findMany({ where: { wallId: wall.id, authorKey: guest.key, status: { not: "VISIBLE" } }, orderBy: { createdAt: "desc" }, take: 5 })
      : [],
  ]);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <MenuThemeScript slug={ctx.tenant.slug} theme={ctx.tenant.settings?.menuTheme ?? "DARK"} />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{ctx.tenant.name}</p>
      {!guest ? (
        <div className="mt-2">
          <JoinGate slug={slug} title={`Muro · ${wall.name}`} subtitle="Lo que escribas aparece en la pantalla del local." />
        </div>
      ) : (
        <WallComposer
          slug={slug}
          code={code}
          channel={wallChannel(ctx.tenant.id, wall.id)}
          name={wall.name}
          guestName={guest.name}
          open={wallOpen(wall)}
          approval={wall.moderation === "APPROVE"}
          blocked={wall.blockedKeys.includes(guest.key)}
          messages={visible.map((m) => ({ id: m.id, author: m.authorName, text: m.text, mine: m.authorKey === guest.key }))}
          mine={mine.map((m) => ({ id: m.id, text: m.text, status: m.status }))}
        />
      )}
    </main>
  );
}
