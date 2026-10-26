import Link from "next/link";
import { BookOpen, CalendarDays, ChevronRight, Globe, MapPin, Star } from "lucide-react";
import { CIRCLE, LEAVES, TRUNK } from "@/components/yatay-logo-paths";
import { BRAND } from "@/lib/brand";
import { LINK_THEMES, linkHref, linkLabel, type LinkItem, type LinkTheme } from "@/lib/links";

/** Palmerita de Yatay: ícono de los enlaces propios del local y firma del pie. */
export function YatayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 187 187" className={className} aria-hidden>
      <path d={CIRCLE.d} fill="#009375" />
      <path d={TRUNK.d} transform={`translate(${TRUNK.x} ${TRUNK.y})`} fill="#fff" />
      <path d={LEAVES.d} transform={`translate(${LEAVES.x} ${LEAVES.y})`} fill="#fff" />
    </svg>
  );
}

const Instagram = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p} aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);
const WhatsApp = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p} aria-hidden>
    <path d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.3 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3Z" />
  </svg>
);
const Facebook = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p} aria-hidden>
    <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />
  </svg>
);

const ICON: Record<LinkItem["type"], (p: { className?: string }) => React.ReactNode> = {
  carta: BookOpen,
  reservas: CalendarDays,
  instagram: Instagram,
  whatsapp: WhatsApp,
  reviews: Star,
  maps: MapPin,
  facebook: Facebook,
  website: Globe,
  custom: YatayMark,
};

/**
 * Página de enlaces del local: logo, nombre, botones y la firma "Hecho con Yatay".
 * Se ve como del local (su logo, su portada, el fondo que eligió) pero deja claro quién la armó.
 */
export function LinksPage({
  venue,
  links,
  theme,
  cartaHref,
  bookingHref,
  country,
}: {
  venue: { name: string; tagline: string | null; logoUrl: string | null; coverImageUrl: string | null };
  links: LinkItem[];
  theme: LinkTheme;
  cartaHref: string;
  bookingHref: string | null;
  country: string;
}) {
  const t = LINK_THEMES[theme];
  const buttons = links
    .filter((l) => l.enabled)
    .map((l) => ({ l, href: linkHref(l, { cartaHref, bookingHref, country }) }))
    .filter((b): b is { l: LinkItem; href: string } => !!b.href);
  const cover = theme === "cover" && venue.coverImageUrl;

  return (
    <main className="relative isolate flex min-h-dvh flex-1 flex-col items-center overflow-hidden px-5 pb-8 pt-12" style={{ background: t.bg, color: t.fg }}>
      {cover && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- ya vienen comprimidas */}
          <img src={venue.coverImageUrl!} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}
      <div className="relative flex w-full max-w-md flex-1 flex-col items-center">
        {venue.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ya vienen comprimidas
          <img src={venue.logoUrl} alt={`Logo de ${venue.name}`} className="size-24 rounded-full object-cover shadow-lg" style={{ boxShadow: `0 0 0 3px ${t.ring}` }} />
        ) : (
          <div className="grid size-24 place-items-center rounded-full text-3xl font-black" style={{ background: t.button, boxShadow: `0 0 0 3px ${t.ring}` }}>
            {venue.name.slice(0, 1)}
          </div>
        )}
        <h1 className="mt-5 text-center text-3xl font-black tracking-tight">{venue.name}</h1>
        {venue.tagline && (
          <p className="mt-1 text-center" style={{ color: t.muted }}>
            {venue.tagline}
          </p>
        )}

        <nav className="mt-8 flex w-full flex-col gap-3" aria-label={`Enlaces de ${venue.name}`}>
          {buttons.map(({ l, href }, i) => {
            const Icon = ICON[l.type];
            const internal = href.startsWith("/") || href.startsWith("?");
            const className = "group flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold transition-transform active:scale-[0.98]";
            const style = { background: i === 0 && l.type === "carta" ? t.fg : t.button, color: i === 0 && l.type === "carta" ? t.bg : t.buttonFg, boxShadow: `inset 0 0 0 1px ${t.ring}` };
            const content = (
              <>
                <span className="grid size-9 shrink-0 place-items-center">
                  <Icon className="size-6" />
                </span>
                <span className="flex-1 text-center">{linkLabel(l)}</span>
                <ChevronRight className="size-5 shrink-0 opacity-50 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </>
            );
            return internal ? (
              <Link key={`${l.type}-${i}`} href={href} className={className} style={style}>
                {content}
              </Link>
            ) : (
              <a key={`${l.type}-${i}`} href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
                {content}
              </a>
            );
          })}
        </nav>

        <Link href="/" className="mt-auto flex items-center gap-2 pt-12 text-sm" style={{ color: t.muted }}>
          Hecho con <YatayMark className="size-5" /> <strong className="font-semibold">{BRAND.name}</strong>
        </Link>
      </div>
    </main>
  );
}
