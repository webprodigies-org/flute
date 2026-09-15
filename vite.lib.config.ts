import { defineConfig } from "vite";
export default defineConfig({
  build: {
    outDir: "dist/library",
    emptyOutDir: true,
    lib: { entry: { index: "src/index.ts", preview: "src/preview/index.tsx" }, formats: ["es"], fileName: (_format, name) => `${name}.js` },
    rollupOptions: {
      output: { banner: '"use client";' },
      external: ["react", "react-dom", "react/jsx-runtime", "react-error-boundary", "zod"],
    },
    sourcemap: true,
  },
});
