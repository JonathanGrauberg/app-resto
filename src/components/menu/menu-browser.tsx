"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import type { Allergen } from "@/generated/prisma/enums";
import { Photo } from "@/components/mock-image";
import { ALLERGENS, ALLERGEN_KEYS } from "@/lib/allergens";
import { cn, formatPrice } from "@/lib/format";
import type { PublicMenu, PublicProduct } from "@/lib/public-menu";
import { matchesQuery } from "@/lib/search";

/**
 * Buscador + filtros + carta.
 * Celular: lista (foto a la derecha). Tablet: grilla de 2. PC: grilla de 3.
 */
export function MenuBrowser({
  menu,
  onOpenProduct,
}: {
  menu: PublicMenu;
  onOpenProduct: (p: PublicProduct) => void;
}) {
  const [query, setQuery] = useState("");
  const [excluded, setExcluded] = useState<Set<Allergen>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [activeCat, setActiveCat] = useState(menu[0]?.id);

  const filtered = useMemo(
    () =>
      menu
        .map((c) => ({
          ...c,
          products: c.products.filter(
            (p) =>
              !p.allergens.some((a) => excluded.has(a)) &&
              matchesQuery(query, [p.name, p.description, c.name, ...p.tags]),
          ),
        }))
        .filter((c) => c.products.length > 0),
    [menu, query, excluded],
  );

  // Resalta la categoría visible mientras se hace scroll.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]) setActiveCat(visible[0].target.id.replace("cat-", ""));
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    document.querySelectorAll("[data-category]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [filtered]);

  const toggleAllergen = (a: Allergen) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-bg/90 px-4 pb-2 pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex gap-2 lg:items-center">
          <label className="relative flex-1 lg:max-w-md">
            <span className="sr-only">Buscar en la carta</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar plato, ingrediente…"
              className="h-11 w-full rounded-full border border-line bg-surface pl-9 pr-4 text-base focus:border-brand focus:outline-none sm:text-sm"
            />
          </label>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={cn(
              "relative flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm",
              excluded.size ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface",
            )}
          >
            <Filter className="size-4" aria-hidden />
            <span className="hidden sm:inline">Alérgenos</span>
            {excluded.size > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-brand text-xs text-brand-ink">
                {excluded.size}
              </span>
            )}
          </button>

          {/* En PC las categorías van en la misma fila que el buscador */}
          <CategoryChips cats={filtered} active={activeCat} className="ml-4 hidden flex-1 lg:flex" />
        </div>

        {showFilters && (
          <div className="mt-2 rounded-2xl border border-line bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Ocultar platos que contienen:</p>
              <div className="flex items-center gap-3">
                {excluded.size > 0 && (
                  <button onClick={() => setExcluded(new Set())} className="text-sm text-brand">
                    Limpiar
                  </button>
                )}
                <button onClick={() => setShowFilters(false)} aria-label="Cerrar filtros" className="text-muted">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGEN_KEYS.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAllergen(a)}
                  aria-pressed={excluded.has(a)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-sm",
                    excluded.has(a) ? "border-brand bg-brand text-brand-ink" : "border-line",
                  )}
                >
                  {ALLERGENS[a].label}
                </button>
              ))}
            </div>
          </div>
        )}

        <CategoryChips cats={filtered} active={activeCat} className="-mx-4 mt-2 flex px-4 sm:-mx-6 sm:px-6 lg:hidden" />
      </div>

      {filtered.length === 0 && (
        <div className="py-20 text-center text-muted">
          <p>No encontramos platos con esos filtros.</p>
          <button
            onClick={() => {
              setQuery("");
              setExcluded(new Set());
            }}
            className="mt-2 text-sm font-medium text-brand"
          >
            Ver toda la carta
          </button>
        </div>
      )}

      <div className="space-y-12 pb-16 pt-6 sm:space-y-16 sm:pt-10">
        {filtered.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} data-category className="scroll-mt-36 lg:scroll-mt-24">
            <h2 className="mb-3 flex items-baseline gap-3 text-xl font-bold tracking-tight sm:mb-6 sm:text-3xl">
              {c.name}
              <span className="text-sm font-normal text-muted">{c.products.length}</span>
            </h2>
            <ul className="divide-y divide-line sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:divide-y-0 lg:grid-cols-3 lg:gap-x-8">
              {c.products.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} onOpen={() => onOpenProduct(p)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function ProductCard({ product: p, onOpen }: { product: PublicProduct; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={cn("group flex w-full gap-4 py-3 text-left sm:flex-col sm:gap-0 sm:py-0", !p.available && "opacity-50")}
    >
      <div className="order-last size-24 shrink-0 overflow-hidden rounded-xl sm:order-first sm:aspect-[4/3] sm:size-auto sm:w-full sm:rounded-2xl">
        <Photo
          src={p.imageUrl}
          seed={p.id}
          kind={p.station === "BAR" ? "bar" : "kitchen"}
          label={p.name}
          fade="card"
          className="size-full transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      {/* Desde tablet el texto se monta sobre el degradado inferior de la foto */}
      <div className="relative min-w-0 flex-1 sm:-mt-12 sm:px-1">
        <p className="font-semibold leading-snug sm:text-lg">{p.name}</p>
        {p.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{p.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold tabular-nums">{formatPrice(p.priceCents)}</span>
          {!p.available && <span className="text-xs font-medium text-danger">Agotado</span>}
          {p.allergens.length > 0 && (
            <span className="text-xs text-muted" title={p.allergens.map((a) => ALLERGENS[a].label).join(", ")}>
              {p.allergens.map((a) => ALLERGENS[a].short).join(" · ")}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function CategoryChips({
  cats,
  active,
  className,
}: {
  cats: { id: string; name: string }[];
  active?: string;
  className?: string;
}) {
  return (
    <nav className={cn("gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]", className)} aria-label="Ir a categoría">
      {cats.map((c) => (
        <a
          key={c.id}
          href={`#cat-${c.id}`}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors",
            active === c.id ? "bg-ink text-bg" : "bg-surface text-ink/80 ring-1 ring-line hover:ring-ink/30",
          )}
        >
          {c.name}
        </a>
      ))}
    </nav>
  );
}

export function CloseButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label="Cerrar"
      className={cn("flex size-9 items-center justify-center rounded-full bg-bg/80 shadow backdrop-blur", className)}
    >
      <X className="size-5" aria-hidden />
    </button>
  );
}
