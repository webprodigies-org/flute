import { builtinModules } from "node:module";
import { defineConfig } from "vite";
import manifest from "./package.json";
export default defineConfig({
  define: { __FLUTE_VERSION__: JSON.stringify(manifest.version) },
  build: {
    target: "node22",
    outDir: "dist/cli",
    emptyOutDir: true,
    minify: false,
    lib: { entry: "src/cli/main.ts", formats: ["es"], fileName: () => "flute.js" },
    rollupOptions: {
      external: id => id.startsWith("node:") || builtinModules.includes(id) || ["zod", "typescript", "playwright"].includes(id),
    },
  },
});
