/**
 * Local de demo: parrilla argentina (Paraná) para mostrar a clientes.
 * Carta en pesos, mesas, personal, horarios de reserva y ~3 semanas de ventas y compras
 * para que "Compras" (vendido vs comprado) tenga números.
 *
 * Idempotente: borra y vuelve a crear SOLO el local `parrilla-demo`.
 * Las claves de acceso se generan al correrlo y se guardan en `.env.demo-parrilla` (gitignored).
 *
 *   npx tsx --conditions=react-server prisma/seed-parrilla.ts
 */
import "dotenv/config";
import { randomBytes, randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import type { Allergen, PaymentMethod, PrepStation, PurchaseCategory } from "../src/generated/prisma/enums";
import { localParts, zonedToUtc } from "../src/lib/booking";
import { db } from "../src/lib/db";
import { regionSettingsFor } from "../src/lib/region";

const SLUG = "parrilla-demo";
const TZ = "America/Argentina/Buenos_Aires";
const qr = () => randomBytes(12).toString("base64url");
const $ = (pesos: number) => pesos * 100;

// Números pseudoaleatorios estables: la demo sale igual cada vez.
let seed = 20261019;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const roundTo = (cents: number, step: number) => Math.round(cents / step) * step;

type P = { name: string; price: number; station?: PrepStation; allergens?: Allergen[]; description?: string; tags?: string[]; cut?: boolean };
const MENU: { category: string; products: P[] }[] = [
  {
    category: "Entradas",
    products: [
      { name: "Provoleta a la parrilla", price: 9500, allergens: ["MILK"], description: "Con orégano y aceite de oliva" },
      { name: "Empanada de carne cortada a cuchillo", price: 2800, allergens: ["GLUTEN", "EGGS"], description: "Al horno de barro, por unidad", tags: ["casera"] },
      { name: "Chorizo", price: 5500, description: "Con pan y chimichurri" },
      { name: "Morcilla", price: 5000 },
      { name: "Mollejas", price: 16000, description: "Crocantes, con limón" },
      { name: "Chinchulines", price: 9000 },
    ],
  },
  {
    category: "Parrilla",
    products: [
      { name: "Bife de chorizo", price: 24000, description: "400 g", cut: true },
      { name: "Ojo de bife", price: 26000, description: "400 g", cut: true },
      { name: "Vacío", price: 21000, description: "Tierno y jugoso, 400 g", cut: true },
      { name: "Entraña", price: 23000, cut: true },
      { name: "Asado de tira", price: 19500, cut: true },
      { name: "Matambre a la pizza", price: 18000, allergens: ["MILK"], description: "Con salsa de tomate y muzzarella" },
      { name: "Pollo deshuesado", price: 15000 },
      { name: "Parrillada para 2", price: 46000, description: "Asado, vacío, chorizo, morcilla, chinchulines y molleja", tags: ["para compartir"] },
    ],
  },
  {
    category: "Guarniciones",
    products: [
      { name: "Papas fritas", price: 7000 },
      { name: "Papas a la provenzal", price: 8000 },
      { name: "Ensalada mixta", price: 6000, description: "Lechuga, tomate y cebolla", tags: ["vegano"] },
      { name: "Puré de calabaza", price: 6500, allergens: ["MILK"] },
    ],
  },
  {
    category: "Postres",
    products: [
      { name: "Flan casero con dulce de leche", price: 6500, allergens: ["EGGS", "MILK"], tags: ["casero"] },
      { name: "Panqueque con dulce de leche", price: 7000, allergens: ["GLUTEN", "EGGS", "MILK"] },
      { name: "Helado (2 bochas)", price: 6000, allergens: ["MILK"] },
      { name: "Queso y dulce", price: 6000, allergens: ["MILK"], description: "Postre vigilante" },
    ],
  },
  {
    category: "Bebidas",
    products: [
      { name: "Agua sin gas 500 ml", price: 3000, station: "NONE" },
      { name: "Gaseosa 500 ml", price: 3500, station: "NONE" },
      { name: "Limonada con menta y jengibre", price: 5500, station: "BAR", tags: ["vegano"] },
      { name: "Cerveza artesanal (pinta)", price: 6500, station: "BAR", allergens: ["GLUTEN"] },
      { name: "Copa de Malbec", price: 6000, station: "BAR", allergens: ["SULPHITES"] },
      { name: "Malbec (botella)", price: 22000, station: "BAR", allergens: ["SULPHITES"] },
      { name: "Fernet con cola", price: 7500, station: "BAR" },
      { name: "Café", price: 3000, station: "BAR" },
    ],
  },
];

async function main() {
  // 1) Borrar la demo anterior (solo este local y sus usuarios).
  const old = await db.tenant.findUnique({ where: { slug: SLUG }, include: { memberships: true } });
  if (old) {
    const userIds = old.memberships.map((m) => m.userId);
    await db.tenant.delete({ where: { id: old.id } });
    await db.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds }, memberships: { none: {} } } });
  }

  // 2) Local en Argentina, con todos los módulos.
  const lunchDinner: [string, string][] = [
    ["12:30", "15:00"],
    ["20:30", "23:30"],
  ];
  const tenant = await db.tenant.create({
    data: {
      slug: SLUG,
      name: "Parrilla del Litoral",
      settings: {
        create: {
          ...regionSettingsFor("AR"),
          tagline: "Parrilla de barrio, a fuego lento",
          description: "Cortes a la leña, achuras y empanadas de horno de barro. Demo de app-resto.",
          address: "Paraná, Entre Ríos",
          menuTheme: "DARK",
          prepMode: "SEPARATE",
          bookingHours: Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, lunchDinner])),
          bookingDurationMin: 120,
          bookingMaxParty: 10,
          bookingNotice: "Si venís con chicos o necesitás silla alta, avisanos en comentarios.",
        },
      },
      modules: {
        create: (["CARTA_QR", "PEDIDOS", "KDS", "CAJA", "RESERVAS", "BI", "COMPRAS"] as const).map((module) => ({ module })),
      },
    },
  });
  const tenantId = tenant.id;

  // 3) Personal: dueño con email; el resto entra con PIN.
  const ownerPassword = randomBytes(9).toString("base64url");
  const pins = new Set<string>();
  const newPin = () => {
    let p: string;
    do p = String(randomInt(1000, 10000));
    while (pins.has(p));
    pins.add(p);
    return p;
  };
  const staff = [
    { name: "Dueño (demo)", role: "OWNER", extra: [] as string[], email: "demo@parrilla-demo.test" },
    { name: "Sofía", role: "CAJA", extra: ["MOZO"] },
    { name: "Joaquín", role: "MOZO", extra: [] },
    { name: "Valentina", role: "MOZO", extra: [] },
    { name: "Parrillero", role: "COCINA", extra: [] },
    { name: "Barra", role: "BAR", extra: [] },
  ];
  const ownerHash = await bcrypt.hash(ownerPassword, 10);
  const credentials: string[] = [];
  const members: { id: string; name: string; role: string }[] = [];
  for (const s of staff) {
    const pin = s.email ? null : newPin();
    const user = await db.user.create({
      data: {
        name: s.name,
        email: s.email ?? null,
        passwordHash: s.email ? ownerHash : null,
        memberships: {
          create: {
            tenantId,
            role: s.role as never,
            extraRoles: s.extra as never,
            pinHash: pin ? await bcrypt.hash(pin, 10) : null,
          },
        },
      },
      include: { memberships: true },
    });
    members.push({ id: user.memberships[0].id, name: s.name, role: s.role });
    credentials.push(s.email ? `${s.name}: ${s.email} / ${ownerPassword}` : `${s.name} (${[s.role, ...s.extra].join(" + ")}): PIN ${pin}`);
  }
  const waiters = members.filter((m) => m.role === "MOZO" || m.name === "Sofía");

  // 4) Salones y mesas. La vereda queda para quien llega sin reserva.
  const salon = await db.area.create({ data: { tenantId, name: "Salón", width: 22, height: 12, sortOrder: 0 } });
  const vereda = await db.area.create({ data: { tenantId, name: "Vereda", width: 16, height: 6, sortOrder: 1 } });
  const salonTables: [string, number, number, number, number, number, "SQUARE" | "ROUND" | "RECT"][] = [
    ["1", 2, 1, 1, 2, 2, "ROUND"],
    ["2", 4, 5, 1, 2, 2, "SQUARE"],
    ["3", 4, 9, 1, 2, 2, "SQUARE"],
    ["4", 4, 13, 1, 2, 2, "SQUARE"],
    ["5", 6, 17, 1, 4, 2, "RECT"],
    ["6", 4, 1, 5, 2, 2, "SQUARE"],
    ["7", 2, 5, 5, 2, 2, "ROUND"],
    ["8", 4, 9, 5, 2, 2, "SQUARE"],
    ["9", 8, 13, 5, 4, 3, "RECT"],
    ["10", 4, 1, 9, 2, 2, "SQUARE"],
    ["11", 4, 5, 9, 2, 2, "SQUARE"],
    ["12", 2, 9, 9, 2, 2, "ROUND"],
  ];
  const tables = [];
  for (const [number, seats, posX, posY, width, height, shape] of salonTables) {
    tables.push(await db.table.create({ data: { tenantId, areaId: salon.id, number, seats, maxGuests: seats, posX, posY, width, height, shape, qrToken: qr() } }));
  }
  for (const [i, seats] of [2, 4, 4, 2].entries()) {
    await db.table.create({
      data: { tenantId, areaId: vereda.id, number: `V${i + 1}`, seats, maxGuests: seats, posX: 1 + i * 4, posY: 2, qrToken: qr(), onlineBookable: false },
    });
  }

  // 5) Carta: "Punto de la carne" para los cortes.
  const punto = await db.modifierGroup.create({
    data: {
      tenantId,
      name: "Punto de la carne",
      minSelect: 1,
      maxSelect: 1,
      options: { create: ["Jugoso", "A punto", "Cocido"].map((name, sortOrder) => ({ name, sortOrder })) },
    },
  });
  const products: { id: string; name: string; priceCents: number; station: PrepStation; category: string }[] = [];
  for (const [ci, c] of MENU.entries()) {
    const cat = await db.category.create({ data: { tenantId, name: c.category, sortOrder: ci } });
    for (const [pi, p] of c.products.entries()) {
      const created = await db.product.create({
        data: {
          tenantId,
          categoryId: cat.id,
          name: p.name,
          description: p.description ?? null,
          priceCents: $(p.price),
          station: p.station ?? "KITCHEN",
          allergens: p.allergens ?? [],
          tags: p.tags ?? [],
          sortOrder: pi,
          ...(p.cut ? { modifierGroups: { create: { groupId: punto.id } } } : {}),
        },
      });
      products.push({ id: created.id, name: created.name, priceCents: created.priceCents, station: created.station, category: c.category });
    }
  }
  const byCat = (c: string) => products.filter((p) => p.category === c);

  // 6) Ventas de las últimas 3 semanas, hasta hoy (solo cenas que ya pasaron).
  const today = localParts(new Date(), TZ).date;
  const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const methods: PaymentMethod[] = ["CASH", "CARD", "CARD", "MERCADOPAGO", "MERCADOPAGO", "MERCADOPAGO", "TRANSFER"];
  const salesByDay = new Map<string, number>();
  let sessions = 0;
  for (let back = 21; back >= 0; back--) {
    const day = addDays(today, -back);
    const weekend = [5, 6, 0].includes(new Date(`${day}T12:00:00Z`).getUTCDay());
    let dayTotal = 0;
    for (let n = between(weekend ? 9 : 4, weekend ? 14 : 8); n > 0; n--) {
      const table = pick(tables);
      const guests = Math.min(table.seats, between(2, 5));
      const opened = new Date(zonedToUtc(day, `${between(20, 22)}:${pick(["00", "15", "30", "45"])}`, TZ));
      const closed = new Date(opened.getTime() + between(75, 130) * 60_000);
      if (closed > new Date()) continue; // de hoy, solo lo que ya se cobró
      const lines: { p: (typeof products)[number]; q: number }[] = [];
      const add = (p: (typeof products)[number], q = 1) => lines.push({ p, q });
      add(pick(byCat("Entradas")), between(1, 2));
      // Parrillada para 2 (cubre a dos personas) o un plato principal por persona.
      const parrillada = rnd() < 0.25 && guests >= 2;
      if (parrillada) add(byCat("Parrilla").find((p) => p.name === "Parrillada para 2")!, 1);
      const mains = guests - (parrillada ? 2 : 0);
      for (let g = 0; g < mains; g++) add(pick(byCat("Parrilla").filter((p) => p.name !== "Parrillada para 2")));
      add(pick(byCat("Guarniciones")), between(1, 2));
      if (rnd() < 0.5) add(byCat("Bebidas").find((p) => p.name === "Malbec (botella)")!, 1);
      for (let g = 0; g < guests; g++) if (rnd() < 0.7) add(pick(byCat("Bebidas").filter((p) => p.name !== "Malbec (botella)")));
      for (let g = 0; g < guests; g++) if (rnd() < 0.35) add(pick(byCat("Postres")));
      const total = lines.reduce((s, l) => s + l.p.priceCents * l.q, 0);
      const waiter = pick(waiters);
      const session = await db.tableSession.create({
        data: {
          tenantId,
          tableId: table.id,
          waiterId: waiter.id,
          guests,
          status: "CLOSED",
          openedAt: opened,
          closedAt: closed,
          totalCents: total,
          tableLabel: table.number,
          orders: {
            create: {
              tenantId,
              round: 1,
              status: "COMPLETED",
              source: "STAFF",
              createdById: waiter.id,
              acceptedById: waiter.id,
              createdAt: new Date(opened.getTime() + 8 * 60_000),
              acceptedAt: new Date(opened.getTime() + 9 * 60_000),
              items: {
                create: lines.map((l) => {
                  // Tiempos realistas: parrilla 12–35 min, barra 2–8; el mozo tarda 1–6 en llevarlo.
                  const accepted = opened.getTime() + 9 * 60_000;
                  const prep = l.p.station === "KITCHEN" ? between(12, 35) : l.p.station === "BAR" ? between(2, 8) : 0;
                  const readyAt = new Date(accepted + prep * 60_000);
                  return {
                    tenantId,
                    productId: l.p.id,
                    name: l.p.name,
                    unitPriceCents: l.p.priceCents,
                    quantity: l.q,
                    station: l.p.station,
                    status: "DELIVERED" as const,
                    readyAt,
                    deliveredAt: new Date(readyAt.getTime() + between(1, 6) * 60_000),
                  };
                }),
              },
            },
          },
        },
      });
      // A veces pagan entre dos medios (mitad y mitad).
      const split = rnd() < 0.2;
      const tip = rnd() < 0.4 ? roundTo(total * 0.1, $(500)) : 0;
      const parts = split ? [Math.floor(total / 2), total - Math.floor(total / 2)] : [total];
      for (const [i, amountCents] of parts.entries()) {
        await db.payment.create({
          data: {
            tenantId,
            sessionId: session.id,
            method: pick(methods),
            amountCents,
            tipCents: i === 0 ? tip : 0,
            createdById: members.find((m) => m.name === "Sofía")!.id,
            createdAt: closed,
          },
        });
      }
      dayTotal += total;
      sessions++;
    }
    salesByDay.set(day, dayTotal);
  }

  // 7) Compras semanales (~40 % de lo vendido): carne, achuras, carbón, verdulería, bebidas, limpieza.
  const weekStart = (d: string) => addDays(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
  const weeks = new Map<string, number>();
  for (const [d, t] of salesByDay) weeks.set(weekStart(d), (weeks.get(weekStart(d)) ?? 0) + t);
  // Semana actual: las compras se calculan sobre una semana completa (la anterior), no sobre lo que va.
  const current = weekStart(today);
  weeks.set(current, [...weeks.entries()].filter(([w]) => w < current).at(-1)?.[1] ?? $(2_000_000));
  const plan: { item: string; qty: string; supplier: string; category: PurchaseCategory; share: number; offset: number }[] = [
    { item: "Media res y cortes", qty: "", supplier: "Frigorífico Entre Ríos", category: "FOOD", share: 0.22, offset: 0 },
    { item: "Achuras (chorizo, morcilla, chinchulines, mollejas)", qty: "", supplier: "Frigorífico Entre Ríos", category: "FOOD", share: 0.04, offset: 0 },
    { item: "Reposición de carne", qty: "", supplier: "Frigorífico Entre Ríos", category: "FOOD", share: 0.06, offset: 4 },
    { item: "Carbón y leña", qty: "", supplier: "Leñera El Quebracho", category: "SUPPLIES", share: 0.025, offset: 0 },
    { item: "Verdulería", qty: "", supplier: "Mercado de abasto", category: "FOOD", share: 0.03, offset: 1 },
    { item: "Bebidas (agua, gaseosas, cerveza)", qty: "", supplier: "Distribuidora del Litoral", category: "DRINKS", share: 0.05, offset: 2 },
    { item: "Vinos", qty: "", supplier: "Vinoteca mayorista", category: "DRINKS", share: 0.03, offset: 3 },
    { item: "Lácteos, harina y huevos", qty: "", supplier: "Almacén mayorista", category: "FOOD", share: 0.02, offset: 3 },
    { item: "Limpieza y descartables", qty: "", supplier: "Distribuidora del Litoral", category: "SUPPLIES", share: 0.012, offset: 2 },
  ];
  const qtyFor: Record<string, (cents: number) => string> = {
    "Media res y cortes": (c) => `${Math.round(c / $(11000))} kg`,
    "Reposición de carne": (c) => `${Math.round(c / $(12000))} kg`,
    "Carbón y leña": (c) => `${Math.max(2, Math.round(c / $(9000)))} bolsas`,
    "Vinos": (c) => `${Math.max(1, Math.round(c / $(90000)))} cajas`,
  };
  let purchases = 0;
  for (const [start, sales] of weeks) {
    for (const p of plan) {
      const day = addDays(start, p.offset);
      if (day > today) continue;
      const amountCents = roundTo(sales * p.share * (0.9 + rnd() * 0.2), $(100));
      await db.purchase.create({
        data: {
          tenantId,
          date: zonedToUtc(day, "12:00", TZ),
          item: p.item,
          quantity: qtyFor[p.item]?.(amountCents) ?? null,
          supplier: p.supplier,
          category: p.category,
          amountCents,
          createdById: members[0].id,
        },
      });
      purchases++;
    }
  }

  // 8) Un par de reservas para hoy y mañana.
  const booked = [
    { name: "Familia Gómez", party: 6, day: today, time: "21:30", table: "5" },
    { name: "Lucas y Ana", party: 2, day: addDays(today, 1), time: "21:00", table: "1" },
  ];
  for (const b of booked) {
    const t = tables.find((x) => x.number === b.table)!;
    const startsAt = zonedToUtc(b.day, b.time, TZ);
    const endsAt = new Date(startsAt.getTime() + 120 * 60_000);
    if (startsAt < new Date()) continue;
    await db.reservation.create({
      data: {
        tenantId,
        code: randomBytes(9).toString("base64url"),
        source: "STAFF",
        customerName: b.name,
        partySize: b.party,
        startsAt,
        endsAt,
        tables: { create: { tableId: t.id, startsAt, endsAt } },
      },
    });
  }

  writeFileSync(
    ".env.demo-parrilla",
    [
      `# Demo "${tenant.name}" — generado ${new Date().toISOString()}. NO subir (gitignored).`,
      `# Carta: /${SLUG} · Panel: /login · Personal con PIN: /login/pin/${SLUG}`,
      ...credentials.map((c) => `# ${c}`),
      "",
    ].join("\n"),
  );
  console.log(`✔ Demo lista: /${SLUG} · ${products.length} productos · ${sessions} mesas cobradas · ${purchases} compras`);
  console.log("  Claves en .env.demo-parrilla");
}

main().finally(() => db.$disconnect());
