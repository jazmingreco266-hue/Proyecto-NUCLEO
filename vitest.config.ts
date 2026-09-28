import path from "node:path";
import { defineConfig } from "vitest/config";

// Los tests siempre usan una base aparte. Se fija acá para que la vean
// el globalSetup y todos los archivos de test.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://nucleo@localhost:5433/nucleo_test?host=/tmp";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Los tests de integración comparten una base: se corren en serie.
    fileParallelism: false,
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 20_000,
  },
});
