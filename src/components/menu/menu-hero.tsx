"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Globe, MapPin } from "lucide-react";
import type { MenuTheme } from "@/generated/prisma/enums";
import { FadeOverlay, Photo } from "@/components/mock-image";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn, formatPrice } from "@/lib/format";
import type { PublicMenu, PublicProduct } from "@/lib/public-menu";

export type Venue = {
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  menuTheme: MenuTheme;
  coverImageUrl: string | null;
  logoUrl: string | null;
};

const INTERVAL_MS = 7000;

/**
 * Portada estilo "Netflix": el nombre/logo del local quedan fijos y lo que rota es el fondo.
 * Si el local subió una portada, es la primera imagen (presentación del local); después
 * rotan las categorías con su plato destacado. Rota sola hasta que el usuario elige una
 * categoría; respeta "reducir movimiento".
 */
export function MenuHero({
  venue,
  menu,
  onOpenProduct,
}: {
  venue: Venue;
  menu: PublicMenu;
  onOpenProduct: (p: PublicProduct) => void;
}) {
  const slides = menu.map((c) => ({
    category: c,
    // Destacado: el primer plato disponible con foto; si no hay, el primero disponible.
    featured:
      c.products.find((p) => p.available && p.imageUrl) ?? c.products.find((p) => p.available) ?? c.products[0],
  }));
  // Con portada, la posición 0 es la presentación del local y las categorías van desde la 1.
  const hasCover = !!venue.coverImageUrl;
  const offset = hasCover ? 1 : 0;
  const total = slides.length + offset;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (paused || hovering || total < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setActive((i) => (i + 1) % total), INTERVAL_MS);
    return () => clearTimeout(id);
  }, [active, paused, hovering, total]);

  const showingCover = hasCover && active === 0;
  const current = showingCover ? null : slides[active - offset];
  const ctas = [
    { href: venue.instagramUrl, label: "Instagram", icon: InstagramIcon },
    { href: venue.facebookUrl, label: "Facebook", icon: FacebookIcon },
    { href: venue.websiteUrl, label: "Web", icon: Globe },
  ].filter((c) => c.href);

  const choose = (i: number) => {
    setActive(i);
    setPaused(true);
  };

  return (
    <section
      className="relative isolate flex h-[92svh] min-h-[580px] max-h-[920px] flex-col overflow-hidden md:h-[82svh]"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      aria-roledescription="carrusel"
      aria-label={`Destacados de ${venue.name}`}
    >
      {/* Fondos: fundido cruzado entre categorías */}
      <div className="absolute inset-0 -z-10">
        {hasCover && (
          <div
            aria-hidden={!showingCover}
            className={cn(
              "absolute inset-0 transition-[opacity,transform] duration-[1200ms] ease-out",
              showingCover ? "scale-100 opacity-100" : "scale-105 opacity-0",
            )}
          >
            <Photo src={venue.coverImageUrl} seed={venue.slug + "cover"} label={`Portada de ${venue.name}`} hideIcon priority className="size-full" />
          </div>
        )}
        {slides.map((s, i) => (
          <div
            key={s.category.id}
            aria-hidden={i + offset !== active}
            className={cn(
              "absolute inset-0 transition-[opacity,transform] duration-[1200ms] ease-out md:left-[28%]",
              i + offset === active ? "scale-100 opacity-100" : "scale-105 opacity-0",
            )}
          >
            <Photo
              src={s.featured?.imageUrl ?? venue.coverImageUrl}
              seed={s.featured?.id ?? s.category.id}
              kind={s.featured?.station === "BAR" ? "bar" : "kitchen"}
              label={s.featured ? `${s.featured.name}` : s.category.name}
              hideIcon
              priority={!hasCover && i === 0}
              className="size-full"
            />
            {/* Borde izquierdo de la foto fundido (en pantallas anchas la foto arranca a la derecha) */}
            <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-2/5 bg-gradient-to-r from-bg to-transparent md:block" />
          </div>
        ))}
        <FadeOverlay fade="hero" />
      </div>

      {/* Barra del local */}
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 pt-4 sm:px-6 lg:px-10">
        <Photo
          src={venue.logoUrl}
          priority
          seed={venue.slug}
          kind="kitchen"
          label={`Logo de ${venue.name}`}
          className="size-11 shrink-0 rounded-xl ring-1 ring-ink/10"
        />
        <div className="flex-1" />
        <div className="flex items-center gap-1 rounded-full bg-bg/50 p-1 backdrop-blur-md">
          {ctas.map(({ href, label, icon: Icon }) => (
            <a
              key={label}
              href={href!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex size-10 items-center justify-center rounded-full hover:bg-ink/10"
            >
              <Icon className="size-5" />
            </a>
          ))}
          <ThemeToggle className="hover:bg-ink/10" storageKey={`theme:${venue.slug}`} />
        </div>
      </div>

      {/* Nombre fijo + bloque rotativo */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-4 pb-6 sm:px-6 lg:px-10">
        <h1 className="max-w-4xl text-[clamp(3rem,11vw,7.5rem)] font-black leading-[0.88] tracking-tight">
          {venue.name}
        </h1>
        {venue.address && (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand sm:text-base">
            <MapPin className="size-4 shrink-0" aria-hidden /> {venue.address}
          </p>
        )}

        {showingCover && (
          <div key="cover" className="mt-7 max-w-xl animate-fade-up" aria-live="polite">
            {venue.tagline && <p className="text-lg font-semibold sm:text-xl">{venue.tagline}</p>}
            {venue.description && <p className="mt-2 text-sm text-ink/75 sm:text-base">{venue.description}</p>}
            <a
              href="#carta"
              className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-bg hover:bg-ink/90"
            >
              Ver la carta <ArrowDown className="size-4" aria-hidden />
            </a>
          </div>
        )}

        {current && (
          <div key={current.category.id} className="mt-7 max-w-xl animate-fade-up" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Categoría</p>
            <p className="mt-1 text-2xl font-bold sm:text-3xl">{current.category.name}</p>
            {current.featured && (
              <>
                <p className="mt-3 text-sm text-ink/75 sm:text-base">
                  <span className="font-semibold text-ink">{current.featured.name}</span>
                  {current.featured.description ? ` — ${current.featured.description}` : ""}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onOpenProduct(current.featured!)}
                    className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-bg hover:bg-ink/90"
                  >
                    Ver plato · {formatPrice(current.featured.priceCents)}
                  </button>
                  <a
                    href={`#cat-${current.category.id}`}
                    className="inline-flex h-11 items-center gap-1.5 rounded-full bg-bg/50 px-5 text-sm font-semibold ring-1 ring-ink/15 backdrop-blur-md hover:bg-bg/70"
                  >
                    Ver {current.category.name.toLowerCase()} <ArrowDown className="size-4" aria-hidden />
                  </a>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tiras de categorías */}
        <div
          role="tablist"
          aria-label="Categorías"
          className="-mx-4 mt-7 flex snap-x gap-3 overflow-x-auto px-4 pb-1 pt-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
        >
          {slides.map((s, i) => {
            const on = i + offset === active;
            return (
              <button
                key={s.category.id}
                role="tab"
                aria-selected={on}
                onClick={() => choose(i + offset)}
                className={cn(
                  "group relative aspect-[4/3] w-32 shrink-0 snap-start overflow-hidden rounded-xl text-left transition-all duration-300 sm:w-40 lg:w-48",
                  on ? "ring-2 ring-ink" : "opacity-70 grayscale hover:opacity-100 hover:grayscale-0",
                )}
              >
                <Photo
                  src={s.featured?.imageUrl ?? venue.coverImageUrl}
                  seed={s.featured?.id ?? s.category.id}
                  kind={s.featured?.station === "BAR" ? "bar" : "kitchen"}
                  fade="bottom"
                  className="size-full transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 p-2.5 text-sm font-bold leading-tight sm:text-base">
                  {s.category.name}
                </span>
                {on && !paused && !hovering && slides.length > 1 && (
                  <span
                    key={active}
                    className="absolute inset-x-0 top-0 h-0.5 origin-left animate-progress bg-ink/80"
                    style={{ ["--hero-interval" as string]: `${INTERVAL_MS}ms` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />
    </svg>
  );
}
