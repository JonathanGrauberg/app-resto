/**
 * Local para la demo con Gunda (Heladería & Pastelería, Paraná): su carta 2026 tal cual la muestran,
 * para presentarles Yatay con sus propios productos. Sin ventas cargadas (el local arranca limpio).
 * Además, una categoría "Helados" OCULTA con ¼, ½ y 1 kg y Gustos, para mostrar esa función si quieren.
 *
 * Idempotente: borra y vuelve a crear SOLO el local `gunda`.
 * Las claves de acceso se generan al correrlo y se guardan en `.env.demo-gunda` (gitignored).
 *
 *   npx tsx --conditions=react-server prisma/seed-gunda.ts
 */
import "dotenv/config";
import { randomBytes, randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import type { Allergen, PrepStation } from "../src/generated/prisma/enums";
import { db } from "../src/lib/db";
import { regionSettingsFor } from "../src/lib/region";

const SLUG = "gunda";
const qr = () => randomBytes(12).toString("base64url");
const $ = (pesos: number) => pesos * 100;

type P = { name: string; price: number; description?: string; allergens?: Allergen[]; temp?: boolean; flavors?: [number, number] };
type Cat = { category: string; station: PrepStation; visible?: boolean; products: P[] };

const MENU: Cat[] = [
  {
    category: "Café",
    station: "BAR",
    products: [
      { name: "Café", price: 3800 },
      { name: "Café doble", price: 4500 },
      { name: "Cortado", price: 4000, allergens: ["MILK"] },
      { name: "Con leche", price: 5000, allergens: ["MILK"] },
      { name: "Signature", price: 6500, allergens: ["MILK"] },
      { name: "Lágrima", price: 4000, allergens: ["MILK"] },
      { name: "Capuchino", price: 4700, allergens: ["MILK"] },
      { name: "Mocha", price: 5700, allergens: ["MILK"] },
      { name: "Submarino", price: 5400, allergens: ["MILK"] },
      { name: "Caramel Macchiato", price: 5700, description: "Frío o caliente", allergens: ["MILK"], temp: true },
      { name: "Capuchino con Nutella", price: 6300, description: "Frío o caliente", allergens: ["MILK", "NUTS"], temp: true },
    ],
  },
  {
    category: "Té en hebras",
    station: "BAR",
    products: [{ name: "Té en hebras", price: 4300, description: "Consultá las variedades del día" }],
  },
  {
    category: "Nuestras crepas",
    station: "KITCHEN",
    products: [
      { name: "Crepa de Nutella", price: 8000, allergens: ["GLUTEN", "EGGS", "MILK", "NUTS"] },
      { name: "Crepa de dulce de leche", price: 6000, allergens: ["GLUTEN", "EGGS", "MILK"] },
      { name: "Crepa de jamón y queso", price: 7000, allergens: ["GLUTEN", "EGGS", "MILK"] },
    ],
  },
  {
    category: "Postres helados",
    station: "BAR",
    products: [
      { name: "Volcán de chocolate", price: 8800, allergens: ["GLUTEN", "EGGS", "MILK"] },
      { name: "Brownie con helado", price: 7500, allergens: ["GLUTEN", "EGGS", "MILK"] },
      { name: "Crumble de manzana con helado", price: 7500, allergens: ["GLUTEN", "MILK"] },
      { name: "Yogurt helado con granola", price: 7700, allergens: ["MILK", "GLUTEN"] },
      { name: "Bloques helados", price: 5500, allergens: ["MILK"] },
      { name: "Medallones helados de menta", price: 4600, allergens: ["MILK"] },
      { name: "Paletas heladas", price: 4600, allergens: ["MILK"] },
      { name: "Alfajor helado de pistacho", price: 6400, allergens: ["MILK", "NUTS", "GLUTEN"] },
    ],
  },
  {
    category: "Saladitos",
    station: "KITCHEN",
    products: [
      { name: "Tostado en pan ciabatta de jamón y queso", price: 7900, allergens: ["GLUTEN", "MILK"] },
      { name: "Tostado en pan ciabatta de queso", price: 7900, allergens: ["GLUTEN", "MILK"] },
      { name: "Tostado en pan de molde caprese", price: 8300, allergens: ["GLUTEN", "MILK"] },
      { name: "Scon clásico", price: 4500, allergens: ["GLUTEN", "MILK", "EGGS"] },
      { name: "Scon relleno", price: 6500, description: "Rúcula, jamón, queso y tomate", allergens: ["GLUTEN", "MILK", "EGGS"] },
      { name: "Panini cuatro quesos", price: 8500, allergens: ["GLUTEN", "MILK"] },
      { name: "Panini caprese", price: 8500, allergens: ["GLUTEN", "MILK"] },
      { name: "Bruschetta de palta", price: 10000, description: "Huevo, palta, tomate y semillas", allergens: ["GLUTEN", "EGGS", "SESAME"] },
      { name: "Medialunas con jamón y queso", price: 3800, allergens: ["GLUTEN", "MILK", "EGGS"] },
      { name: "Croissant con jamón y queso", price: 6800, allergens: ["GLUTEN", "MILK", "EGGS"] },
      { name: "Croissant", price: 4800, allergens: ["GLUTEN", "MILK", "EGGS"] },
      { name: "Chipá", price: 3700, allergens: ["MILK", "EGGS"] },
    ],
  },
  {
    category: "Dulces",
    station: "NONE",
    products: [
      { name: "Porción de budín", price: 3600, description: "Consultá los sabores del día", allergens: ["GLUTEN", "EGGS", "MILK"] },
      { name: "Alfajor de almendra", price: 4600, allergens: ["GLUTEN", "NUTS", "EGGS", "MILK"] },
      { name: "Alfajor de maicena", price: 3600, allergens: ["GLUTEN", "EGGS", "MILK"] },
    ],
  },
  {
    category: "Bebidas",
    station: "BAR",
    products: [
      { name: "Exprimido de naranja", price: 4300 },
      { name: "Jugo multifrutas", price: 4700 },
      { name: "Limonada", price: 5500 },
      { name: "Tropical", price: 5900 },
      { name: "Limonada con frutos rojos", price: 5900 },
      { name: "Pomelada", price: 4500 },
      { name: "Licuado de frutilla", price: 4900, allergens: ["MILK"] },
      { name: "Licuado de banana", price: 4500, allergens: ["MILK"] },
      { name: "Batido helado", price: 6500, allergens: ["MILK"] },
      { name: "Milkshake", price: 7000, allergens: ["MILK"] },
      { name: "Baileys", price: 6900, allergens: ["MILK"] },
      { name: "Gaseosa", price: 3000 },
      { name: "Agua", price: 1500 },
    ],
  },
  {
    // Oculta: para mostrar los gustos si les interesa vender el helado por peso desde la mesa.
    category: "Helados",
    station: "BAR",
    visible: false,
    products: [
      { name: "¼ kg", price: 9000, description: "Hasta 3 gustos", allergens: ["MILK"], flavors: [1, 3] },
      { name: "½ kg", price: 16000, description: "Hasta 3 gustos", allergens: ["MILK"], flavors: [1, 3] },
      { name: "1 kg", price: 29000, description: "Hasta 4 gustos", allergens: ["MILK"], flavors: [1, 4] },
    ],
  },
];

const FLAVORS = [
  "Chocolate",
  "Chocolate amargo",
  "Dulce de leche",
  "Dulce de leche granizado",
  "Crema americana",
  "Vainilla",
  "Sambayón",
  "Frutilla a la crema",
  "Limón",
  "Menta granizada",
  "Pistacho",
  "Mascarpone con frutos rojos",
];

async function main() {
  // 1) Borrar el local anterior (solo este y sus usuarios).
  const old = await db.tenant.findUnique({ where: { slug: SLUG }, include: { memberships: true } });
  if (old) {
    const userIds = old.memberships.map((m) => m.userId);
    await db.tenant.delete({ where: { id: old.id } });
    await db.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds }, memberships: { none: {} } } });
  }

  // 2) Local en Argentina, carta clara, barra aparte (café, bebidas y postres salen del mostrador).
  const trialEnds = new Date();
  trialEnds.setMonth(trialEnds.getMonth() + 3);
  const tenant = await db.tenant.create({
    data: {
      slug: SLUG,
      name: "Gunda",
      settings: {
        create: {
          ...regionSettingsFor("AR"),
          tagline: "Heladería & Pastelería",
          description: "Heladería y pastelería en Paraná: café, crepas, postres helados, saladitos y dulces.",
          address: "Paraná, Entre Ríos",
          phone: "343 611-2205",
          instagramUrl: "https://www.instagram.com/gunda.parana",
          menuTheme: "DARK",
          prepMode: "SEPARATE",
        },
      },
      modules: { create: (["CARTA_QR", "PEDIDOS", "KDS", "CAJA", "BI", "COMPRAS"] as const).map((module) => ({ module })) },
      // La propuesta: 3 meses gratis.
      subscription: { create: { planId: "completo", currency: "ARS", trialEndsAt: trialEnds, notes: "Demo para Gunda: 3 meses gratis si les gusta." } },
    },
  });
  const tenantId = tenant.id;

  // 3) Personal de ejemplo: dueño con email; el resto con PIN.
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
    { name: "Gunda (dueño)", role: "OWNER", extra: [] as string[], email: "demo@gunda-demo.test" },
    { name: "Caja", role: "CAJA", extra: ["MOZO"] },
    { name: "Mozo 1", role: "MOZO", extra: [] },
    { name: "Mozo 2", role: "MOZO", extra: [] },
    { name: "Mostrador", role: "BAR", extra: [] },
    { name: "Cocina", role: "COCINA", extra: [] },
  ];
  const ownerHash = await bcrypt.hash(ownerPassword, 10);
  const credentials: string[] = [];
  for (const s of staff) {
    const pin = s.email ? null : newPin();
    await db.user.create({
      data: {
        name: s.name,
        email: s.email ?? null,
        passwordHash: s.email ? ownerHash : null,
        memberships: {
          create: { tenantId, role: s.role as never, extraRoles: s.extra as never, pinHash: pin ? await bcrypt.hash(pin, 10) : null },
        },
      },
    });
    credentials.push(s.email ? `${s.name}: ${s.email} / ${ownerPassword}` : `${s.name} (${[s.role, ...s.extra].join(" + ")}): PIN ${pin}`);
  }

  // 4) Salón y vereda de ejemplo (se ajustan con ellos).
  const salon = await db.area.create({ data: { tenantId, name: "Salón", width: 20, height: 10, sortOrder: 0 } });
  const vereda = await db.area.create({ data: { tenantId, name: "Vereda", width: 18, height: 6, sortOrder: 1 } });
  for (let i = 0; i < 10; i++) {
    await db.table.create({
      data: { tenantId, areaId: salon.id, number: String(i + 1), seats: i % 3 === 0 ? 2 : 4, maxGuests: i % 3 === 0 ? 2 : 4, posX: 1 + (i % 5) * 4, posY: i < 5 ? 1 : 5, shape: i % 3 === 0 ? "ROUND" : "SQUARE", qrToken: qr() },
    });
  }
  for (let i = 0; i < 4; i++) {
    await db.table.create({
      data: { tenantId, areaId: vereda.id, number: `V${i + 1}`, seats: 2, maxGuests: 3, posX: 1 + i * 4, posY: 2, shape: "ROUND", qrToken: qr(), onlineBookable: false },
    });
  }

  // 5) Opciones: "Temperatura" (frío o caliente) y "Gustos" para los helados por peso.
  const temp = await db.modifierGroup.create({
    data: { tenantId, name: "Temperatura", minSelect: 1, maxSelect: 1, options: { create: ["Caliente", "Frío"].map((name, sortOrder) => ({ name, sortOrder })) } },
  });
  const gustos = await db.modifierGroup.create({
    data: { tenantId, name: "Gustos", minSelect: 1, maxSelect: 3, allowRepeat: true, options: { create: FLAVORS.map((name, sortOrder) => ({ name, sortOrder })) } },
  });

  let count = 0;
  for (const [ci, c] of MENU.entries()) {
    const cat = await db.category.create({ data: { tenantId, name: c.category, sortOrder: ci, visible: c.visible ?? true } });
    for (const [pi, p] of c.products.entries()) {
      const links = [
        ...(p.temp ? [{ groupId: temp.id, sortOrder: 0 }] : []),
        ...(p.flavors ? [{ groupId: gustos.id, sortOrder: 0, minSelect: p.flavors[0], maxSelect: p.flavors[1] }] : []),
      ];
      await db.product.create({
        data: {
          tenantId,
          categoryId: cat.id,
          name: p.name,
          description: p.description ?? null,
          priceCents: $(p.price),
          station: c.station,
          allergens: p.allergens ?? [],
          sortOrder: pi,
          ...(links.length ? { modifierGroups: { create: links } } : {}),
        },
      });
      count++;
    }
  }

  writeFileSync(
    ".env.demo-gunda",
    [
      `# Demo "${tenant.name}" — generado ${new Date().toISOString()}. NO subir (gitignored).`,
      `# Carta: /${SLUG} · Panel: /login · Personal con PIN: /login/pin/${SLUG}`,
      ...credentials.map((c) => `# ${c}`),
      "",
    ].join("\n"),
  );
  console.log(`✔ Local listo: /${SLUG} · ${count} productos (Helados por peso ocultos)`);
  console.log("  Claves en .env.demo-gunda");
}

main().finally(() => db.$disconnect());
