import { describe, expect, it } from "vitest";
import { inspectConfig } from "../../src/project/vite";

const shadcn = `import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});`;
const inspect = (source: string) => inspectConfig(source, "vite.config.ts");

describe("static Vite configuration boundary", () => {
  it.each([
    ["official shadcn recipe", shadcn],
    ["node:path", shadcn.replace("from 'path'", "from 'node:path'")],
    ["renamed imports", shadcn.replaceAll("path", "nodePath").replace("from 'nodePath'", "from 'path'")
      .replaceAll("tailwindcss", "cssPlugin").replace("@cssPlugin/vite", "@tailwindcss/vite")
      .replace("{ defineConfig }", "{ defineConfig as config }").replace("default defineConfig", "default config")],
    ["SWC React", shadcn.replace("@vitejs/plugin-react'", "@vitejs/plugin-react-swc'")],
    ["reversed plugin order", shadcn.replace("react(), tailwindcss()", "tailwindcss(), react()")],
    ["standard React", "import react from '@vitejs/plugin-react'; export default {plugins: [react()]};"],
  ])("accepts %s without evaluating imports", (_name, source) => {
    expect(() => inspect(source)).not.toThrow();
  });

  it.each([
    ["missing refresh plugin", "export default {root: './', base: '/', server: {port: 5173, strictPort: true}};"],
    ["external alias", shadcn.replace("'./src'", "'/tmp/src'")],
    ["parent traversal", shadcn.replace("'./src'", "'../src'")],
    ["normalized traversal", shadcn.replace("'./src'", "'./other/../src'")],
    ["dynamic alias target", shadcn.replace("'./src'", "process.env.SOURCE")],
    ["template alias target", shadcn.replace("'./src'", "`./src`")],
    ["extra path segment", shadcn.replace("'./src')", "'./src', '..')")],
    ["different dirname", shadcn.replace("resolve(__dirname", "resolve(import.meta.dirname")],
    ["computed resolve", shadcn.replace("path.resolve", "path['resolve']")],
    ["different path method", shadcn.replace("path.resolve", "path.join")],
    ["alias string", shadcn.replace("path.resolve(__dirname, './src')", "'/src'")],
    ["different alias", shadcn.replace("'@':", "'other':")],
    ["extra alias", shadcn.replace("'@':", "other: '/tmp', '@':")],
    ["duplicate alias", shadcn.replace("'@':", "'@': '/tmp', '@':")],
    ["alias spread", shadcn.replace("'@':", "...other, '@':")],
    ["computed alias", shadcn.replace("'@':", "['@']:")],
    ["extra resolve option", shadcn.replace("resolve: {", "resolve: { extensions: [],")],
    ["custom plugin import", shadcn.replace("@tailwindcss/vite", "custom-plugin")],
    ["unknown plugin call", shadcn.replace("tailwindcss()", "customPlugin()")],
    ["Tailwind options", shadcn.replace("tailwindcss()", "tailwindcss({})")],
    ["React options", shadcn.replace("react()", "react({})")],
    ["duplicate Tailwind", shadcn.replace("tailwindcss()", "tailwindcss(), tailwindcss()")],
    ["duplicate React", shadcn.replace("react()", "react(), react()")],
    ["two React implementations", shadcn.replace("import path", "import swc from '@vitejs/plugin-react-swc'; import path")
      .replace("react()", "react(), swc()")],
    ["no React", shadcn.replace("react(), ", "")],
    ["empty plugins", shadcn.replace("react(), tailwindcss()", "")],
    ["plugin spread", shadcn.replace("react()", "...react()")],
    ["dynamic root", shadcn.replace("plugins:", "root: process.env.ROOT, plugins:")],
    ["external root", shadcn.replace("plugins:", "root: '../other', plugins:")],
    ["dynamic config", shadcn.replace("defineConfig({", "defineConfig(() => ({").replace("});", "}));")],
    ["config spread", shadcn.replace("plugins:", "...options, plugins:")],
    ["duplicate config key", shadcn.replace("plugins:", "plugins: [react()], plugins:")],
    ["shadowed path", "const path = custom;\n" + shadcn],
    ["shadowed dirname", "const __dirname = '/tmp';\n" + shadcn],
    ["imported dirname", shadcn.replace("import path", "import __dirname from 'path'; import path")],
    ["duplicate import binding", shadcn.replace("import path", "import path from '@tailwindcss/vite'; import path")],
    ["misimported path", shadcn.replace("from 'path'", "from '@tailwindcss/vite'")],
    ["misimported Tailwind", shadcn.replace("from '@tailwindcss/vite'", "from 'path'")],
    ["misimported defineConfig", shadcn.replace("from 'vite'", "from '@tailwindcss/vite'")],
    ["type-only default", shadcn.replace("import path", "import type path")],
    ["type-only defineConfig", shadcn.replace("{ defineConfig }", "{ type defineConfig }")],
    ["named plugin import", shadcn.replace("import tailwindcss", "import { defineConfig as tailwindcss }")],
    ["namespace path", shadcn.replace("import path", "import * as path")],
    ["side-effect import", "import '@tailwindcss/vite';\n" + shadcn],
    ["path mutation", shadcn.replace("export default", "path.resolve = custom; export default")],
    ["unknown config key", shadcn.replace("plugins:", "build: {}, plugins:")],
  ])("rejects %s with the existing diagnostic contract", (_name, source) => {
    expect(() => inspect(source)).toThrow(expect.objectContaining({ code: "unsupported-project" }));
  });
});
