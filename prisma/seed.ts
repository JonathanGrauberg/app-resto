/**
 * Datos de demo para desarrollo local.
 *
 * Credenciales de prueba (SOLO desarrollo):
 *   Plataforma:  admin@app-resto.local  /  demo1234
 *   Dueño:       duena@lacasona.test    /  demo1234
 *   Caja:        caja@lacasona.test     /  demo1234   (PIN 1111)
 *   Mozos:       PIN 2222 (Lucía), 3333 (Mateo)
 *   Cocina:      PIN 4444
 *   Bar:         PIN 5555
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Allergen, PrepStation, Role } from "../src/generated/prisma/enums";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PASSWORD = "demo1234";
const qr = () => randomBytes(12).toString("base64url");
const hash = (s: string) => bcrypt.hash(s, 10);

async function main() {
  // Limpieza total (solo dev). El orden respeta las FK vía cascade del tenant.
  await db.authSession.deleteMany();
  await db.tenant.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await hash(PASSWORD);

  await db.user.create({
    data: { email: "admin@app-resto.local", name: "Admin Plataforma", passwordHash, isPlatformAdmin: true },
  });

  const tenant = await db.tenant.create({
    data: {
      slug: "la-casona",
      name: "La Casona",
      settings: {
        create: {
          tagline: "Cocina de mercado y vermut desde 1987",
          description: "Tapas, raciones y platos de cuchara en el corazón de Madrid.",
          address: "Calle de la Cava Baja, 12 · Madrid",
          phone: "+34 910 000 000",
          instagramUrl: "https://instagram.com/",
          facebookUrl: "https://facebook.com/",
          websiteUrl: "https://example.com/",
          googleReviewUrl: "https://g.page/r/demo/review",
          extraLocales: ["en"],
        },
      },
      modules: {
        create: (["CARTA_QR", "PEDIDOS", "KDS", "CAJA", "RESERVAS", "BI", "MULTI_IDIOMA"] as const).map(
          (module) => ({ module }),
        ),
      },
    },
  });
  const tenantId = tenant.id;

  // ── Personal ──────────────────────────────────────────────
  const staff: { name: string; email?: string; role: Role; pin?: string }[] = [
    { name: "Carmen (dueña)", email: "duena@lacasona.test", role: "OWNER" },
    { name: "Pablo (caja)", email: "caja@lacasona.test", role: "CAJA", pin: "1111" },
    { name: "Lucía", role: "MOZO", pin: "2222" },
    { name: "Mateo", role: "MOZO", pin: "3333" },
    { name: "Cocina", role: "COCINA", pin: "4444" },
    { name: "Barra", role: "BAR", pin: "5555" },
  ];
  for (const s of staff) {
    await db.user.create({
      data: {
        name: s.name,
        email: s.email,
        passwordHash: s.email ? passwordHash : null,
        memberships: {
          create: { tenantId, role: s.role, pinHash: s.pin ? await hash(s.pin) : null },
        },
      },
    });
  }

  // ── Salones y mesas ───────────────────────────────────────
  const salon = await db.area.create({ data: { tenantId, name: "Salón", sortOrder: 0 } });
  const terraza = await db.area.create({ data: { tenantId, name: "Terraza", sortOrder: 1 } });

  const salonTables = [
    { n: "1", seats: 2, x: 1, y: 1, shape: "ROUND" },
    { n: "2", seats: 2, x: 4, y: 1, shape: "ROUND" },
    { n: "3", seats: 4, x: 7, y: 1, shape: "SQUARE" },
    { n: "4", seats: 4, x: 10, y: 1, shape: "SQUARE" },
    { n: "5", seats: 6, x: 1, y: 5, shape: "RECT", w: 4 },
    { n: "6", seats: 4, x: 7, y: 5, shape: "SQUARE" },
    { n: "7", seats: 4, x: 10, y: 5, shape: "SQUARE" },
    { n: "8", seats: 8, x: 14, y: 3, shape: "RECT", w: 4, h: 3 },
  ] as const;
  for (const t of salonTables) {
    await db.table.create({
      data: {
        tenantId,
        areaId: salon.id,
        number: t.n,
        seats: t.seats,
        maxGuests: t.seats,
        shape: t.shape,
        posX: t.x,
        posY: t.y,
        width: "w" in t ? t.w : 2,
        height: "h" in t ? t.h : 2,
        qrToken: qr(),
      },
    });
  }
  for (let i = 0; i < 6; i++) {
    await db.table.create({
      data: {
        tenantId,
        areaId: terraza.id,
        number: `T${i + 1}`,
        seats: 4,
        maxGuests: 4,
        shape: "SQUARE",
        posX: 1 + (i % 3) * 4,
        posY: 1 + Math.floor(i / 3) * 4,
        qrToken: qr(),
      },
    });
  }

  // ── Modificadores ────────────────────────────────────────
  const punto = await db.modifierGroup.create({
    data: {
      tenantId,
      name: "Punto de la carne",
      minSelect: 1,
      maxSelect: 1,
      options: {
        create: [
          { name: "Poco hecha", sortOrder: 0 },
          { name: "Al punto", sortOrder: 1 },
          { name: "Hecha", sortOrder: 2 },
        ],
      },
    },
  });
  const extras = await db.modifierGroup.create({
    data: {
      tenantId,
      name: "Extras",
      minSelect: 0,
      maxSelect: 3,
      options: {
        create: [
          { name: "Huevo frito", extraPriceCents: 150, sortOrder: 0 },
          { name: "Queso manchego", extraPriceCents: 200, sortOrder: 1 },
          { name: "Sin cebolla", sortOrder: 2 },
        ],
      },
    },
  });
  const hielo = await db.modifierGroup.create({
    data: {
      tenantId,
      name: "Servir",
      minSelect: 0,
      maxSelect: 1,
      options: { create: [{ name: "Con hielo" }, { name: "Sin hielo" }, { name: "Con limón" }] },
    },
  });

  // ── Carta ─────────────────────────────────────────────────
  type P = {
    name: string;
    desc: string;
    price: number;
    station?: PrepStation;
    allergens?: Allergen[];
    tags?: string[];
    groups?: string[];
    available?: boolean;
  };
  const carta: { category: string; products: P[] }[] = [
    {
      category: "Para picar",
      products: [
        { name: "Croquetas de jamón ibérico", desc: "Cremosas, 6 unidades.", price: 950, allergens: ["GLUTEN", "MILK", "EGGS"], tags: ["casera"] },
        { name: "Patatas bravas", desc: "Con salsa brava de la casa y alioli.", price: 650, allergens: ["EGGS"], tags: ["picante", "vegetariano"] },
        { name: "Pimientos de Padrón", desc: "Unos pican y otros no.", price: 700, tags: ["vegano"] },
        { name: "Pulpo a la gallega", desc: "Con cachelos, pimentón de la Vera y AOVE.", price: 1850, allergens: ["MOLLUSCS"] },
        { name: "Gambas al ajillo", desc: "En cazuela de barro.", price: 1400, allergens: ["CRUSTACEANS"], available: false },
      ],
    },
    {
      category: "Principales",
      products: [
        { name: "Entrecot de vaca gallega", desc: "300 g, con patatas y pimientos.", price: 2400, groups: [punto.id, extras.id] },
        { name: "Huevos rotos con jamón", desc: "Patata frita, huevo de corral y jamón ibérico.", price: 1300, allergens: ["EGGS"], groups: [extras.id] },
        { name: "Bacalao al pil-pil", desc: "Lomo de bacalao confitado.", price: 1950, allergens: ["FISH"] },
        { name: "Arroz negro", desc: "Con sepia y alioli. Mínimo 2 personas (precio por persona).", price: 1600, allergens: ["MOLLUSCS", "EGGS", "CRUSTACEANS"] },
        { name: "Hamburguesa de la casa", desc: "Ternera, cheddar, cebolla caramelizada, pan brioche.", price: 1450, allergens: ["GLUTEN", "MILK", "EGGS", "SESAME", "MUSTARD"], groups: [punto.id, extras.id] },
      ],
    },
    {
      category: "Postres",
      products: [
        { name: "Tarta de queso", desc: "Horneada, al estilo vasco.", price: 650, allergens: ["MILK", "EGGS", "GLUTEN"], tags: ["casera"] },
        { name: "Torrija caramelizada", desc: "Con helado de vainilla.", price: 600, allergens: ["GLUTEN", "MILK", "EGGS"] },
        { name: "Crema catalana", desc: "Con azúcar quemado al momento.", price: 550, allergens: ["MILK", "EGGS"] },
      ],
    },
    {
      category: "Bebidas",
      products: [
        { name: "Caña", desc: "Cerveza de barril.", price: 250, station: "BAR", allergens: ["GLUTEN"] },
        { name: "Vermut de grifo", desc: "Con naranja y aceituna.", price: 350, station: "BAR", allergens: ["SULPHITES"], groups: [hielo.id] },
        { name: "Copa de Rioja crianza", desc: "D.O.Ca. Rioja.", price: 450, station: "BAR", allergens: ["SULPHITES"] },
        { name: "Agua mineral", desc: "50 cl.", price: 200, station: "BAR" },
        { name: "Refresco", desc: "Cola, naranja o limón.", price: 280, station: "BAR", groups: [hielo.id] },
      ],
    },
    {
      category: "Cócteles",
      products: [
        { name: "Gin tonic", desc: "Ginebra premium y tónica.", price: 900, station: "BAR", groups: [hielo.id] },
        { name: "Sangría (jarra)", desc: "1 litro, para compartir.", price: 1500, station: "BAR", allergens: ["SULPHITES"] },
        { name: "Mojito", desc: "Ron, hierbabuena, lima y azúcar de caña.", price: 850, station: "BAR" },
      ],
    },
  ];

  for (const [ci, c] of carta.entries()) {
    const category = await db.category.create({ data: { tenantId, name: c.category, sortOrder: ci } });
    for (const [pi, p] of c.products.entries()) {
      await db.product.create({
        data: {
          tenantId,
          categoryId: category.id,
          name: p.name,
          description: p.desc,
          priceCents: p.price,
          station: p.station ?? "KITCHEN",
          allergens: p.allergens ?? [],
          tags: p.tags ?? [],
          available: p.available ?? true,
          sortOrder: pi,
          modifierGroups: p.groups
            ? { create: p.groups.map((groupId, i) => ({ groupId, sortOrder: i })) }
            : undefined,
        },
      });
    }
  }

  console.log(`✔ Seed listo: tenant "${tenant.slug}" con ${salonTables.length + 6} mesas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
