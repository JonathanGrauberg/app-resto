import "server-only";
import { db } from "@/lib/db";

/** Modelos que tienen columna `tenantId` y deben aislarse siempre. */
const TENANT_MODELS = new Set([
  "TenantModule",
  "Membership",
  "Area",
  "Table",
  "TableGroup",
  "TableSession",
  "Category",
  "Product",
  "ModifierGroup",
  "Translation",
  "CartItem",
  "Order",
  "OrderItem",
  "Reservation",
  "Event",
  "Notification",
]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

type AnyArgs = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
};

/**
 * Cliente Prisma acotado a un tenant: agrega `tenantId` a todos los filtros
 * y a todos los datos creados en los modelos multi-tenant.
 *
 * Las relaciones anidadas (include/select/nested writes) no se reescriben:
 * los modelos hijos sin tenantId (ModifierOption, ReservationTable, ...) se
 * acceden siempre a través de su padre, que sí está filtrado.
 */
export function tenantDb(tenantId: string) {
  if (!tenantId) throw new Error("tenantDb: tenantId requerido");

  return db.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const a = (args ?? {}) as AnyArgs;

          if (WHERE_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), tenantId };
          }
          if (operation === "create") {
            a.data = { ...(a.data as object), tenantId };
          }
          if (operation === "createMany" || operation === "createManyAndReturn") {
            const rows = Array.isArray(a.data) ? a.data : [a.data];
            a.data = rows.map((r) => ({ ...(r as object), tenantId }));
          }
          if (operation === "upsert") {
            a.create = { ...(a.create ?? {}), tenantId };
          }
          return query(a);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
