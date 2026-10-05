import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readDiner } from "@/lib/diner";
import { createSubscribeToken, realtimeEnabled, staffChannel, tableChannel } from "@/lib/realtime/server";

/**
 * Permisos temporales de tiempo real (solo escuchar).
 *   ?scope=staff            → personal logueado: canal de su local
 *   ?scope=mesa&slug=<slug> → comensal con cookie de mesa: solo el canal de su mesa
 * Si el tiempo real no está configurado responde { disabled: true } y la pantalla
 * usa actualización periódica.
 */
export async function GET(request: NextRequest) {
  if (!realtimeEnabled()) return NextResponse.json({ disabled: true });
  const scope = request.nextUrl.searchParams.get("scope");

  if (scope === "staff") {
    const session = await getSession();
    if (!session?.membership || !session.tenant) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const token = await createSubscribeToken(`staff:${session.membership.id}`, [staffChannel(session.tenant.id)]);
    return NextResponse.json(token);
  }

  if (scope === "mesa") {
    const slug = request.nextUrl.searchParams.get("slug") ?? "";
    const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true, active: true } });
    if (!tenant?.active) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const diner = await readDiner(tenant.id);
    if (!diner) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const open = await db.tableSession.findFirst({
      where: { id: diner.sessionId, tenantId: tenant.id, status: { not: "CLOSED" } },
      select: { id: true },
    });
    if (!open) return NextResponse.json({ error: "La mesa ya se cerró" }, { status: 401 });
    const token = await createSubscribeToken(`comensal:${diner.dinerId}`, [tableChannel(tenant.id, open.id)]);
    return NextResponse.json(token);
  }

  return NextResponse.json({ error: "scope inválido" }, { status: 400 });
}
