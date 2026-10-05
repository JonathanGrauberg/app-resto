# app-resto — Roadmap y arquitectura

> Nombre provisorio. SaaS multi-tenant para restaurantes, bares y restobares. Mercado inicial: España.
> Última actualización: 2026-10-01

---

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Alcance v1 | Todo el documento original (carta, pedidos, mozo, cocina/bar, caja, reservas, BI) |
| Monetización | Por **módulos** activables por tenant. Moneda y pasarela de suscripción: a definir |
| Multi-tenant | **Una base**, `tenantId` en cada tabla |
| URL comensal | Ruta: `dominio.es/{slug-restaurante}` |
| Hosting | **Vercel** (región UE) para el MVP; migración si escala |
| Base de datos | **Neon** (Postgres serverless, región UE) + **Prisma** |
| Imágenes | **Cloudflare R2** (jurisdicción UE) |
| Pedidos simultáneos | **Sesión de mesa compartida** con carrito común en tiempo real; múltiples rondas por sesión |
| Facturación | **Solo pre-cuenta**. Sin facturas ni VeriFactu en v1 |
| Alérgenos | Los 14 obligatorios UE, como campo propio (aparte de atributos), en comidas y bebidas |
| Idiomas | Traductor del navegador + traducciones **opcionales** cargadas por el tenant |
| Responsive | **Mobile-first obligatorio.** Ver dispositivo objetivo por perfil abajo |

### Dispositivo objetivo por perfil

| Perfil | Dispositivo principal | Diseñar para |
|---|---|---|
| Comensal | **Celular** (casi siempre) | 360–430 px, una mano, botones grandes, carga rápida en 4G |
| Mozo | Celular | Igual que el comensal; acciones rápidas y notificaciones visibles |
| Cocina / Bar (KDS) | Tablet o pantalla fija | Horizontal, tipografía grande, legible a distancia |
| Caja | **PC o tablet** | Pantalla ancha, multi-panel (visor de mesas + detalle) |
| Admin tenant | PC (usable en tablet/celular) | Formularios y editor de plano; en celular, edición básica |

Todas las vistas deben funcionar en todos los tamaños. El editor de plano de mesas se optimiza para tablet y PC; en celular queda en modo lectura o edición simple.

## 2. Supuestos (a confirmar)

Estas preguntas quedaron sin respuesta. Avanzamos con estos valores por defecto:

1. **Tiempo real → Pusher Channels (cluster `eu`)** o Ably, detrás de una capa propia `lib/realtime` para poder cambiarlo.
   Vercel no mantiene WebSockets propios, así que hace falta un servicio administrado. Neon y R2 cubren datos e imágenes, no el tiempo real.
2. **Cobro siempre en caja** del local en v1. El pago desde la app (Stripe, Redsys o Bizum) queda para después.
3. **Comandas en pantalla (KDS)**. Las impresoras térmicas quedan para después.
4. El **personal** usa una **PWA** instalable. El comensal entra por web, sin instalar nada.
5. **Login**: email y contraseña para admin y caja; **PIN** de 4 a 6 dígitos para mozo, cocina y bar en dispositivos compartidos.
6. **Modificadores**: incluyen opciones simples ("sin cebolla") y extras con precio ("queso +1,50 €"), con grupos obligatorios u opcionales.
7. **Plano de mesas**: plano visual arrastrable por salón (posición, forma, capacidad), más una vista de lista o kanban por estado.
8. **Reseñas de Google**: se ofrecen una sola vez por sesión, tras el primer pedido, y no en cada ronda.
9. **Reservas**: el comensal reserva desde la web pública, con confirmación automática y aviso por email.
10. **Moneda EUR e IVA incluido** en los precios mostrados (solo para mostrar; no se factura).

---

## 3. Arquitectura

### Stack
- **Next.js** (App Router, Server Components, Server Actions) + **React** + **TypeScript** + **Tailwind CSS**
- **Prisma** + **Neon** (driver serverless `@prisma/adapter-neon`)
- **Auth**: Better Auth o Auth.js, con sesiones en base de datos y soporte de PIN para el personal
- **Tiempo real**: Pusher o Ably (canales privados autenticados por el servidor)
- **Storage**: Cloudflare R2 con URLs prefirmadas, para que las subidas vayan directo del navegador a R2
- **Email**: Resend (confirmaciones de reserva, alta de usuarios)
- **Validación**: Zod · **UI**: shadcn/ui · **Drag & drop**: dnd-kit
- **Observabilidad**: Sentry · **Tests**: Vitest + Playwright
- **Cron**: Vercel Cron (agregados de BI, expiración de reservas)

### Estructura (una sola app Next.js)
```
app/
  (marketing)/              landing del SaaS
  [slug]/                   COMENSAL: portada, carta, buscador
  [slug]/m/[qrToken]/       sesión de mesa (carrito compartido, pedir, llamar mozo)
  [slug]/reservar/          reserva pública
  staff/                    PWA personal: mozo / cocina / bar / caja
  admin/                    ADMIN TENANT: carta, mesas, personal, reservas, BI, ajustes
  platform/                 SUPER ADMIN de la plataforma (tenants, módulos, soporte)
  api/realtime/auth         autorización de canales
lib/
  db.ts                     Prisma con extensión de tenant (inyecta tenantId)
  realtime/                 abstracción del proveedor
  auth/ permissions/        roles + checks de módulos
  modules.ts                feature flags por tenant
```

### Aislamiento multi-tenant
- `tenantId` obligatorio en todas las tablas de negocio, con índices compuestos `(tenantId, …)`.
- **Extensión de Prisma Client** que filtra y completa `tenantId` según la sesión. Ninguna query de negocio se ejecuta sin él.
- Segunda capa de defensa: **Row Level Security** de Postgres. Recomendada antes del piloto con datos reales.
- Tests automáticos que intentan leer datos de otro tenant y deben fallar.

### Módulos (monetización)
Tabla `TenantModule (tenantId, module, enabled, expiresAt)`. Se controla en el servidor (acciones y rutas) y en la UI (menús ocultos).
Módulos iniciales: `CARTA_QR` (base), `PEDIDOS`, `KDS`, `CAJA`, `RESERVAS`, `BI`, `MULTI_IDIOMA`.
La facturación de la suscripción se conecta después y solo cambia estos flags.

### Roles
`PLATFORM_ADMIN` → `OWNER` / `ADMIN` (tenant) → `CAJA` (superusuario operativo: CRUD de mozos, cierra mesas, confirma pedidos; sin acceso a configuración del tenant ni facturación) → `MOZO` → `COCINA` / `BAR`.
El comensal es anónimo y se identifica por la sesión de mesa (cookie firmada + `qrToken`).

### Modelo de datos (borrador)
```
Tenant, TenantModule, User, Membership(role, pin)
Area(salón) ─< Table(número, capacidad, sillas, posición, forma, qrToken, estado)
TableGroup (mesas unidas)
TableSession (mesa(s), mozoId, comensales, abierta/cerrada/cobrada, timestamps)
  ─< Cart / CartItem        (carrito compartido en vivo)
  ─< Order (ronda) ─< OrderItem(producto, modificadores, notas, estado, destino)
Category ─< Product(nombre, desc, precio, imagen, destino: COCINA|BAR, disponible)
  ─< ModifierGroup ─< ModifierOption(precioExtra)
  ProductAllergen (14 alérgenos UE)
  Translation(entidad, campo, idioma, texto)   ← opcional por tenant
Reservation(mesa(s), rango horario, cliente, estado, eventoId)
Event (reserva multi-mesa)
Notification, ActivityLog
TenantSettings(portada, logo, redes CTA, link reseñas Google, horarios)
```
- **Solapamiento de reservas**: constraint de exclusión en Postgres (`btree_gist` + `tstzrange`) por mesa. Así la base garantiza que no haya cruces, aunque lleguen dos reservas a la vez.
- **QR**: token aleatorio no adivinable por mesa (`/lacasona/m/k8Fj2…`), regenerable. No se usa el ID secuencial.
- **Búsqueda**: `pg_trgm` para búsqueda difusa desde 3 caracteres en nombre, descripción y categoría.

### Ciclo de vida de la mesa
```
LIBRE ──escaneo QR / mozo abre──► ABIERTA (sesión activa, rondas de pedidos)
   ▲                                   │ mozo cierra mesa
   │                                   ▼
   └── caja confirma cobro ◄── PENDIENTE_COBRO  (QR bloqueado; popup al comensal: "mesa aún no cerrada")
```

### Flujo de pedido
```
Comensales (carrito compartido en vivo) ─enviar─► PENDIENTE
  ├─ sin mozo asignado → notificación a todos los mozos y a caja
  └─ mozo (o caja) valida ─► ACEPTADO ─► se reparte por destino ─► KDS Cocina / KDS Bar
                                                     ítem LISTO ─► notificación al mozo ─► ENTREGADO
```

---

## 4. Roadmap por fases

### Estado (2026-10-02)
- ✅ **Fase 0** — Fundaciones (en local; falta repo/CI y deploy, a cargo del equipo)
- ✅ **Fase 1** — Configuración del restaurante, con fotos de productos, portada (primera imagen del hero), logo (ícono de pestaña) e imagen para compartir en WhatsApp/redes, en R2 (UE)
- 🟡 **Fase 4** — Caja: cuenta (pre-cuenta) imprimible en térmica de 80 mm con QR al detalle por persona y calculadora para dividir (vigente 24 h tras pagar), "Ver la cuenta" en el celular al pedir cobrar, mesas cobradas hoy con reimpresión, total guardado para métricas. Falta: forma de pago, propinas, descuentos/invitaciones, cierre de turno.
- 🟡 **Fase 3** — Sala en vivo lista: abrir/cerrar mesa, comensales (se puede superar el tope), mozo asignado, juntar/separar mesas ("3+4"), mesas extra temporales ("2+X1", se retiran solas al cobrar), QR por mesa en pantalla, pendiente de cobro → caja confirma. Pedidos con aceptar/rechazar del mozo y avisos en vivo con sonido. Faltan pantallas de cocina/bar (KDS), "plato listo" y pedido cargado por el mozo.
- ✅ **Fase 2** — Comensal: se une a la mesa por QR (con apodo), carrito compartido en vivo con quién pidió qué, rondas de pedido, llamar al mozo, invitación a reseña en Google. Tiempo real con Ably (avisos con sonido al personal).

Todo entra en la v1. Las fases siguen el **orden de dependencias**: cada una deja algo funcional y desplegado.

### Fase 0 — Fundaciones (≈1–2 semanas)
- Repositorio, Next.js + TS + Tailwind, lint/format, CI, deploy en Vercel (región UE)
- Neon (UE) + Prisma, migraciones, seed de un tenant demo
- Auth (email + PIN), roles, membresías, extensión de tenant y tests de aislamiento
- Sistema de módulos (feature flags) y panel mínimo `platform/` para crear tenants
- Base del design system (shadcn/ui), layout de admin y staff
- **Entregable:** alta de un restaurante y login de su personal por rol.

### Fase 1 — Configuración del restaurante (≈2 semanas)
- Ajustes: portada, logo, CTAs (Instagram, Facebook, web), link de reseñas Google, horarios
- Carta: categorías, productos, modificadores, **alérgenos**, destino cocina/bar, disponibilidad, orden por drag & drop
- Subida de imágenes a R2 (prefirmadas, redimensionado)
- Traducciones opcionales por idioma
- Salones y mesas: **editor de plano arrastrable**, capacidad y sillas
- Generación e impresión de QR por mesa (PDF)
- Gestión de personal (CRUD + PIN)
- **Entregable:** un restaurante configurado de punta a punta.

### Fase 2 — Experiencia del comensal (≈2 semanas)
- Portada + carta pública mobile-first, rápida, preparada para el traductor del navegador (`lang`, texto real, sin texto en imágenes)
- Buscador difuso (`pg_trgm`) + filtros por categoría y alérgenos
- Ficha de producto con modificadores y notas
- Sesión de mesa por QR + **carrito compartido en tiempo real**
- Enviar pedido (sin mostrar total), varias rondas, botón **llamar mozo**
- Redirección a reseñas de Google (una vez por sesión)
- **Entregable:** el comensal pide desde el móvil (todavía sin operación en sala).

### Fase 3 — Operación en sala: mozo + cocina/bar (≈2–3 semanas)
- Integración de tiempo real (canales por tenant, mesa y rol)
- **Visor de mesas**: estados libre/ocupada/pendiente de cobro/reservada, mozo, comensales
- **Dashboard del mozo**: sus mesas, mesas sin asignar con pedidos, asignarse una mesa (un solo mozo por mesa), transferir mesa
- Validar, editar o rechazar pedidos; **crear pedido manual** para la mesa
- **Juntar y separar mesas**
- **KDS Cocina / KDS Bar** con estados por ítem y "plato listo"
- Notificaciones: pedido sin mozo, pedido aceptado, plato listo, llamada de mozo (+ sonido; push PWA opcional)
- **Entregable:** servicio completo en sala sin cobro.

### Fase 4 — Caja (≈1–2 semanas)
- Vista de caja con permisos de superusuario operativo
- **Pre-cuenta** por mesa (detalle, imprimible o PDF)
- Cierre de mesa por el mozo → pendiente de confirmación de cobro → caja confirma → mesa libre y QR reactivado
- Popup al comensal mientras la mesa no está cerrada
- Caja: CRUD de mozos, confirmar pedidos, resumen del turno
- **Entregable:** ciclo de mesa cerrado. **Hito: listo para piloto en un local real.**

### Fase 5 — Reservas (≈2 semanas)
- Configuración: días, franjas, duración por reserva, tolerancia de espera, antelación
- Reserva pública con disponibilidad en tiempo real y **confirmación automática**
- Anti-solapamiento garantizado por la base de datos
- Marca de reserva sobre la mesa en el visor; liberación automática al vencer la tolerancia (cron)
- Reservas manuales desde admin y **eventos multi-mesa**
- Email de confirmación y cancelación (Resend); datos mínimos + consentimiento RGPD
- **Entregable:** módulo de reservas activable.

### Fase 6 — BI (≈1–2 semanas)
- Métricas por mesa: tiempo de estadía, rotación, tiempo ociosa, facturación (según pre-cuentas)
- Extras: por producto, por mozo, por franja horaria, tiempos de cocina
- Agregados diarios por cron + filtros por fecha + exportación a CSV
- **Entregable:** módulo de BI activable.

### Fase 7 — Piloto y endurecimiento (≈2 semanas, en paralelo desde la Fase 4)
- RGPD: política de privacidad, aviso de cookies (solo técnicas si es posible), DPA con proveedores, retención de datos de reservas
- PWA del personal (instalable, reconexión de tiempo real, manejo de cortes de red)
- Sentry, logs, rate limiting en endpoints públicos (QR, reservas)
- Tests e2e de los flujos críticos y prueba de carga del tiempo real
- Onboarding guiado para nuevos restaurantes
- **Entregable: v1 en producción.**

**Total estimado: ~13–17 semanas** con 1–2 desarrolladores. Se ajusta cuando definamos el equipo.

---

## 5. Después de la v1 (backlog)

| Prioridad | Ítem |
|---|---|
| Alta | Suscripciones y cobro del SaaS por módulos (Stripe Billing u otra pasarela) |
| Alta | Pago desde la app (Stripe / Redsys / Bizum), propinas, dividir la cuenta |
| Media | Impresión de comandas en impresoras térmicas (ESC/POS vía agente local o impresoras cloud) |
| Media | Integración con TPV existentes y/o facturación **VeriFactu** |
| Media | Multi-local (cadenas bajo un mismo owner) |
| Media | Cartas por horario / menú del día |
| Baja | Reservar con Google / TheFork, recordatorios por SMS o WhatsApp, señal anti no-show |
| Baja | Dominio propio por restaurante, traducción automática |
| Media | Limpieza periódica de fotos huérfanas en R2 (subidas y nunca guardadas) + dominio propio para imágenes con caché |
| — | Migración de infraestructura si el volumen lo justifica |

### Ideas para charlar (propuestas del equipo, 2026-10-02)
- **Calculadora / "¿Dividir?" para el mozo**: al ver el total de la mesa, botón para dividir en partes iguales ("¿cuánto es cada uno?").
- **División por consumo** (opcional, nunca obligatoria; siempre queda la opción simple):
  - Cada comensal marca lo que consumió (o pide desde su propio celular y queda a su nombre).
  - Elegir qué se divide entre todos (ej. vino, entrantes) y qué entre algunos.
  - Resultado: cuánto paga cada uno.
  - Se apoya en el campo `addedBy` del carrito compartido (Fase 2), así que conviene diseñarlo junto con los pedidos.

## 6. Pendiente de definir
- Proveedor de tiempo real (supuesto: Pusher `eu`)
- Pago desde la app sí o no en v1 (supuesto: no)
- Impresoras de cocina (supuesto: no en v1)
- Moneda y pasarela de suscripción, precios por módulo
- Nombre, dominio y branding
- Equipo y fecha objetivo del piloto
