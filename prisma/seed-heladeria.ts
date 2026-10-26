/**
 * Local de demo: heladería con cafetería (Paraná) para mostrar a clientes.
 * Helados por bocha y por peso con "Gustos" (se pueden repetir; cada tamaño define cuántos),
 * cafetería, copas y algo salado. Mesas en salón y vereda, personal y ~3 semanas de ventas y compras.
 *
 * Idempotente: borra y vuelve a crear SOLO el local `heladeria-demo`.
 * Las claves de acceso se generan al correrlo y se guardan en `.env.demo-heladeria` (gitignored).
 *
 *   npx tsx --conditions=react-server prisma/seed-heladeria.ts
 */
import "dotenv/config";
import { randomBytes, randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import type { Allergen, PaymentMethod, PrepStation, PurchaseCategory } from "../src/generated/prisma/enums";
import { localParts, zonedToUtc } from "../src/lib/booking";
import { db } from "../src/lib/db";
import { regionSettingsFor } from "../src/lib/region";

const SLUG = "heladeria-demo";
const TZ = "America/Argentina/Buenos_Aires";
const qr = () => randomBytes(12).toString("base64url");
const $ = (pesos: number) => pesos * 100;

// Números pseudoaleatorios estables: la demo sale igual cada vez.
let seed = 20261026;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const roundTo = (cents: number, step: number) => Math.round(cents / step) * step;

const FLAVORS = [
  "Chocolate",
  "Chocolate amargo",
  "Chocolate suizo",
  "Dulce de leche",
  "Dulce de leche granizado",
  "Super dulce de leche",
  "Crema americana",
  "Vainilla",
  "Granizado",
  "Sambayón",
  "Tramontana",
  "Crema del cielo",
  "Frutilla a la crema",
  "Frutilla al agua",
  "Limón",
  "Durazno",
  "Banana split",
  "Menta granizada",
  "Mascarpone con frutos rojos",
  "Pistacho",
  "Coco",
  "Mousse de maracuyá",
];

/** `flavors`: [mínimo, máximo] de gustos para ese tamaño. */
type P = {
  name: string;
  price: number;
  station?: PrepStation;
  allergens?: Allergen[];
  description?: string;
  tags?: string[];
  flavors?: [number, number];
  toppings?: boolean;
  milk?: boolean;
};
const MENU: { category: string; products: P[] }[] = [
  {
    category: "Helados",
    products: [
      { name: "Cucurucho 1 bocha", price: 3800, station: "BAR", allergens: ["MILK", "GLUTEN"], flavors: [1, 1], toppings: true },
      { name: "Cucurucho 2 bochas", price: 5200, station: "BAR", allergens: ["MILK", "GLUTEN"], flavors: [1, 2], toppings: true },
      { name: "Vasito 2 bochas", price: 5000, station: "BAR", allergens: ["MILK"], flavors: [1, 2], toppings: true },
      { name: "¼ kg", price: 8500, station: "BAR", allergens: ["MILK"], description: "Hasta 3 gustos", flavors: [1, 3] },
      { name: "½ kg", price: 15000, station: "BAR", allergens: ["MILK"], description: "Hasta 3 gustos", flavors: [1, 3], tags: ["para compartir"] },
      { name: "1 kg", price: 27000, station: "BAR", allergens: ["MILK"], description: "Hasta 4 gustos", flavors: [1, 4], tags: ["para compartir"] },
    ],
  },
  {
    category: "Copas y postres",
    products: [
      { name: "Copa de la casa", price: 9500, station: "BAR", allergens: ["MILK", "NUTS"], description: "3 gustos, crema, salsa y almendras", flavors: [3, 3] },
      { name: "Banana split", price: 10500, station: "BAR", allergens: ["MILK"], description: "Banana, 3 bochas, crema y salsa de chocolate", flavors: [3, 3] },
      { name: "Sundae", price: 7500, station: "BAR", allergens: ["MILK"], description: "2 bochas de crema americana con salsa a elección", toppings: true },
      { name: "Almendrado (porción)", price: 6500, station: "BAR", allergens: ["MILK", "NUTS", "EGGS"] },
      { name: "Bombón escocés", price: 6000, station: "BAR", allergens: ["MILK"] },
    ],
  },
  {
    category: "Cafetería",
    products: [
      { name: "Café", price: 3200, station: "BAR", milk: true },
      { name: "Cortado", price: 3400, station: "BAR", allergens: ["MILK"], milk: true },
      { name: "Café con leche", price: 3800, station: "BAR", allergens: ["MILK"], milk: true },
      { name: "Capuccino", price: 4800, station: "BAR", allergens: ["MILK"], milk: true },
      { name: "Submarino", price: 5200, station: "BAR", allergens: ["MILK"] },
      { name: "Affogato", price: 5500, station: "BAR", allergens: ["MILK"], description: "Espresso sobre una bocha de crema americana" },
      { name: "Medialuna", price: 1300, station: "NONE", allergens: ["GLUTEN", "EGGS", "MILK"], description: "De manteca o de grasa" },
    ],
  },
  {
    category: "Frío",
    products: [
      { name: "Milkshake", price: 7500, station: "BAR", allergens: ["MILK"], flavors: [1, 2] },
      { name: "Licuado de frutilla o banana", price: 6000, station: "BAR", allergens: ["MILK"] },
      { name: "Limonada", price: 5000, station: "BAR", tags: ["vegano"] },
      { name: "Agua sin gas 500 ml", price: 2800, station: "NONE" },
      { name: "Gaseosa 500 ml", price: 3300, station: "NONE" },
    ],
  },
  {
    category: "Salado",
    products: [
      { name: "Tostado de jamón y queso", price: 8500, allergens: ["GLUTEN", "MILK"] },
      { name: "Sándwich de miga (x3)", price: 6500, allergens: ["GLUTEN", "MILK", "EGGS"] },
      { name: "Tostadas con queso y mermelada", price: 5500, allergens: ["GLUTEN", "MILK"] },
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

  // 2) Local en Argentina. Carta clara (cafetería) y barra aparte: helados y café salen del mostrador.
  const tenant = await db.tenant.create({
    data: {
      slug: SLUG,
      name: "Heladería del Río",
      settings: {
        create: {
          ...regionSettingsFor("AR"),
          tagline: "Helado artesanal y café, frente al río",
          description: "Helado artesanal por bocha y por kilo, cafetería y algo salado. Demo de Yatay.",
          address: "Paraná, Entre Ríos",
          menuTheme: "DARK",
          prepMode: "SEPARATE",
        },
      },
      modules: { create: (["CARTA_QR", "PEDIDOS", "KDS", "CAJA", "BI", "COMPRAS"] as const).map((module) => ({ module })) },
      // Demo: sin cargo.
      subscription: { create: { planId: "salon", currency: "ARS", priceCents: 0 } },
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
    { name: "Dueño (demo)", role: "OWNER", extra: [] as string[], email: "demo@heladeria-demo.test" },
    { name: "Caja", role: "CAJA", extra: ["MOZO"] },
    { name: "Micaela", role: "MOZO", extra: [] },
    { name: "Tomás", role: "MOZO", extra: [] },
    { name: "Mostrador", role: "BAR", extra: [] },
    { name: "Cocina", role: "COCINA", extra: [] },
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
          create: { tenantId, role: s.role as never, extraRoles: s.extra as never, pinHash: pin ? await bcrypt.hash(pin, 10) : null },
        },
      },
      include: { memberships: true },
    });
    members.push({ id: user.memberships[0].id, name: s.name, role: s.role });
    credentials.push(s.email ? `${s.name}: ${s.email} / ${ownerPassword}` : `${s.name} (${[s.role, ...s.extra].join(" + ")}): PIN ${pin}`);
  }
  const waiters = members.filter((m) => m.role === "MOZO" || m.name === "Caja");
  const cashier = members.find((m) => m.name === "Caja")!;

  // 4) Salón y vereda (en verano se llena la vereda).
  const salon = await db.area.create({ data: { tenantId, name: "Salón", width: 20, height: 10, sortOrder: 0 } });
  const vereda = await db.area.create({ data: { tenantId, name: "Vereda", width: 18, height: 6, sortOrder: 1 } });
  const tables = [];
  for (let i = 0; i < 10; i++) {
    tables.push(
      await db.table.create({
        data: { tenantId, areaId: salon.id, number: String(i + 1), seats: i % 3 === 0 ? 2 : 4, maxGuests: i % 3 === 0 ? 2 : 4, posX: 1 + (i % 5) * 4, posY: i < 5 ? 1 : 5, shape: i % 3 === 0 ? "ROUND" : "SQUARE", qrToken: qr() },
      }),
    );
  }
  for (let i = 0; i < 6; i++) {
    tables.push(
      await db.table.create({
        data: { tenantId, areaId: vereda.id, number: `V${i + 1}`, seats: 2, maxGuests: 3, posX: 1 + i * 3, posY: 2, shape: "ROUND", qrToken: qr(), onlineBookable: false },
      }),
    );
  }

  // 5) Grupos compartidos: Gustos (se repiten, cada tamaño dice cuántos), Salsa y Leche.
  const gustos = await db.modifierGroup.create({
    data: { tenantId, name: "Gustos", minSelect: 1, maxSelect: 3, allowRepeat: true, options: { create: FLAVORS.map((name, sortOrder) => ({ name, sortOrder })) } },
    include: { options: true },
  });
  // Un gusto agotado para mostrar "Sin stock".
  await db.modifierOption.updateMany({ where: { groupId: gustos.id, name: "Pistacho" }, data: { available: false } });
  const salsa = await db.modifierGroup.create({
    data: {
      tenantId,
      name: "Salsa",
      minSelect: 0,
      maxSelect: 1,
      options: { create: [["Dulce de leche", 600], ["Chocolate", 600], ["Frutilla", 600]].map(([name, p], sortOrder) => ({ name: name as string, extraPriceCents: $(p as number), sortOrder })) },
    },
  });
  const leche = await db.modifierGroup.create({
    data: {
      tenantId,
      name: "Leche",
      minSelect: 0,
      maxSelect: 1,
      options: { create: [["Entera", 0], ["Descremada", 0], ["De almendras", 900]].map(([name, p], sortOrder) => ({ name: name as string, extraPriceCents: $(p as number), sortOrder })) },
    },
  });

  type Prod = { id: string; name: string; priceCents: number; station: PrepStation; category: string; flavors?: [number, number] };
  const products: Prod[] = [];
  for (const [ci, c] of MENU.entries()) {
    const cat = await db.category.create({ data: { tenantId, name: c.category, sortOrder: ci } });
    for (const [pi, p] of c.products.entries()) {
      const links = [
        ...(p.flavors ? [{ groupId: gustos.id, sortOrder: 0, minSelect: p.flavors[0], maxSelect: p.flavors[1] }] : []),
        ...(p.toppings ? [{ groupId: salsa.id, sortOrder: 1 }] : []),
        ...(p.milk ? [{ groupId: leche.id, sortOrder: 2 }] : []),
      ];
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
          ...(links.length ? { modifierGroups: { create: links } } : {}),
        },
      });
      products.push({ id: created.id, name: created.name, priceCents: created.priceCents, station: created.station, category: c.category, flavors: p.flavors });
    }
  }
  const byCat = (c: string) => products.filter((p) => p.category === c);
  const available = gustos.options.filter((o) => o.name !== "Pistacho");
  const flavorMods = (range: [number, number]) =>
    Array.from({ length: between(range[0], range[1]) }, () => pick(available)).map((o) => ({
      groupId: gustos.id,
      groupName: "Gustos",
      optionId: o.id,
      name: o.name,
      extraPriceCents: 0,
    }));

  // 6) Ventas de las últimas 3 semanas: tarde y noche, más los fines de semana.
  const today = localParts(new Date(), TZ).date;
  const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const methods: PaymentMethod[] = ["CASH", "CARD", "MERCADOPAGO", "MERCADOPAGO", "MERCADOPAGO", "TRANSFER"];
  const salesByDay = new Map<string, number>();
  let sessions = 0;
  for (let back = 21; back >= 0; back--) {
    const day = addDays(today, -back);
    const weekend = [5, 6, 0].includes(new Date(`${day}T12:00:00Z`).getUTCDay());
    let dayTotal = 0;
    for (let n = between(weekend ? 14 : 7, weekend ? 22 : 12); n > 0; n--) {
      const table = pick(tables);
      const guests = Math.min(table.maxGuests, between(1, 4));
      const opened = new Date(zonedToUtc(day, `${between(15, 23)}:${pick(["00", "15", "30", "45"])}`, TZ));
      const closed = new Date(opened.getTime() + between(25, 70) * 60_000);
      if (closed > new Date()) continue;
      const lines: { p: Prod; q: number; mods: ReturnType<typeof flavorMods> }[] = [];
      const add = (p: Prod) => lines.push({ p, q: 1, mods: p.flavors ? flavorMods(p.flavors) : [] });
      const afternoon = opened.getUTCHours() - 3 < 19;
      for (let g = 0; g < guests; g++) {
        if (afternoon && rnd() < 0.45) {
          add(pick(byCat("Cafetería")));
          if (rnd() < 0.5) add(byCat("Cafetería").find((p) => p.name === "Medialuna")!);
        } else add(pick(byCat("Helados").filter((p) => !p.name.includes("kg"))));
        if (rnd() < 0.15) add(pick(byCat("Copas y postres")));
        if (rnd() < 0.2) add(pick(byCat("Frío")));
        if (afternoon && rnd() < 0.12) add(pick(byCat("Salado")));
      }
      if (guests >= 3 && rnd() < 0.3) add(pick(byCat("Helados").filter((p) => p.name.includes("kg"))));
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
              createdAt: new Date(opened.getTime() + 4 * 60_000),
              acceptedAt: new Date(opened.getTime() + 5 * 60_000),
              items: {
                create: lines.map((l) => {
                  // Mostrador 2–7 min, cocina (tostados) 6–15; el mozo tarda 1–4 en llevarlo.
                  const accepted = opened.getTime() + 5 * 60_000;
                  const prep = l.p.station === "KITCHEN" ? between(6, 15) : l.p.station === "BAR" ? between(2, 7) : 0;
                  const readyAt = new Date(accepted + prep * 60_000);
                  return {
                    tenantId,
                    productId: l.p.id,
                    name: l.p.name,
                    unitPriceCents: l.p.priceCents,
                    quantity: l.q,
                    station: l.p.station,
                    modifiers: l.mods,
                    status: "DELIVERED" as const,
                    readyAt,
                    deliveredAt: new Date(readyAt.getTime() + between(1, 4) * 60_000),
                  };
                }),
              },
            },
          },
        },
      });
      await db.payment.create({
        data: { tenantId, sessionId: session.id, method: pick(methods), amountCents: total, tipCents: rnd() < 0.25 ? roundTo(total * 0.1, $(100)) : 0, createdById: cashier.id, createdAt: closed },
      });
      dayTotal += total;
      sessions++;
    }
    salesByDay.set(day, dayTotal);
  }

  // 7) Compras semanales (~35 % de lo vendido): materia prima del helado, café, cucuruchos y envases, panadería.
  const weekStart = (d: string) => addDays(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
  const weeks = new Map<string, number>();
  for (const [d, t] of salesByDay) weeks.set(weekStart(d), (weeks.get(weekStart(d)) ?? 0) + t);
  const current = weekStart(today);
  weeks.set(current, [...weeks.entries()].filter(([w]) => w < current).at(-1)?.[1] ?? $(1_500_000));
  const plan: { item: string; supplier: string; category: PurchaseCategory; share: number; offset: number }[] = [
    { item: "Leche y crema", supplier: "Usina láctea", category: "FOOD", share: 0.1, offset: 0 },
    { item: "Azúcar, cacao y dulce de leche", supplier: "Almacén mayorista", category: "FOOD", share: 0.06, offset: 1 },
    { item: "Frutas", supplier: "Mercado de abasto", category: "FOOD", share: 0.03, offset: 2 },
    { item: "Café en grano", supplier: "Tostadero del Litoral", category: "DRINKS", share: 0.03, offset: 3 },
    { item: "Cucuruchos, vasitos y potes", supplier: "Distribuidora de descartables", category: "SUPPLIES", share: 0.04, offset: 0 },
    { item: "Medialunas y panificados", supplier: "Panadería del barrio", category: "FOOD", share: 0.025, offset: 4 },
    { item: "Bebidas", supplier: "Distribuidora del Litoral", category: "DRINKS", share: 0.02, offset: 2 },
    { item: "Limpieza", supplier: "Distribuidora de descartables", category: "SUPPLIES", share: 0.01, offset: 3 },
  ];
  let purchases = 0;
  for (const [start, sales] of weeks) {
    for (const p of plan) {
      const day = addDays(start, p.offset);
      if (day > today) continue;
      await db.purchase.create({
        data: {
          tenantId,
          date: zonedToUtc(day, "11:00", TZ),
          item: p.item,
          supplier: p.supplier,
          category: p.category,
          amountCents: roundTo(sales * p.share * (0.9 + rnd() * 0.2), $(100)),
          createdById: members[0].id,
        },
      });
      purchases++;
    }
  }

  writeFileSync(
    ".env.demo-heladeria",
    [
      `# Demo "${tenant.name}" — generado ${new Date().toISOString()}. NO subir (gitignored).`,
      `# Carta: /${SLUG} · Panel: /login · Personal con PIN: /login/pin/${SLUG}`,
      ...credentials.map((c) => `# ${c}`),
      "",
    ].join("\n"),
  );
  console.log(`✔ Demo lista: /${SLUG} · ${products.length} productos · ${sessions} mesas cobradas · ${purchases} compras`);
  console.log("  Claves en .env.demo-heladeria");
}

main().finally(() => db.$disconnect());
