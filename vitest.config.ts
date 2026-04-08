import { defineConfig } from "vitest/config";

/**
 * Test and coverage configuration for the package.
 */
export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.config.ts", "dist/**", "src/types.ts"],
    },
    environment: "node",
    globals: true,
  },
});
