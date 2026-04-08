import { defineConfig } from "tsdown";

/**
 * Build configuration for the published package bundles and declarations.
 */
export default defineConfig({
  attw: true,
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  sourcemap: true,
  publint: true,
  minify: true,
  target: "es2022",
});
