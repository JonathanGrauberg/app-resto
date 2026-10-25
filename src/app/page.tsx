import Link from "next/link";
import { BookOpenText, CalendarCheck, ChefHat, LayoutGrid, LogIn, MessagesSquare, QrCode, ShoppingBasket, Wallet } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ButtonLink } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

/** Carta de ejemplo para mostrar (local demo de Argentina). */
const DEMO_SLUG = "parrilla-demo";

const FEATURES = [
  { icon: QrCode, title: "Carta QR", text: "Con fotos, precios al día y sin imprimir nada. Cada mesa tiene su QR." },
  { icon: BookOpenText, title: "Pedidos desde la mesa", text: "El cliente pide desde el celular y el pedido llega directo." },
  { icon: LayoutGrid, title: "Sala y mozos", text: "Mesas en vivo: quién está, qué pidió, quién la atiende y quién llamó." },
  { icon: ChefHat, title: "Cocina y barra", text: "Cada pedido en pantalla, por orden de llegada y con aviso de listo." },
  { icon: Wallet, title: "Caja", text: "Cuentas por mesa, división, medios de pago y cierre del día." },
  { icon: CalendarCheck, title: "Reservas y métricas", text: "Reservas online con mesa asignada, y números claros de cada noche." },
  { icon: ShoppingBasket, title: "Compras", text: "Cargá lo que comprás y mirá cuánto queda de verdad." },
  { icon: MessagesSquare, title: "Muro y chat de mesa", text: "Pantalla gigante para eventos y chat entre mesas, moderado." },
];

/** Portada pública: barra con logo e inicio de sesión, y qué hace Yatay. */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label={BRAND.name} className="mr-auto">
            <BrandMark className="h-10" priority />
          </Link>
          <Link href={`/${DEMO_SLUG}`} className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink sm:block">
            Ver una carta de ejemplo
          </Link>
          <ButtonLink href="/login" size="sm">
            <LogIn className="size-4" aria-hidden /> Iniciar sesión
          </ButtonLink>
        </nav>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Hojas de la palmera como fondo, muy suaves. */}
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-brand/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 size-[22rem] rounded-full bg-brand/5 blur-3xl" />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.15fr_0.85fr] md:py-24">
            <div className="animate-fade-up">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">{BRAND.slogan}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Tu local ordenado, de la carta a la caja.</h1>
              <p className="mt-4 max-w-xl text-lg text-muted text-pretty">
                Carta QR, pedidos a la mesa, cocina, caja, reservas y métricas en un solo lugar. Para restaurantes, bares, cafeterías y
                heladerías.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/login" size="lg">
                  <LogIn className="size-5" aria-hidden /> Iniciar sesión
                </ButtonLink>
                <ButtonLink href={`/${DEMO_SLUG}`} size="lg" variant="secondary">
                  <QrCode className="size-5" aria-hidden /> Ver una carta de ejemplo
                </ButtonLink>
              </div>
            </div>

            <div className="relative mx-auto hidden w-full max-w-xs animate-fade-up md:block" style={{ animationDelay: "120ms" }}>
              <div className="rounded-[2.2rem] border border-line bg-surface p-3 shadow-2xl shadow-brand/10">
                <div className="rounded-[1.7rem] bg-bg p-4">
                  <div className="flex items-center gap-2">
                    <BrandMark variant="icon" className="h-7" />
                    <div className="leading-tight">
                      <p className="text-sm font-semibold">Tu local</p>
                      <p className="text-xs text-muted">Mesa 6 · 3 personas</p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Para compartir</p>
                  {[
                    ["Empanadas de carne", "$2.400"],
                    ["Provoleta", "$7.800"],
                    ["Papas rústicas", "$6.500"],
                  ].map(([n, p]) => (
                    <div key={n} className="mt-2 flex items-center justify-between rounded-xl bg-surface px-3 py-2.5 text-sm">
                      <span>{n}</span>
                      <span className="tabular-nums text-muted">{p}</span>
                    </div>
                  ))}
                  <div className="mt-4 flex gap-2">
                    <span className="flex-1 rounded-xl border border-line bg-surface py-2.5 text-center text-sm">Llamar al mozo</span>
                    <span className="flex-1 rounded-xl bg-brand py-2.5 text-center text-sm font-medium text-brand-ink">Pedir · $16.700</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Todo lo que pasa en el local, conectado</h2>
            <p className="mt-2 max-w-2xl text-muted">Lo que pide la mesa llega a la cocina, el mozo lo ve en la sala y la caja cierra sin papelitos.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-line bg-bg p-5">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-sm text-muted sm:px-6">
          <BrandMark variant="icon" className="h-7" />
          <span>
            {BRAND.name} · {BRAND.slogan}
          </span>
          <span className="sm:ml-auto">Hecho en Paraná, Entre Ríos · {BRAND.domain}</span>
        </div>
      </footer>
    </div>
  );
}
