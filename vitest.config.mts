import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` lanza fuera de React Server Components; en tests es un no-op.
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["dotenv/config"],
    // Los tests de integración comparten la base local: sin paralelismo entre archivos.
    fileParallelism: false,
  },
});
