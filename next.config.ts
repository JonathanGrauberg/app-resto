import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Habilita forbidden() / unauthorized() para los guards de roles.
    authInterrupts: true,
  },
};

export default nextConfig;
