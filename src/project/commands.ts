import { z } from "zod";
import { RESOURCES } from "../core/resources";
import { ProjectResultSchema, ProjectStateSchema, type ProjectResult, type ProjectState } from "../core/project";
import * as services from "./services";
import { fault } from "./errors";
import { htmlEntry, inspectConfig, inspectEntry } from "./vite";

/** SOURCE OF TRUTH: executeProjectCommand trusted project operations.
 * WHAT: validate RESOURCES inputs, host compatibility, integration identity and recovery state.
 * WHY: CLI and later adapters share policy before any scoped mutation.
 * WHERE: core/project owns public contracts; vite owns pure source adaptation; services owns effects.
 */
const PackageSchema = z.object({
  name: z.string().optional(), version: z.string().optional(), packageManager: z.string().optional(),
  workspaces: z.unknown().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  exports: z.unknown().optional(),
});
const PendingSchema = z.strictObject({ project: ProjectStateSchema, original: z.string() });
const statePath = ".flute/project.json";
const pendingPath = ".flute/pending.json";
const configs = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs", "vite.config.cts", "vite.config.cjs"];
const locks = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"];
function decode<T>(text: string, schema: z.ZodType<T>, target: string): T {
  try { return schema.parse(JSON.parse(text)); }
  catch { throw fault("invalid-file", "Invalid or conflicting project metadata; review " + target + ".", target); }
}
async function packageAt(root: string, target: string) {
  const source = await services.readText(root, target);
  return source === undefined ? undefined : decode(source, PackageSchema, target);
}
async function inspectProject(root: string) {
  // Preflight every mutation/config target, including unused conflicting lock/config candidates.
  for (const target of [statePath, pendingPath, "package.json", ...locks, ...configs, "node_modules/@flute/scene/package.json"])
    await services.scopedPath(root, target);
  const pkg = await packageAt(root, "package.json");
  if (!pkg) throw fault("unsupported-project", "Choose an existing npm Vite React project containing package.json.");
  if (pkg.workspaces !== undefined || (pkg.packageManager && !/^npm@\d/.test(pkg.packageManager)))
    throw fault("unsupported-project", "Automatic setup supports a single-root npm project; adapt this package manager/workspace manually.");
  const existingLocks: string[] = [];
  for (const target of locks) if (await services.readText(root, target) !== undefined) existingLocks.push(target);
  if (existingLocks.some(lock => !["package-lock.json", "npm-shrinkwrap.json"].includes(lock)) || existingLocks.length > 1)
    throw fault("unsupported-project", "Resolve conflicting or non-npm lockfiles before setup.");
  const dependencies = { ...pkg.devDependencies, ...pkg.dependencies };
  if (!dependencies.vite || !/^([~^])?19\.2\.\d+$/.test(dependencies.react ?? "")
    || !/^([~^])?19\.2\.\d+$/.test(dependencies["react-dom"] ?? "")
    || !/^vite(?:\s+--host(?:[ =](?:localhost|127\.0\.0\.1|\[::1\]))?)?(?:\s+--port[ =]\d+)?(?:\s+--strictPort)?$/.test(pkg.scripts?.dev ?? ""))
    throw fault("unsupported-project", "Automatic setup requires React/react-dom 19.2.x, Vite and a standard npm dev script (vite).");
  const found: string[] = [];
  for (const target of configs) {
    const source = await services.readText(root, target);
    if (source !== undefined) { found.push(target); inspectConfig(source, target); }
  }
  if (found.length > 1) throw fault("unsupported-project", "Multiple Vite configuration files are ambiguous.");
  const html = await services.readText(root, "index.html");
  if (html === undefined) throw fault("unsupported-project", "Expected index.html at the project root.");
  const entry = services.relativeTarget(htmlEntry(html));
  const source = await services.readText(root, entry);
  if (source === undefined) throw fault("unsupported-project", "The index.html module entry is missing.", entry);
  return { entry, source, pkg };
}
async function installationValid(root: string, requireToolkit = true) {
  const pkg = await packageAt(root, "package.json");
  for (const name of ["react", "react-dom"]) {
    const installed = await packageAt(root, "node_modules/" + name + "/package.json");
    if (!installed?.version || !/^19\.2\.\d+$/.test(installed.version))
      throw fault("missing-installation", "Install this project's React 19.2 dependencies with npm, then retry.");
  }
  const toolkit = await packageAt(root, "node_modules/@flute/scene/package.json");
  if (!toolkit) {
    if (requireToolkit) throw fault("missing-installation", "Flute is not installed. Run init with --package-source pointing to a local Flute tarball.");
    return false;
  }
  if (toolkit.name !== "@flute/scene" || !(pkg?.dependencies?.["@flute/scene"] || pkg?.devDependencies?.["@flute/scene"]))
    throw fault("conflict", "Flute installation must match a declared @flute/scene dependency.");
  const exports = toolkit.exports;
  const preview = exports && typeof exports === "object" && !Array.isArray(exports) ? (exports as Record<string, unknown>)["./preview"] : undefined;
  const target = typeof preview === "string" ? preview
    : preview && typeof preview === "object" && !Array.isArray(preview) ? (preview as Record<string, unknown>).import : undefined;
  if (typeof target !== "string" || !target.startsWith("./")
    || await services.readText(root, "node_modules/@flute/scene/" + target.slice(2)) === undefined)
    throw fault("missing-installation", "Installed @flute/scene lacks the preview entry. Install the supported Flute package and retry.");
  return true;
}
async function sourceForInstall(root: string, source: string | undefined) {
  if (!source) throw fault("package-unavailable", "Flute is not published yet. Supply --package-source with a local Flute .tgz package, or install @flute/scene first.");
  if (!source.endsWith(".tgz") || source.startsWith("-") || source.includes("://"))
    throw fault("invalid-input", "Package source must be an explicit local .tgz file.");
  return services.localPackageSource(root, source);
}
async function stateFor(root: string) {
  const text = await services.readText(root, statePath);
  return { text, project: text === undefined ? undefined : decode(text, ProjectStateSchema, statePath) };
}
function checkState(project: ProjectState, entry: string) {
  services.relativeTarget(project.entry);
  if (project.entry !== entry) throw fault("conflict", "Recorded Flute entry differs from index.html; review the integration.", statePath);
}
async function initialize(root: string, packageSource: string | undefined): Promise<ProjectResult> {
  const host = await inspectProject(root);
  const saved = await stateFor(root);
  const pendingText = await services.readText(root, pendingPath);
  const pending = pendingText === undefined ? undefined : decode(pendingText, PendingSchema, pendingPath);
  if (saved.project) checkState(saved.project, host.entry);
  if (pending) {
    checkState(pending.project, host.entry);
    if (saved.project && saved.project.projectId !== pending.project.projectId)
      throw fault("conflict", "Pending setup belongs to another project identity.", pendingPath);
  }
  const project = saved.project ?? pending?.project ?? ProjectStateSchema.parse({
    version: 1, projectId: services.newProjectId(), entry: host.entry, packageManager: "npm",
  });
  const adapted = inspectEntry(host.source, host.entry, project.projectId);
  if (pending) {
    const planned = inspectEntry(pending.original, host.entry, project.projectId);
    if ((planned.integrated && !saved.project) || (host.source !== pending.original && host.source !== planned.text))
      throw fault("conflict", "Entry changed during interrupted setup; restore the pending original or complete integration before retrying.", host.entry);
  } else if (saved.project && !adapted.integrated) {
    throw fault("conflict", "Recorded project no longer contains its Flute integration; review entry changes.", host.entry);
  }
  let installed = false;
  try { installed = await installationValid(root); }
  catch (error) {
    if (!(error instanceof Error) || !("code" in error)
      || !["missing-installation", ...(pending ? ["conflict", "invalid-file"] : [])].includes(String(error.code))) throw error;
  }
  const installSource = installed ? undefined : await sourceForInstall(root, packageSource);
  if (saved.project && adapted.integrated && !pending && installed)
    return { success: true, data: { project, changed: false } };
  const journal = pendingText ?? JSON.stringify({ project, original: host.source }, null, 2) + "\n";
  if (!pendingText) await services.atomicWrite(root, pendingPath, journal, undefined);
  if (installSource) {
    await services.installPackage(root, installSource);
    await installationValid(root);
  }
  // Recheck host/config after npm, which may have changed files or been interrupted.
  const after = await inspectProject(root);
  if (after.entry !== host.entry || after.source !== host.source)
    throw fault("conflict", "Project entry changed during installation; retry after reviewing it.", host.entry);
  if (!adapted.integrated) await services.atomicWrite(root, host.entry, adapted.text, host.source);
  const state = JSON.stringify(project, null, 2) + "\n";
  if (!saved.project) await services.atomicWrite(root, statePath, state, saved.text);
  await services.removeText(root, pendingPath, journal);
  return { success: true, data: { project, changed: true } };
}
async function load(root: string) {
  const host = await inspectProject(root);
  const saved = await stateFor(root);
  if (!saved.project) throw fault("not-initialized", "Run flute init in this project first.");
  checkState(saved.project, host.entry);
  if (await services.readText(root, pendingPath) !== undefined)
    throw fault("incomplete-setup", "Setup was interrupted. Run flute init again to resume safely.");
  if (!inspectEntry(host.source, host.entry, saved.project.projectId).integrated)
    throw fault("conflict", "The recorded Flute integration is missing.", host.entry);
  await installationValid(root);
  return saved.project;
}
async function openPreview(root: string, input: z.output<typeof RESOURCES["open-preview"]>) {
  const project = await load(root);
  try {
    const html = await services.fetchText(input.url);
    const entry = services.relativeTarget(htmlEntry(html, true));
    if (entry !== project.entry) throw fault("wrong-dev-server", "The dev server belongs to another entry.");
    const transformed = await services.fetchText(new URL("/" + entry, input.url).href);
    if (!transformed.includes(project.projectId) || !transformed.includes("@flute") || !transformed.includes("ProjectPreview"))
      throw fault("wrong-dev-server", "Dev server does not contain this project's preview identity.");
  } catch {
    throw fault("missing-dev-server", "No matching Vite dev server at " + input.url + ". Run npm run dev in this project, then retry with its loopback URL. Flute will not start another server or change its port.");
  }
  const url = new URL("/?flute-preview=1", input.url).href;
  if (input.launch) await services.openBrowser(root, url);
  return { success: true as const, data: { project, url } };
}
export async function executeProjectCommand(operation: unknown, input: unknown, context: { root: string }): Promise<ProjectResult> {
  try {
    if (typeof operation !== "string" || !Object.hasOwn(RESOURCES, operation))
      throw fault("invalid-operation", "Unknown project operation.");
    const schema = RESOURCES[operation as keyof typeof RESOURCES];
    if (!("safeParse" in schema)) throw fault("invalid-operation", "This operation is not a project command.");
    const parsed = schema.safeParse(input);
    if (!parsed.success) return ProjectResultSchema.parse({ success: false, issues: parsed.error.issues.map(issue => ({
      code: "invalid-input", message: issue.message, path: issue.path.join("."),
    })) });
    if (!context || typeof context.root !== "string") throw fault("invalid-scope", "Provide an absolute local project root.");
    const root = await services.canonicalRoot(context.root);
    let result: ProjectResult;
    if (operation === "init-project") result = await initialize(root, (parsed.data as z.output<typeof RESOURCES["init-project"]>).packageSource);
    else if (operation === "open-preview") result = await openPreview(root, parsed.data as z.output<typeof RESOURCES["open-preview"]>);
    else result = { success: true, data: { project: await load(root) } };
    return ProjectResultSchema.parse(result);
  } catch (error) {
    const known = error instanceof Error && "code" in error && "target" in error;
    return { success: false, issues: [{
      code: known ? String(error.code) : "project-error",
      message: known ? error.message : "Unable to access the project. Check local files and permissions, then retry.",
      ...(known && typeof error.target === "string" ? { path: error.target } : {}),
    }] };
  }
}
