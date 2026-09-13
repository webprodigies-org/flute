import { defineConfig } from "vite";
export default defineConfig({
  build: {
    outDir: "dist/library",
    emptyOutDir: false,
    lib: { entry: { index: "src/index.ts", preview: "src/preview/index.tsx" }, formats: ["es"], fileName: (_format, name) => `${name}.js` },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "react-error-boundary", "zod"],
    },
    sourcemap: true,
  },
});
