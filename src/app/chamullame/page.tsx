import type { Metadata } from "next";
import Link from "next/link";
import { Fredoka } from "next/font/google";
import { HeartHandshake, MessageCircle, Monitor, PartyPopper, Sparkles } from "lucide-react";
import { ChamullameMark } from "@/components/chamullame-mark";
import { BrandMark } from "@/components/brand-mark";
import { BRAND, CHAMULLAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: { absolute: `${CHAMULLAME.name} · ${CHAMULLAME.tagline}` },
  description: "Pantalla gigante, chat de mesa y chamullos entre mesas para bares, boliches, casamientos y eventos. Una app de Yatay.",
};

const fun = Fredoka({ weight: ["500", "700"], subsets: ["latin"] });

const FEATURES = [
  { icon: Monitor, title: "Pantalla gigante", text: "Los mensajes y fotos de la gente en la pantalla del lugar, moderados y con filtro de palabras." },
  { icon: MessageCircle, title: "Chat de mesa", text: "Cada mesa tiene su chat: se entra desde el QR, sin bajar nada." },
  { icon: HeartHandshake, title: "Chamullos entre mesas", text: "Una mesa le manda un chamullo a otra. Si aceptan, chatean. Si no, nadie insiste." },
  { icon: PartyPopper, title: "Para eventos", text: "Casamientos, cumples y boliches: un QR o un tótem en la entrada y todos adentro." },
];

/** Página propia de Chamullame (la app social de Yatay), separada de la gestión. */
export default function ChamullamePage() {
  return (
    <div className={`${fun.className} flex flex-1 flex-col bg-[#1b1130] text-[#fdf4ea]`}>
      <header className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-5 sm:px-6">
        <span className="mr-auto inline-flex items-center gap-2 text-2xl font-bold italic">
          <ChamullameMark className="h-10" /> {CHAMULLAME.name}
        </span>
        <Link href="/login" className="rounded-full bg-[#ff8a3d] px-4 py-2 text-sm font-bold text-[#1b1130] hover:brightness-105">
          Iniciar sesión
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#ff8a3d]">{CHAMULLAME.tagline}</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.02] text-balance sm:text-7xl">
            Que la noche pase <span className="text-[#ff8a3d]">entre mesas</span>, no solo en cada una.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-[#fdf4ea]/75">
            Chat de mesa, chamullos entre mesas y pantalla gigante para bares, boliches y eventos. Se escanea un QR y listo: sin apps que bajar, +18 y
            moderado.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-[#ff8a3d] px-6 py-3 font-bold text-[#1b1130] hover:brightness-105">
              Ya tengo Yatay: activarlo
            </Link>
            <Link href="/" className="rounded-full px-6 py-3 font-bold ring-2 ring-[#fdf4ea]/25 hover:bg-white/5">
              Conocé Yatay
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-2 sm:px-6">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <Icon className="size-7 text-[#ff8a3d]" aria-hidden />
              <h2 className="mt-4 text-xl font-bold">{title}</h2>
              <p className="mt-1 text-[#fdf4ea]/70">{text}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#2b3a9a]/40 px-4 py-2 text-sm font-medium">
            <Sparkles className="size-4 text-[#ff8a3d]" aria-hidden /> Próximamente: retos con premio, votaciones y álbum del evento.
          </p>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-6 text-sm text-[#fdf4ea]/60 sm:px-6">
          <span>Una app de</span>
          <Link href="/" aria-label={BRAND.name}>
            <BrandMark className="h-7" fixed="dark" />
          </Link>
          <span className="sm:ml-auto">Se suma a Yatay o se contrata sola.</span>
        </div>
      </footer>
    </div>
  );
}
