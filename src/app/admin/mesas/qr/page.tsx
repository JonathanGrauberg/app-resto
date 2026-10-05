import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import { PageHeader } from "@/components/app-shell";
import { requireTenantRole } from "@/lib/auth/guards";
import { baseUrl } from "@/lib/base-url";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { cn } from "@/lib/format";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "QR de mesas" };

export default async function QrSheetPage({ searchParams }: PageProps<"/admin/mesas/qr">) {
  const { tenant, tdb } = await requireTenantRole(ADMIN_ROLES);
  const { salon } = await searchParams;

  const areas = await tdb.area.findMany({
    where: typeof salon === "string" ? { id: salon } : undefined,
    orderBy: { sortOrder: "asc" },
    // Mesas extra y archivadas no llevan QR impreso (se muestra en pantalla desde Sala).
    include: { tables: { where: { status: { not: "DISABLED" }, temporary: false, archivedAt: null }, orderBy: { number: "asc" } } },
  });
  const base = await baseUrl();

  const cards = await Promise.all(
    areas.flatMap((a) =>
      a.tables.map(async (t) => {
        const url = `${base}/${tenant.slug}/m/${t.qrToken}`;
        const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
        return { id: t.id, number: t.number, area: a.name, url, svg };
      }),
    ),
  );

  return (
    <>
      <div className="print:hidden">
        <Link href="/admin/mesas" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Mesas
        </Link>
        <PageHeader
          title="QR de mesas"
          description={`${cards.length} códigos${areas.length === 1 ? ` · ${areas[0].name}` : ""}. Cada uno abre la carta de su mesa.`}
          actions={<PrintButton />}
        />
        {base.includes("localhost") && (
          <p className="mb-6 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
            Estás en desarrollo: estos QR apuntan a <strong>{base}</strong> y solo funcionan en esta computadora. En
            producción apuntarán al dominio real.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-0">
        {cards.map((c) => (
          <div
            key={c.id}
            className={cn(
              "flex break-inside-avoid flex-col items-center rounded-2xl border border-line bg-white p-5 text-center text-[#1a1714]",
              "print:rounded-none print:border-dashed print:p-6",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a6b1f]">{tenant.name}</p>
            <p className="mt-1 text-3xl font-black">Mesa {c.number}</p>
            <div className="my-4 aspect-square w-full max-w-44 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <p className="text-sm font-medium">Escaneá para ver la carta y pedir</p>
            <p className="mt-1 text-[10px] text-[#736b62]">{c.area}</p>
          </div>
        ))}
      </div>
    </>
  );
}
