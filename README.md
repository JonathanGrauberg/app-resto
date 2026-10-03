# app-resto

SaaS multi-tenant para restaurantes, bares y restobares (mercado inicial: España).
Carta QR, pedidos, sala, cocina/bar, caja, reservas y métricas. Nombre provisorio.

Roadmap y arquitectura: [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Prisma 7 · PostgreSQL · Zod · Vitest

## Desarrollo local

Requisitos: Node 20.9+ (probado con Node 24).

```bash
npm install
npm run db:start      # Postgres local aislado (prisma dev), no usa ninguna base existente
npm run db:migrate    # aplica migraciones
npm run db:seed       # carga el local de demo "La Casona"
npx next dev -p 3100  # http://localhost:3100
```

> El puerto 3000 suele estar ocupado por otro proyecto: usamos el 3100.
> Si cambiás `prisma/schema.prisma`, reiniciá el servidor de desarrollo
> (el cliente de Prisma queda en memoria entre recargas).

Credenciales de prueba: ver el encabezado de [prisma/seed.ts](prisma/seed.ts).

| URL | Qué es |
| --- | --- |
| `/la-casona` | Carta pública |
| `/la-casona/m/<qr>` | Carta desde el QR de una mesa (enlaces en Admin → Mesas) |
| `/login` | Panel (dueño, admin, caja) |
| `/login/pin/la-casona` | Personal con PIN (mozo, cocina, bar) |
| `/platform` | Panel de la plataforma (alta de locales y módulos) |

## Scripts

| Script | |
| --- | --- |
| `npm test` | Tests (incluye aislamiento entre tenants; requiere la base levantada) |
| `npm run typecheck` / `npm run lint` | Verificación estática |
| `npm run db:studio` | Explorar la base |
| `npm run db:reset` | Borra y recrea la base local |

## Reglas del proyecto

- **Multi-tenant**: toda consulta de negocio usa `tenantDb(tenantId)` (`src/lib/tenant-db.ts`), que fuerza el `tenantId`. El cliente `db` crudo solo para auth, plataforma y resolución por slug.
- **Autorización** en cada página y Server Action (`src/lib/auth/guards.ts`); el `proxy.ts` es solo un chequeo optimista.
- **Formularios**: `useFormAction` (`src/lib/use-form-action.ts`) para no perder lo escrito si falla la validación.
- **Imágenes**: siempre con degradado hacia el fondo (`MockImage` / `FadedImage`), negro en oscuro y blanco en claro.
