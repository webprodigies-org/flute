import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { executeProjectCommand } from "../../src/project/commands";
import { ProjectResultSchema, type ProjectResult } from "../../src/core/project";
import * as services from "../../src/project/services";
import { htmlEntry, inspectEntry } from "../../src/project/vite";

const roots: string[] = [];
const servers: Server[] = [];
const original = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "./Provider";
import App from "./App";
// Keep this provider and all application state.
createRoot(document.getElementById("root")!).render(
  <StrictMode><Provider tenant="local"><App /></Provider></StrictMode>,
);
`;
async function put(root: string, file: string, text: string) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), text);
}
async function fixture(options: { installed?: boolean; source?: string } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "flute-project-"));
  roots.push(root);
  await put(root, "package.json", JSON.stringify({ name: "host", scripts: { dev: "vite" },
    dependencies: { react: "^19.2.0", "react-dom": "^19.2.0", ...(options.installed === false ? {} : { "@flute/scene": "0.1.0" }) },
    devDependencies: { vite: "^7.3.6" } }));
  await put(root, "package-lock.json", '{"lockfileVersion":3}');
  await put(root, "index.html", '<div id="root"></div><script type="module" src="/src/main.tsx"></script>');
  await put(root, "vite.config.ts", 'import {defineConfig} from "vite"; import react from "@vitejs/plugin-react"; export default defineConfig({plugins:[react()]});');
  await put(root, "src/main.tsx", options.source ?? original);
  await put(root, ".env", "FIXTURE_ONLY=preserve\n");
  await put(root, "node_modules/react/package.json", '{"name":"react","version":"19.2.0"}');
  await put(root, "node_modules/react-dom/package.json", '{"name":"react-dom","version":"19.2.0"}');
  if (options.installed !== false) await installFixture(root);
  return root;
}
async function installFixture(root: string) {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  pkg.dependencies["@flute/scene"] = "0.1.0";
  await put(root, "package.json", JSON.stringify(pkg));
  await put(root, "node_modules/@flute/scene/package.json", JSON.stringify({ name: "@flute/scene", version: "0.1.0", exports: { "./preview": { import: "./preview.js" } } }));
  await put(root, "node_modules/@flute/scene/preview.js", "export const ProjectPreview = () => null;");
}
function run(root: string, operation: unknown = "init-project", input: unknown = {}) {
  return executeProjectCommand(operation, input, { root });
}
function success(result: ProjectResult) {
  expect(ProjectResultSchema.safeParse(result).success).toBe(true);
  expect(result, JSON.stringify(result)).toMatchObject({ success: true });
  if (!result.success) throw new Error(JSON.stringify(result));
  return result.data;
}
function failure(result: ProjectResult, code: string) {
  expect(ProjectResultSchema.safeParse(result).success).toBe(true);
  expect(result).toMatchObject({ success: false, issues: [{ code }] });
}
async function server(body: (url: string) => { status?: number; text?: string; headers?: Record<string, string> }) {
  const instance = createServer((request, response) => {
    const result = body(request.url ?? "/");
    response.writeHead(result.status ?? 200, { "content-type": "text/html", ...result.headers });
    response.end(result.text ?? "");
  });
  servers.push(instance);
  await new Promise<void>((resolve, reject) => {
    instance.once("error", reject);
    instance.listen(0, "127.0.0.1", resolve);
  });
  const address = instance.address();
  if (!address || typeof address === "string") throw new Error("No server address");
  return "http://127.0.0.1:" + address.port;
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map(instance => new Promise<void>(resolve => {
    instance.closeAllConnections(); instance.close(() => resolve());
  })));
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("trusted project commands", () => {
  it("recognizes current React refresh injection and Vite timestamped entry", () => {
    const html = '<script type="module">import { injectIntoGlobalHook } from "/@react-refresh"; injectIntoGlobalHook(window);</script><script type="module" src="/@vite/client"></script><script type="module" src="/src/main.tsx?t=1789330250359"></script>';
    expect(htmlEntry(html, true)).toBe("src/main.tsx");
    expect(() => htmlEntry(html)).toThrow();
    expect(() => htmlEntry(html.replace("?t=1789330250359", "?other=1"), true)).toThrow();
  });
  it("waits for an edited entry to reach the existing dev server", async () => {
    const root = await fixture();
    const project = success(await run(root)).project!;
    let entryRequests = 0;
    const url = await server(route => ({text: route === "/"
      ? '<script type="module" src="/src/main.tsx"></script>'
      : ++entryRequests < 3 ? 'old entry' : '@flute ProjectPreview ' + project.projectId}));
    expect(success(await run(root,"open-preview",{url,launch:false})).url).toContain("flute-preview=1");
    expect(entryRequests).toBe(3);
  });

  it("rejects unknown operations and malformed input before any filesystem effect", async () => {
    const scope = vi.spyOn(services, "canonicalRoot");
    for (const operation of [null, {}, "__proto__", "toString", "evaluate-motion"])
      failure(await run("/not-a-project", operation), "invalid-operation");
    failure(await run("/not-a-project", "init-project", { extra: true }), "invalid-input");
    for (const url of ["https://localhost:5173", "http://evil.test", "http://127.0.0.1:5173/path", "http://user@localhost:5173", "http://localhost:5173/?x=1"])
      failure(await run("/not-a-project", "open-preview", { url, launch: false }), "invalid-input");
    expect(scope).not.toHaveBeenCalled();
  });
  it("preserves host providers, source/config/env/lock bytes and stays idempotent across all entry operations", async () => {
    const root = await fixture();
    const names = ["vite.config.ts", ".env", "package-lock.json", "package.json", "index.html"];
    const before = await Promise.all(names.map(name => readFile(path.join(root, name), "utf8")));
    const data = success(await run(root));
    const text = await readFile(path.join(root, "src/main.tsx"), "utf8");
    const id = data.project!.projectId;
    const wrapperStart = '<FluteProjectPreview projectId="' + id + '" enabled={import.meta.env.DEV} hot={import.meta.hot} sceneModules={import.meta.env.DEV ? import.meta.glob("/src/flute/scenes/*.{scene.json,tsx}") : undefined}>{';
    expect(text).toContain(wrapperStart);
    expect(text.replace(/^import \{ ProjectPreview as FluteProjectPreview \} from "@flute\/scene\/preview";\n/, "")
      .replace(wrapperStart, "").replace("}</FluteProjectPreview>", "")).toBe(original);
    expect(success(await run(root)).changed).toBe(false);
    for (const operation of ["load-project", "validate-project"]) expect(success(await run(root, operation)).project).toEqual(data.project);
    expect(await readFile(path.join(root, "src/main.tsx"), "utf8")).toBe(text);
    expect(await Promise.all(names.map(name => readFile(path.join(root, name), "utf8")))).toEqual(before);
    expect(await readdir(path.join(root, ".flute"))).toEqual(["project.json"]);
  });
  it("supports an aliased createRoot and separate top-level root const, including JSX entries", async () => {
    const source = 'import {createRoot as boot} from "react-dom/client";\nconst root = boot(document.getElementById("root"));\nroot.render(<Provider><App /></Provider>);\n';
    const root = await fixture({ source });
    await put(root, "index.html", '<script type="module" src="/src/main.jsx"></script>');
    await put(root, "src/main.jsx", source);
    success(await run(root));
    expect(await readFile(path.join(root, "src/main.jsx"), "utf8")).toContain('{<Provider><App /></Provider>}');
  });
  it.each([
    'import { createRoot } from "react-dom/client"; createRoot(el).render(<App/>); createRoot(el2).render(<App/>);',
    'import { createRoot } from "react-dom/client"; const root=createRoot(el); if (x) root.render(<App/>);',
    'import { createRoot } from "react-dom/client"; const root=createRoot(el); use(root); root.render(<App/>);',
    'import ReactDOM from "react-dom/client"; ReactDOM.createRoot(el).render(<App/>);',
    'import { createRoot } from "react-dom/client"; let root=createRoot(el); root.render(<App/>);',
  ])("refuses ambiguous root syntax before writing", async source => {
    const root = await fixture({ source });
    failure(await run(root), "unsupported-project");
    expect(await readdir(root)).not.toContain(".flute");
    expect(await readFile(path.join(root, "src/main.tsx"), "utf8")).toBe(source);
  });
  it.each([
    ['vite.config.ts', 'export default {base:"/other/"}'],
    ['vite.config.ts', 'export default {root:"nested"}'],
    ['vite.config.ts', 'export default async () => ({})'],
    ['vite.config.ts', 'throw new Error("never execute"); export default {}'],
    ['vite.config.ts', 'export default {...unknown}'],
    ['index.html', '<script type="module" src="/src/main.tsx"></script><script type="module" src="/src/other.tsx"></script>'],
    ['yarn.lock', "conflicting"],
    ['npm-shrinkwrap.json', "{}"],
    ['package.json', '{"dependencies":{"react":"18.3.0","react-dom":"18.3.0","vite":"7.3.6"},"scripts":{"dev":"vite"}}'],
    ['package.json', '{"workspaces":["apps/*"]}'],
  ])("refuses unsupported setup %s before writes", async (file, content) => {
    const root = await fixture();
    await put(root, file, content);
    failure(await run(root), "unsupported-project");
    expect(await readdir(root)).not.toContain(".flute");
  });
  it("reports unpublished/missing package without mutating the app", async () => {
    const root = await fixture({ installed: false });
    failure(await run(root), "package-unavailable");
    expect(await readdir(root)).not.toContain(".flute");
    expect(await readFile(path.join(root, "src/main.tsx"), "utf8")).toBe(original);
  });
  it("does not trust a user manifest without installed package or real integration", async () => {
    const root = await fixture();
    success(await run(root));
    await put(root, "src/main.tsx", original);
    failure(await run(root, "load-project"), "conflict");
    failure(await run(root), "conflict");
    await put(root, "node_modules/@flute/scene/preview.js", "export {}");
    await rm(path.join(root, "node_modules/@flute/scene/preview.js"));
    failure(await run(root, "validate-project"), "conflict");
  });
  it("checks installed preview export on repeat even when state and wrapper exist", async () => {
    const root = await fixture();
    success(await run(root));
    await rm(path.join(root, "node_modules/@flute/scene/preview.js"));
    failure(await run(root, "validate-project"), "missing-installation");
    failure(await run(root), "package-unavailable");
  });
  it.each(["../outside.tsx", ".env.tsx", ".git/secret.tsx", "src/../../outside.tsx"])("denies entry traversal/protected target %s", async entry => {
    const root = await fixture();
    await put(root, "index.html", '<script type="module" src="' + entry + '"></script>');
    failure(await run(root), "denied-path");
    expect(await readdir(root)).not.toContain(".flute");
  });
  it.each([".flute", "src/main.tsx", "package-lock.json", "vite.config.ts", "node_modules/@flute/scene"])("denies symlink targets %s before writing", async target => {
    const root = await fixture();
    const outside = await fixture();
    const destination = [".flute", "node_modules/@flute/scene"].includes(target) ? outside : path.join(outside, "src/main.tsx");
    await rm(path.join(root, target), { recursive: true, force: true });
    await symlink(destination, path.join(root, target));
    failure(await run(root), "denied-path");
    expect(await readFile(path.join(outside, "src/main.tsx"), "utf8")).toBe(original);
  });
  it("denies escaped persisted entry paths and dirty project identity", async () => {
    const root = await fixture();
    const data = success(await run(root));
    await put(root, ".flute/project.json", JSON.stringify({ ...data.project, entry: "../outside.tsx" }));
    failure(await run(root, "load-project"), "denied-path");
    await put(root, ".flute/project.json", JSON.stringify({ ...data.project, projectId: "36c238cf-44e8-43be-b72a-e5196b075598" }));
    failure(await run(root), "conflict");
  });
  it("resumes failed installation through the same pending identity", async () => {
    const root = await fixture({ installed: false });
    await put(root, "flute.tgz", "fixture transport only");
    const install = vi.spyOn(services, "installPackage").mockRejectedValueOnce(new Error("interrupted"));
    failure(await run(root, "init-project", { packageSource: "./flute.tgz" }), "project-error");
    const pending = JSON.parse(await readFile(path.join(root, ".flute/pending.json"), "utf8"));
    expect(await readFile(path.join(root, "src/main.tsx"), "utf8")).toBe(original);
    install.mockImplementation(async project => installFixture(project));
    const resumed = success(await run(root, "init-project", { packageSource: "./flute.tgz" }));
    expect(resumed.project).toEqual(pending.project);
    expect(install).toHaveBeenCalledTimes(2);
    expect(success(await run(root)).changed).toBe(false);
  });
  it("resumes an interruption between entry and state writes without duplicate wrapping", async () => {
    const root = await fixture();
    const write = services.atomicWrite;
    vi.spyOn(services, "atomicWrite").mockImplementation(async (...args) => {
      if (args[1] === ".flute/project.json") throw new Error("interrupted");
      return write(...args);
    });
    failure(await run(root), "project-error");
    const transformed = await readFile(path.join(root, "src/main.tsx"), "utf8");
    vi.restoreAllMocks();
    success(await run(root));
    expect(await readFile(path.join(root, "src/main.tsx"), "utf8")).toBe(transformed);
    expect(success(await run(root)).changed).toBe(false);
  });
  it("refuses dirty source after an interrupted write, then recovers when restored", async () => {
    const root = await fixture();
    const write = services.atomicWrite;
    vi.spyOn(services, "atomicWrite").mockImplementation(async (...args) => {
      if (args[1] === "src/main.tsx") throw new Error("interrupted");
      return write(...args);
    });
    failure(await run(root), "project-error");
    vi.restoreAllMocks();
    await put(root, "src/main.tsx", original + "// new edit\n");
    failure(await run(root), "conflict");
    await put(root, "src/main.tsx", original);
    success(await run(root));
  });
  it("refuses changed files in atomic mutation instead of overwriting them", async () => {
    const root = await fixture();
    await expect(services.atomicWrite(root, "src/main.tsx", "replacement", "stale")).rejects.toMatchObject({ code: "conflict" });
    expect(await readFile(path.join(root, "src/main.tsx"), "utf8")).toBe(original);
  });
  it("verifies dev entry identity, preserves the origin and optionally opens only that preview", async () => {
    const root = await fixture();
    const project = success(await run(root)).project!;
    const url = await server(route => ({ text: route === "/"
      ? '<script type="module" src="/@vite/client"></script><script type="module">import RefreshRuntime from "/@react-refresh";</script><script type="module" src="/src/main.tsx"></script>'
      : 'import {ProjectPreview} from "/node_modules/.vite/deps/@flute_scene_preview.js"; const projectId="' + project.projectId + '";' }));
    const open = vi.spyOn(services, "openBrowser").mockResolvedValue();
    expect(success(await run(root, "open-preview", { url, launch: false })).url).toBe(url + "/?flute-preview=1");
    expect(open).not.toHaveBeenCalled();
    success(await run(root, "open-preview", { url, launch: true }));
    expect(open).toHaveBeenCalledWith(await services.canonicalRoot(root), url + "/?flute-preview=1");
  });
  it.each(["wrong-entry", "wrong-id", "redirect", "too-large", "missing"])("rejects %s dev server without opening a browser", async kind => {
    const root = await fixture();
    success(await run(root));
    const url = await server(route => kind === "redirect" ? { status: 302, headers: { location: "http://example.com" } }
      : kind === "too-large" ? { text: "x".repeat(2_000_001) }
      : { text: route === "/" ? '<script type="module" src="/src/' + (kind === "wrong-entry" ? "other" : "main") + '.tsx"></script>' : "wrong project" });
    if (kind === "missing") await new Promise<void>(resolve => servers[0].close(() => resolve()));
    const open = vi.spyOn(services, "openBrowser").mockResolvedValue();
    const result = await run(root, "open-preview", { url });
    failure(result, "missing-dev-server");
    expect(JSON.stringify(result)).toContain("npm run dev");
    expect(open).not.toHaveBeenCalled();
  });
  it("preserves entry directives and refuses type-only React imports", () => {
    const id = "36c238cf-44e8-43be-b72a-e5196b075598";
    const source = '"use client";\n' + original;
    const adapted = inspectEntry(source, "main.tsx", id).text;
    expect(adapted.startsWith('"use client";\n')).toBe(true);
    expect(inspectEntry(adapted, "main.tsx", id).integrated).toBe(true);
    expect(() => inspectEntry(original.replace('import { createRoot }', 'import type { createRoot }'), "main.tsx", id)).toThrow();
  });
  it("rejects an unquoted extra module entry instead of overlooking ambiguity", async () => {
    const root = await fixture();
    await put(root, "index.html", '<script type="module" src="/src/main.tsx"></script><script type=module src="/src/other.tsx"></script>');
    failure(await run(root), "unsupported-project");
    expect(await readdir(root)).not.toContain(".flute");
  });
  it("repairs a partial package install on a pending retry with an explicit tarball", async () => {
    const root = await fixture({ installed: false });
    await put(root, "flute.tgz", "fixture transport only");
    const install = vi.spyOn(services, "installPackage").mockImplementationOnce(async project => {
      await put(project, "node_modules/@flute/scene/package.json", '{');
      throw new Error("interrupted install");
    });
    failure(await run(root, "init-project", { packageSource: "./flute.tgz" }), "project-error");
    install.mockImplementation(async project => installFixture(project));
    success(await run(root, "init-project", { packageSource: "./flute.tgz" }));
    expect(success(await run(root)).changed).toBe(false);
  });
  it("finishes cleanup after state was committed but journal removal was interrupted", async () => {
    const root = await fixture();
    vi.spyOn(services, "removeText").mockRejectedValueOnce(new Error("interrupted cleanup"));
    failure(await run(root), "project-error");
    failure(await run(root, "load-project"), "incomplete-setup");
    vi.restoreAllMocks();
    success(await run(root));
    expect(success(await run(root)).changed).toBe(false);
  });
  it("rejects altered gate, duplicate wrappers and shadowed names", () => {
    const id = "36c238cf-44e8-43be-b72a-e5196b075598";
    const adapted = inspectEntry(original, "main.tsx", id).text;
    expect(() => inspectEntry(adapted.replace("import.meta.env.DEV", "true"), "main.tsx", id)).toThrow();
    expect(() => inspectEntry(adapted + "\nconst stolen = FluteProjectPreview;", "main.tsx", id)).toThrow();
    expect(() => inspectEntry(original + "\nfunction another(createRoot: unknown) {}", "main.tsx", id)).toThrow();
  });
});
