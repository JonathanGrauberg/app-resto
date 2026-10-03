import type { MenuTheme } from "@/generated/prisma/enums";
import { InlineScript } from "@/components/inline-script";

/**
 * Aplica el tema de la carta antes del primer pintado:
 * 1) lo que eligió el comensal en ESTE local (localStorage `theme:<slug>`);
 * 2) si no, el tema por defecto que configuró el restaurante.
 */
export function MenuThemeScript({ slug, theme }: { slug: string; theme: MenuTheme }) {
  const fallback = theme === "SYSTEM" ? null : theme.toLowerCase();
  const js = `(function(){try{var d=document.documentElement,t=localStorage.getItem(${JSON.stringify(
    `theme:${slug}`,
  )})||${JSON.stringify(fallback)};if(t)d.setAttribute("data-theme",t);else d.removeAttribute("data-theme")}catch(e){}})()`;
  return <InlineScript html={js} />;
}
