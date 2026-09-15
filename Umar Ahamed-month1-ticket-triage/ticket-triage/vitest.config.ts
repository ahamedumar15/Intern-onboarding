import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Node environment: every test runs against the in-memory fake repository,
    // so the suite needs no database, no jsdom and no Next.js harness (ADR-002).
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["default"],
  },
});
