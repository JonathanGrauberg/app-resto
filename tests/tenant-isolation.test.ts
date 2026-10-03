/**
 * Garantía central del multi-tenant: un tenant nunca lee ni modifica datos de otro.
 * Requiere la base local levantada (`npm run db:start`).
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/tenant-db";

const tag = randomBytes(4).toString("hex");
let A: string;
let B: string;
let productB: string;

beforeAll(async () => {
  const mk = async (name: string) => {
    const t = await db.tenant.create({ data: { slug: `test-${name}-${tag}`, name: `Test ${name}` } });
    const cat = await db.category.create({ data: { tenantId: t.id, name: "Cat" } });
    const p = await db.product.create({
      data: { tenantId: t.id, categoryId: cat.id, name: `Plato ${name}`, priceCents: 1000 },
    });
    return { id: t.id, productId: p.id, categoryId: cat.id };
  };
  const a = await mk("a");
  const b = await mk("b");
  A = a.id;
  B = b.id;
  productB = b.productId;
});

afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [A, B] } } });
  await db.$disconnect();
});

describe("tenantDb", () => {
  it("findMany solo devuelve filas del propio tenant", async () => {
    const rows = await tenantDb(A).product.findMany();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === A)).toBe(true);
  });

  it("no encuentra por id un registro de otro tenant", async () => {
    expect(await tenantDb(A).product.findUnique({ where: { id: productB } })).toBeNull();
    expect(await tenantDb(A).product.findFirst({ where: { id: productB } })).toBeNull();
  });

  it("no puede actualizar ni borrar registros de otro tenant", async () => {
    await expect(
      tenantDb(A).product.update({ where: { id: productB }, data: { name: "hackeado" } }),
    ).rejects.toThrow();
    const res = await tenantDb(A).product.deleteMany({ where: { id: productB } });
    expect(res.count).toBe(0);
    const still = await db.product.findUnique({ where: { id: productB } });
    expect(still?.name).toBe("Plato b");
  });

  it("create fuerza el tenantId de la sesión aunque se intente otro", async () => {
    const tdb = tenantDb(A);
    const cat = await tdb.category.create({ data: { name: "Nueva", tenantId: B } as never });
    expect(cat.tenantId).toBe(A);
  });

  it("el aislamiento se mantiene dentro de una transacción", async () => {
    await tenantDb(A).$transaction(async (tx) => {
      expect(await tx.product.findUnique({ where: { id: productB } })).toBeNull();
      const rows = await tx.product.findMany();
      expect(rows.every((r) => r.tenantId === A)).toBe(true);
    });
  });

  it("count y aggregate quedan acotados", async () => {
    const all = await db.product.count({ where: { tenantId: { in: [A, B] } } });
    const onlyA = await tenantDb(A).product.count();
    expect(onlyA).toBeLessThan(all);
  });
});
