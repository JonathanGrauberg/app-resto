import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { LogIn, QrCode } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { BANDS } from "@/components/landing/palette";
import { ScrollStory } from "@/components/landing/scroll-story";
import { TornEdge } from "@/components/landing/torn-edge";
import { ButtonLink } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

/** Carta de ejemplo para mostrar (local demo de Argentina). */
const DEMO_SLUG = "parrilla-demo";

const serif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"] });

function Title({ kicker, children, as: H = "h2" }: { kicker: string; children: React.ReactNode; as?: "h1" | "h2" }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--kicker)]">{kicker}</p>
      <H className={`${serif.className} mt-3 text-5xl leading-[1.02] text-balance sm:text-7xl`}>{children}</H>
    </>
  );
}

/**
 * Portada pública. La historia se cuenta con el scroll: una persona llega, se sienta, escanea el QR,
 * el mozo le trae el pedido. Estilo propio (es la vidriera, no sigue el tema del sistema): bandas lisas verde Yatay y crema,
 * divididas con un borde a pincel, textos sin recuadro y botones coral.
 */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#1f4038] text-[#f3ead9]">
      <header className="sticky top-0 z-30 bg-[#1f4038]">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label={BRAND.name} className="mr-auto">
            <BrandMark className="h-10" priority fixed="dark" />
          </Link>
          <Link href={`/${DEMO_SLUG}`} className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[#f3ead9]/75 hover:text-[#f3ead9] sm:block">
            Ver una carta de ejemplo
          </Link>
          <ButtonLink href="/login" size="sm" className="rounded-full !bg-[#e2725b] px-4 text-white hover:!bg-[#cf6049]">
            <LogIn className="size-4" aria-hidden /> Iniciar sesión
          </ButtonLink>
        </nav>
      </header>

      <main className="flex-1">
        <ScrollStory
          steps={[
            {
              title: (
                <Title kicker={BRAND.slogan} as="h1">
                  Tu local, <em>en orden</em> de la carta a la caja.
                </Title>
              ),
              text: "Para restaurantes, bares, cafeterías y heladerías. Bajá y mirá cómo es una visita con Yatay.",
              extra: <p className="mt-10 text-sm opacity-60">↓ Seguí bajando</p>,
            },
            {
              title: (
                <Title kicker="Llegan">
                  Se sientan, <em>y la carta ya está</em> en la mesa.
                </Title>
              ),
              text: "Cada mesa tiene su QR. No hay que esperar la carta ni bajar ninguna app.",
            },
            {
              title: (
                <Title kicker="Piden">
                  Escanean y <em>piden</em> desde el celular.
                </Title>
              ),
              text: "Con fotos y precios al día. Lo que piden llega directo a quien lo prepara, sin papelitos ni idas y vueltas.",
            },
            {
              title: (
                <Title kicker="Atienden">
                  El mozo llega <em>justo a tiempo.</em>
                </Title>
              ),
              text: "Sabe qué mesa lo llamó, qué pidió y qué está listo para llevar. Menos corridas, mejor atención.",
            },
            {
              title: (
                <Title kicker="Y la caja">
                  Todo cierra <em>solo.</em>
                </Title>
              ),
              text: "La cuenta se divide fácil, se cobra con el medio que quieran y al final del día los números están claros.",
              extra: (
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink href="/login" size="lg" className="rounded-full !bg-[#e2725b] px-6 text-white hover:!bg-[#cf6049]">
                    <LogIn className="size-5" aria-hidden /> Iniciar sesión
                  </ButtonLink>
                  <ButtonLink href={`/${DEMO_SLUG}`} size="lg" variant="secondary" className="rounded-full border-[#f3ead9]/40 !bg-transparent px-6 text-[#f3ead9] hover:bg-[#f3ead9]/10">
                    <QrCode className="size-5" aria-hidden /> Ver una carta
                  </ButtonLink>
                </div>
              ),
            },
          ]}
        />

        <section className="relative px-4 pb-28 pt-20 text-center text-[#1f3a33] sm:px-6" style={{ background: BANDS[1] }}>
          <TornEdge color={BANDS[1]} seed={40} className="absolute inset-x-0 top-0 -translate-y-[70%]" />
          <p className={`${serif.className} mx-auto max-w-2xl text-4xl leading-tight text-balance sm:text-6xl`}>
            ¿Lo querés ver <em>en tu local</em>? Te lo mostramos con tu carta.
          </p>
        </section>
      </main>

      <footer className="relative" style={{ background: BANDS[0] }}>
        <TornEdge color={BANDS[0]} seed={57} className="absolute inset-x-0 top-0 -translate-y-[70%]" />
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-8 text-sm text-[#f3ead9]/70 sm:px-6">
          <BrandMark variant="icon" className="h-7" fixed="dark" />
          <span>
            {BRAND.name} · {BRAND.slogan}
          </span>
          <span className="sm:ml-auto">Hecho en Paraná, Entre Ríos · {BRAND.domain}</span>
        </div>
      </footer>
    </div>
  );
}
