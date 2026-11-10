import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Habilita forbidden() / unauthorized() para los guards de roles.
    authInterrupts: true,
  },
  // El Service Worker no se cachea: así los cambios llegan apenas se publica una versión nueva.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
};

export default nextConfig;
