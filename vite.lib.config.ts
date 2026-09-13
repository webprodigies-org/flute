import { defineConfig } from "vite";
export default defineConfig({
  build: {
    outDir: "dist/library",
    emptyOutDir: false,
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "react-error-boundary", "zod"],
    },
    sourcemap: true,
  },
});
