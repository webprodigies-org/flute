import { executeProjectCommand } from "../project/commands";
import type { ProjectResult } from "../core/project";

/** SOURCE OF TRUTH: runCli adapter.
 * WHAT: translate terminal arguments into canonical project operations and format results.
 * WHY: installation policy and side effects remain behind the project command boundary.
 * WHERE: cli/main invokes this adapter; project/commands validates and executes requests.
 */
type Environment = { root: string; port?: string };
type Execute = typeof executeProjectCommand;
export type CliResult = { code: number; stdout: string; stderr: string };
const usage = `Flute — install a live scene preview in a Vite React project.

flute init [--project DIR] [--package TARBALL] [--url ORIGIN] [--no-open]
flute open [--project DIR] [--url ORIGIN] [--no-open]
flute load [--project DIR]
flute validate [--project DIR]

init preserves the existing root/providers. Add --url to initialize and open in one command.
open reuses your running dev server (APP_PORT / PORT / 5173); it never starts another server.
--no-open verifies and prints the preview URL without launching a browser.
--json prints the canonical command result for scripts.
`;
function output(result: ProjectResult, json: boolean): CliResult {
  if (!result.success) return { code: 1, stdout: "", stderr: json ? JSON.stringify(result) + "\n" : result.issues.map(i => `${i.code}: ${i.message}`).join("\n") + "\n" };
  const message = result.data.url ?? (result.data.project
    ? `Project ready: ${result.data.project.entry}${result.data.changed ? " (initialized)" : ""}.\nRun your existing dev server, then flute open --url http://127.0.0.1:PORT.`
    : "Project command completed.");
  return { code: 0, stdout: (json ? JSON.stringify(result) : message) + "\n", stderr: "" };
}
export async function runCli(argv: string[], environment: Environment, execute: Execute = executeProjectCommand): Promise<CliResult> {
  if (argv.length === 0 || (argv.length === 1 && ["--help", "-h", "help"].includes(argv[0])))
    return { code: 0, stdout: usage, stderr: "" };
  const [command, ...args] = argv;
  const aliases = { init: "init-project", open: "open-preview", load: "load-project", validate: "validate-project" } as const;
  const fail = (message: string): CliResult => ({ code: 2, stdout: "", stderr: message + "\n\n" + usage });
  if (!Object.hasOwn(aliases, command)) return fail(`Unknown command: ${command}`);
  const flags = new Map<string, string | true>();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!["--project", "--package", "--url", "--no-open", "--json"].includes(flag)) return fail(`Unknown option: ${flag}`);
    if (flags.has(flag)) return fail(`Duplicate option: ${flag}`);
    if (["--no-open", "--json"].includes(flag)) flags.set(flag, true);
    else {
      const value = args[++i];
      if (!value || value.startsWith("--")) return fail(`Missing value for ${flag}`);
      flags.set(flag, value);
    }
  }
  if (flags.has("--package") && command !== "init") return fail("--package is only valid for init.");
  if (["load", "validate"].includes(command) && (flags.has("--url") || flags.has("--no-open"))) return fail("Preview options require init or open.");
  const context = { root: flags.get("--project") as string ?? environment.root };
  const json = flags.has("--json");
  const input = command === "init" ? { ...(flags.has("--package") ? { packageSource: flags.get("--package") } : {}) }
    : command === "open" ? { url: flags.get("--url") ?? `http://127.0.0.1:${environment.port ?? "5173"}`, launch: !flags.has("--no-open") } : {};
  try {
    const result = await execute(aliases[command as keyof typeof aliases], input, context);
    if (!result.success || command !== "init" || !flags.has("--url")) return output(result, json);
    return output(await execute("open-preview", { url: flags.get("--url"), launch: !flags.has("--no-open") }, context), json);
  } catch {
    return {code:1,stdout:"",stderr:"Project command failed unexpectedly. Your setup may be incomplete; run flute validate, correct the reported issue and retry.\n"};
  }
}
