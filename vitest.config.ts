import { defineConfig } from "vitest/config";
import path from "node:path";

const databaseTests = ["tests/integrations.test.ts", "tests/tenancy.db.test.ts"];

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.node.test.ts", ...(!process.env.DATABASE_URL ? databaseTests : [])],
    environment: "node",
    testTimeout: 20_000,
    setupFiles: ["tests/setup.ts"],
  },
});
