import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/** Para instalar Yatay en el celular o la tablet (ícono en la pantalla de inicio y pantalla de arranque con el logo). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} · ${BRAND.slogan}`,
    short_name: BRAND.name,
    description: BRAND.description,
    start_url: "/login",
    display: "standalone",
    background_color: BRAND.color,
    theme_color: BRAND.color,
    lang: "es",
    icons: [
      { src: "/brand/pwa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/pwa-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
