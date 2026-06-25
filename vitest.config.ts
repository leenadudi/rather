import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      // server-only throws if imported outside a React Server Component bundle;
      // alias it to an empty module so server modules can be unit-tested in node.
      "server-only": path.resolve(__dirname, "vitest.server-only-stub.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
