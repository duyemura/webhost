import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // node env is correct for pure-function tests (spec.ts has no DOM deps).
    // Future component tests should add // @vitest-environment jsdom per file.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
