import { FLUTE_BRAND } from "../core/branding";
import type { ProjectResult } from "../core/project";

/** SOURCE OF TRUTH: terminal presentation, Amethyst onboarding.
 * WHAT: render the approved wordmark and confirmed project results for human readers.
 * WHY: presentation never guesses setup progress, framework policy, URLs or agent instructions.
 * WHERE: runCli supplies canonical results; main supplies terminal capabilities and package version.
 */
export type TerminalOptions = { interactive?: boolean; colorDepth?: number; columns?: number; unicode?: boolean; version?: string };
const wordmark = `███████╗██╗     ██╗   ██╗████████╗███████╗
██╔════╝██║     ██║   ██║╚══██╔══╝██╔════╝
█████╗  ██║     ██║   ██║   ██║   █████╗  
██╔══╝  ██║     ██║   ██║   ██║   ██╔══╝  
██║     ███████╗╚██████╔╝   ██║   ███████╗
╚═╝     ╚══════╝ ╚═════╝    ╚═╝   ╚══════╝`;
// Strip terminal control sequences from host-derived strings before applying our own ANSI.
export function terminalText(value: string): string {
  return value.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
}
function palette(options: TerminalOptions) {
  const colors = { face: ["38;2;230;215;255", "38;5;189", "97"], shadow: ["38;2;120;96;151", "38;5;103", "35"], accent: ["38;2;191;161;255", "38;5;183", "95"], quiet: ["38;2;170;160;185", "38;5;247", "37"] };
  return (text: string, role: keyof typeof colors) => {
    const depth = options.colorDepth ?? 0;
    return depth >= 4 ? `\x1b[${colors[role][depth >= 24 ? 0 : depth >= 8 ? 1 : 2]}m${text}\x1b[0m` : text;
  };
}
export function terminalWelcome(options: TerminalOptions = {}): string {
  const paint = palette(options);
  const large = options.interactive && options.unicode !== false && (options.columns ?? 80) >= 44;
  const title = large
    ? wordmark.split("\n").map(line => "  " + line.split(/([╔╗╚╝═║]+)/).map(part => paint(part, /^[╔╗╚╝═║]+$/.test(part) ? "shadow" : "face")).join("")).join("\n")
    : paint(FLUTE_BRAND.name, "face");
  return `\n${title}\n\n${paint(FLUTE_BRAND.title, "accent")}  ${paint("v" + (options.version ?? "development"), "quiet")}\n${paint(FLUTE_BRAND.url, "quiet")}\n\nTurn your React UI into cinematic 3D mockups.\n\n`;
}
export function formatOnboarding(result: Extract<ProjectResult, { success: true }>, options: TerminalOptions = {}, includeWelcome = true): string {
  const { project, changed, integration, handoff, url } = result.data;
  const paint = palette(options);
  const tick = options.unicode === false ? "+" : "✓";
  const width = options.interactive ? Math.max(20, (options.columns ?? 80) - 4) : Infinity;
  const line = (value: string, role?: "accent" | "quiet") => {
    const clean = terminalText(value);
    const wrapped = clean.split("\n").map(part => {
      if (!Number.isFinite(width)) return part;
      const lines: string[] = [];
      while (part.length > width) {
        let end = part.lastIndexOf(" ", width);
        if (end <= 0) end = width;
        lines.push(part.slice(0, end)); part = part.slice(end).trimStart();
      }
      return [...lines, part].join("\n");
    }).join("\n");
    return role ? paint(wrapped, role) : wrapped;
  };
  const step = (label: string, detail?: string) => `${paint(tick, "accent")} ${line(label)}${detail ? "\n  " + line(detail, "quiet") : ""}`;
  const kind = integration?.kind ?? project?.adapter;
  const host = kind === "next-app" ? "Next.js · App Router" : kind === "next-pages" ? "Next.js · Pages Router" : kind === "react" ? "React · Custom renderer" : "React · Vite";
  const rows = [step("Detected " + host)];
  if (project) rows.push(step(changed ? "Added your development connection" : "Verified your existing connection", integration?.route ?? integration?.component ?? project.entry));
  if (handoff) rows.push(step("Scene source location", "src/flute/scenes"), step("AI guide ready", handoff.path));
  const next = [line(kind === "react" ? "One connection left. Your coding agent can handle it." : "Ready. Your first scene starts with a prompt.", "accent")];
  if (handoff) next.push(line("1  Tell your coding agent (replace <page route or component path>):"), line(handoff.prompt));
  next.push(line("2  Keep your app running, or start it with npm run dev."));
  next.push(line(url ? `3  Open your studio: ${url}` : kind === "react"
    ? "3  Open the preview link your agent gives you after connecting the wrapper."
    : "3  Run npx flute open --url <origin printed by your app>."));
  if (integration) next.push(line(integration.instructions, "quiet"));
  next.push(line("Scene authoring reference: npx flute guide", "quiet"));
  return (includeWelcome ? terminalWelcome(options) : "\n") + rows.join("\n") + "\n\n" + next.join("\n\n") + "\n\n";
}
