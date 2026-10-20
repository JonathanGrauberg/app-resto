import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, Check, EyeOff, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui/card";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { baseUrl } from "@/lib/base-url";
import { cn } from "@/lib/format";
import { getRegion } from "@/lib/region-server";
import { blockWallAuthor, deleteWall, setWallMessage, setWallModeration } from "../actions";
import { LiveRefresh, WallLinks } from "./wall-links";
import { ActionButton } from "@/components/ui/action-button";

export const metadata: Metadata = { title: "Muro" };

/** Moderación de un muro: aprobar, ocultar, bloquear; enlaces de la pantalla y del QR. */
export default async function WallAdminPage({ params }: PageProps<"/admin/muro/[id]">) {
  const { tdb, tenant } = await requireTenantRole(ADMIN_ROLES, "MURO");
  const { id } = await params;
  const wall = await tdb.wall.findUnique({ where: { id } });
  if (!wall) notFound();
  const region = await getRegion(tenant.id);
  const messages = await tdb.wallMessage.findMany({ where: { wallId: id }, orderBy: { createdAt: "desc" }, take: 200 });
  const pending = messages.filter((m) => m.status === "PENDING");
  const rest = messages.filter((m) => m.status !== "PENDING");
  const base = await baseUrl();
  const time = (d: Date) => d.toLocaleTimeString(region.locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: region.timezone });

  return (
    <>
      <LiveRefresh />
      <Link href="/admin/muro" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Muro
      </Link>
      <PageHeader
        title={wall.name}
        description={`${wall.startsAt.toLocaleString(region.locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: region.timezone })} a ${time(wall.endsAt)}`}
        actions={
          <ActionButton
            action={deleteWall.bind(null, wall.id)}
            confirm={`¿Borrar el muro "${wall.name}" y todos sus mensajes?`}
            className="rounded-xl px-3 py-2 text-sm text-danger hover:bg-danger-soft"
          >
            Borrar muro
          </ActionButton>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          {pending.length > 0 && (
            <Card className="border-warn/50 p-4">
              <h2 className="mb-2 font-semibold">Por aprobar ({pending.length})</h2>
              <ul className="divide-y divide-line">
                {pending.map((m) => (
                  <MessageRow key={m.id} m={m} time={time(m.createdAt)} />
                ))}
              </ul>
            </Card>
          )}
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">Mensajes ({rest.length})</h2>
            {rest.length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay mensajes.</p>
            ) : (
              <ul className="divide-y divide-line">
                {rest.map((m) => (
                  <MessageRow key={m.id} m={m} time={time(m.createdAt)} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-8">
          <WallLinks
            venue={tenant.name}
            name={wall.name}
            joinPath={`/${tenant.slug}/muro/${wall.code}`}
            screenUrl={`${base}/${tenant.slug}/pantalla/${wall.screenToken}`}
          />
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">Moderación</h2>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["AUTO", "Salen directo", "Con filtro de palabras"],
                  ["APPROVE", "Con aprobación", "Aprobás cada mensaje"],
                ] as const
              ).map(([mode, label, hint]) => (
                <form key={mode} action={setWallModeration.bind(null, wall.id, mode)}>
                  <button
                    className={cn(
                      "h-full w-full rounded-xl border p-3 text-left",
                      wall.moderation === mode ? "border-brand bg-brand-soft" : "border-line hover:border-ink/30",
                    )}
                  >
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </button>
                </form>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              {wall.blockedKeys.length ? `${wall.blockedKeys.length} personas bloqueadas en este muro.` : "Nadie bloqueado."}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function MessageRow({ m, time }: { m: { id: string; authorName: string; text: string; status: string }; time: string }) {
  return (
    <li className="flex flex-wrap items-start gap-3 py-2.5">
      <div className={cn("min-w-0 flex-1", m.status === "HIDDEN" && "opacity-50")}>
        <p className="text-xs text-muted">
          <strong className="text-ink">{m.authorName}</strong> · {time}
          {m.status === "HIDDEN" && (
            <Badge className="ml-2" tone="neutral">
              Oculto
            </Badge>
          )}
        </p>
        <p className={cn("break-words", m.status === "HIDDEN" && "line-through")}>{m.text}</p>
      </div>
      <div className="flex gap-1">
        {m.status === "PENDING" && (
          <form action={setWallMessage.bind(null, m.id, "VISIBLE")}>
            <button className="inline-flex h-9 items-center gap-1 rounded-lg bg-ok px-3 text-sm font-semibold text-white">
              <Check className="size-4" aria-hidden /> Aprobar
            </button>
          </form>
        )}
        {m.status !== "HIDDEN" ? (
          <form action={setWallMessage.bind(null, m.id, "HIDDEN")}>
            <button className="inline-flex h-9 items-center gap-1 rounded-lg border border-line px-3 text-sm hover:bg-ink/5" title="Sacar de la pantalla">
              <EyeOff className="size-4" aria-hidden /> Ocultar
            </button>
          </form>
        ) : (
          <form action={setWallMessage.bind(null, m.id, "VISIBLE")}>
            <button className="inline-flex h-9 items-center gap-1 rounded-lg border border-line px-3 text-sm hover:bg-ink/5">
              <RotateCcw className="size-4" aria-hidden /> Mostrar
            </button>
          </form>
        )}
        <form action={blockWallAuthor.bind(null, m.id)}>
          <button
            className="inline-flex size-9 items-center justify-center rounded-lg border border-line text-danger hover:bg-danger-soft"
            title={`Bloquear a ${m.authorName} y ocultar todos sus mensajes`}
            aria-label={`Bloquear a ${m.authorName}`}
          >
            <Ban className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    </li>
  );
}
