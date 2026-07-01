import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Map the "@/..." path alias (defined in tsconfig.json) so the unit tests can
// import from "@/lib/...". Without this, vitest cannot resolve the alias the
// way the Next.js bundler does.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
