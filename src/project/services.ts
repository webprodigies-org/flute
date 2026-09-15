import { createRequire } from "node:module";
import { constants } from "node:fs";
import { lstat, realpath, open, opendir, mkdir, rename, link, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fault } from "./errors";

/** SOURCE OF TRUTH: scoped project effects.
 * WHAT: bounded filesystem, npm, HTTP and browser transports.
 * WHY: commands own policy; adapters never acquire direct host access.
 * WHERE: commands.ts supplies explicit canonical roots and relative targets.
 */
export async function canonicalRoot(root: string): Promise<string> {
  if (typeof root !== "string" || !path.isAbsolute(root) || root.includes("\0"))
    throw fault("invalid-scope", "Provide an absolute local project directory.");
  const canonical = await realpath(root);
  if (!(await lstat(canonical)).isDirectory()) throw fault("invalid-scope", "Project root must be a directory.");
  return canonical;
}
export function relativeTarget(target: string): string {
  const parts = target.split("/");
  if (!target || path.isAbsolute(target) || target.includes("\\") || target.includes("\0")
    || parts.some(part => !part || part === "." || part === ".." || part === ".git"
      || part === ".agents" || part === ".codex" || part.startsWith(".env")))
    throw fault("denied-path", "Use a project-relative path outside protected files.", target);
  return target;
}
export async function scopedPath(root: string, target: string): Promise<string> {
  relativeTarget(target);
  let current = root;
  for (const part of target.split("/")) {
    current = path.join(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw fault("denied-path", "Symlinked project targets are unsupported.", target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return current;
}
export async function readText(root: string, target: string, maxBytes = 2_000_000): Promise<string | undefined> {
  const filename = await scopedPath(root, target);
  let handle;
  try {
    handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 2_000_000)
      throw fault("invalid-input", "Read limit must be between 1 and 2000000 bytes.", target);
    if (!stat.isFile() || stat.size > maxBytes) throw fault("invalid-file", `Expected a regular project file at most ${maxBytes} bytes.`, target);
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > maxBytes) throw fault("invalid-file", `Project file exceeded ${maxBytes} bytes while reading.`, target);
    return buffer.subarray(0, length).toString("utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  } finally { await handle?.close(); }
}
// Bounded, nonrecursive transport only; commands choose directories, limits and eligible files.
export async function scanDirectory(root: string, target: string, maxEntries: number): Promise<string[]> {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 1024)
    throw fault("invalid-input", "Directory limit must be between 1 and 1024 entries.", target);
  const filename = await scopedPath(root, target);
  let directory;
  try { directory = await opendir(filename); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const entries: string[] = [];
  for await (const entry of directory) {
    if (entries.length >= maxEntries) throw fault("invalid-file", `Directory exceeds ${maxEntries} entries; reduce its size and retry.`, target);
    entries.push(`${target}/${entry.name}`);
  }
  return entries.sort();
}
export async function isRegularFile(root: string, target: string): Promise<boolean> {
  const filename = await scopedPath(root, target);
  try { return (await lstat(filename)).isFile(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
export async function atomicWrite(root: string, target: string, content: string, expected: string | undefined) {
  const filename = await scopedPath(root, target);
  if (await readText(root, target) !== expected) throw fault("conflict", "Project file changed during setup; retry after reviewing it.", target);
  await mkdir(path.dirname(filename), { recursive: true });
  await scopedPath(root, target);
  const temporary = target + "." + randomUUID() + ".tmp";
  const temporaryPath = await scopedPath(root, temporary);
  const handle = await open(temporaryPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    if (await readText(root, target) !== expected) throw fault("conflict", "Project file changed during setup.", target);
    const destination = await scopedPath(root, target);
    // Create-only writes must not replace a file that appears after the last read.
    if (expected === undefined) {
      try { await link(temporaryPath, destination); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST")
          throw fault("conflict", "Project file appeared during setup; review it before retrying.", target);
        throw error;
      }
    } else await rename(temporaryPath, destination);
  } finally {
    await handle.close();
    await unlink(temporaryPath).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
}
export async function removeText(root: string, target: string, expected: string) {
  if (await readText(root, target) !== expected) throw fault("conflict", "Pending setup changed; review before retrying.", target);
  await unlink(await scopedPath(root, target));
}
export function newProjectId() { return randomUUID(); }

function run(root: string, executable: string, args: string[], timeout = 120_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: root, shell: false, stdio: "ignore" });
    const timer = setTimeout(() => { child.kill(); reject(fault("process-failed", "Local process timed out; retry after checking the project.")); }, timeout);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(fault("process-failed", "Local process failed; check npm installation and retry."));
    });
  });
}
export async function installPackage(root: string, source: string) {
  await run(root, process.platform === "win32" ? "npm.cmd" : "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--", source]);
}
export async function fetchText(url: string, timeoutMs = 3000): Promise<string> {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok || Number(response.headers.get("content-length") ?? 0) > 2_000_000) {
    await response.body?.cancel();
    throw fault("missing-dev-server", "Dev server did not return a supported response.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw fault("missing-dev-server", "Dev server returned no content.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > 2_000_000) throw fault("missing-dev-server", "Dev server response exceeded 2 MB.");
      chunks.push(next.value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString("utf8");
}
export async function openBrowser(root: string, url: string) {
  if (process.platform === "darwin") await run(root, "open", [url], 10_000);
  else if (process.platform === "win32") await run(root, "rundll32", ["url.dll,FileProtocolHandler", url], 10_000);
  else await run(root, "xdg-open", [url], 10_000);
}

export async function localPackageSource(root: string, source: string): Promise<string> {
  const filename = path.isAbsolute(source) ? source : await scopedPath(root, source.replace(/^\.\//, ""));
  const stat = await lstat(filename).catch(error => {
    if (error.code === "ENOENT") throw fault("package-unavailable", "Local Flute tarball was not found. Correct --package to an existing .tgz file, or install @webprodigies/flute locally and run npx flute init.", source);
    throw error;
  });
  if (!stat.isFile() || stat.isSymbolicLink()) throw fault("denied-path", "Package source must be a regular local tarball.");
  return realpath(filename);
}

export function pause(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** Read-only dependency resolution; hoisted and pnpm-linked packages are not mutation targets. */
export async function readDependency(root:string,name:string,target="package.json"):Promise<string|undefined> {
  if (!["react","react-dom","@webprodigies/flute"].includes(name)) throw fault("invalid-input","Unknown runtime dependency.");
  relativeTarget(target);
  const candidates=createRequire(path.join(root,"package.json")).resolve.paths(name)??[];
  for(const modules of candidates) {
    let directory:string;
    try { directory=await realpath(path.join(modules,name)); }
    catch(error) { if((error as NodeJS.ErrnoException).code==="ENOENT")continue;throw error; }
    return readText(directory,target);
  }
  return undefined;
}
