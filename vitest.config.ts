import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Allow .js extensions in imports (as written in ESM source)
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
});
