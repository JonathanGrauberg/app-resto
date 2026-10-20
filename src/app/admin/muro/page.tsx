import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Flag, MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui/card";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { roomGone, wallPhase } from "@/lib/muro/data";
import { MURO_RULES } from "@/lib/muro/filter";
import { getRegion } from "@/lib/region-server";
import { db } from "@/lib/db";
import { BlockedWordsForm, NewGroup, NewWallForm } from "./forms";

export const metadata: Metadata = { title: "Muro" };

const PHASE = {
  ahora: { label: "En curso", tone: "ok" },
  proximo: { label: "Próximo", tone: "brand" },
  terminado: { label: "Terminado", tone: "neutral" },
} as const;

/** Muro: muros de evento (pantalla gigante), grupos de chat abiertos y palabras no permitidas. */
export default async function MuroPage() {
  const { tdb, tenant } = await requireTenantRole(ADMIN_ROLES, "MURO");
  const region = await getRegion(tenant.id);
  const [walls, rooms, settings] = await Promise.all([
    tdb.wall.findMany({ orderBy: { startsAt: "desc" }, take: 40, include: { _count: { select: { messages: true } } } }),
    tdb.chatRoom.findMany({
      where: { closedAt: null },
      orderBy: { createdAt: "desc" },
      include: { messages: { select: { reportedBy: true, hidden: true } } },
    }),
    db.tenantSettings.findUnique({ where: { tenantId: tenant.id }, select: { blockedWords: true } }),
  ]);
  const pendingCounts = walls.length
    ? await tdb.wallMessage.groupBy({ by: ["wallId"], where: { status: "PENDING" }, _count: { _all: true } })
    : [];
  const openRooms = rooms.filter((r) => !roomGone(r));
  const when = (d: Date) =>
    d.toLocaleString(region.locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: region.timezone });
  const ordered = [...walls].sort((a, b) => {
    const rank = { ahora: 0, proximo: 1, terminado: 2 };
    return rank[wallPhase(a)] - rank[wallPhase(b)] || (wallPhase(a) === "proximo" ? a.startsAt.getTime() - b.startsAt.getTime() : 0);
  });

  return (
    <>
      <PageHeader title="Muro" description="Mensajes en la pantalla del local durante un evento, y chat de mesa. Todo con filtro de palabras y +18." />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-8">
          {/* Muros de evento */}
          <section>
            <h2 className="mb-3 font-semibold">Muros de evento</h2>
            {ordered.length === 0 ? (
              <Card className="p-6 text-sm text-muted">
                Todavía no hay muros. Creá uno para el próximo cumpleaños, despedida o evento: los invitados escriben desde el QR y los
                mensajes salen en la tele o el proyector.
              </Card>
            ) : (
              <Card className="divide-y divide-line">
                {ordered.map((w) => {
                  const phase = PHASE[wallPhase(w)];
                  const pending = pendingCounts.find((p) => p.wallId === w.id)?._count._all ?? 0;
                  return (
                    <Link key={w.id} href={`/admin/muro/${w.id}`} className="flex items-center gap-3 p-3 hover:bg-bg sm:p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold">{w.name}</p>
                          <Badge tone={phase.tone}>{phase.label}</Badge>
                          {w.moderation === "APPROVE" && <Badge>Con aprobación</Badge>}
                          {pending > 0 && <Badge tone="warn">{pending} por aprobar</Badge>}
                        </div>
                        <p className="text-sm text-muted first-letter:uppercase">
                          {when(w.startsAt)} a {w.endsAt.toLocaleTimeString(region.locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: region.timezone })} ·{" "}
                          {w._count.messages} mensajes
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  );
                })}
              </Card>
            )}
          </section>

          {/* Grupos de chat */}
          <section>
            <h2 className="mb-1 font-semibold">Grupos de chat abiertos</h2>
            <p className="mb-3 text-sm text-muted">
              Los arma el mozo desde la mesa (en Sala) o se crean acá. Se cierran y se borran solos al cobrar la mesa (los sueltos, a las 12 h).
            </p>
            {openRooms.length === 0 ? (
              <Card className="p-6 text-sm text-muted">No hay grupos abiertos.</Card>
            ) : (
              <Card className="divide-y divide-line">
                {openRooms.map((r) => {
                  const reported = r.messages.filter((m) => m.reportedBy.length > 0).length;
                  return (
                    <Link key={r.id} href={`/admin/muro/grupo/${r.id}`} className="flex items-center gap-3 p-3 hover:bg-bg sm:p-4">
                      <MessagesSquare className="size-5 shrink-0 text-muted" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {r.name}
                          {r.tableLabel && <span className="font-normal text-muted"> · Mesa {r.tableLabel}</span>}
                        </p>
                        <p className="text-sm text-muted">{r.messages.length} mensajes</p>
                      </div>
                      {reported > 0 && (
                        <Badge tone="danger">
                          <Flag className="size-3" aria-hidden /> {reported} reportados
                        </Badge>
                      )}
                      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  );
                })}
              </Card>
            )}
          </section>
        </div>

        <div className="space-y-6 lg:sticky lg:top-8">
          <NewWallForm />
          <NewGroup slug={tenant.slug} venue={tenant.name} />
          <BlockedWordsForm words={settings?.blockedWords ?? []} />
          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold">Reglas que acepta cada invitado</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
              {MURO_RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Además confirman que son mayores de 18 años.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
