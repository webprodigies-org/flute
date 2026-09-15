#!/usr/bin/env node
import { runCli } from "./index";
// Injected from package.json by the CLI build; never maintain a second version literal.
declare const __FLUTE_VERSION__: string;
const interactive = !!process.stdout.isTTY && process.env.TERM !== "dumb";
const colorDepth = interactive && process.env.NO_COLOR === undefined && process.env.FORCE_COLOR !== "0"
  ? process.stdout.getColorDepth() : 0;
const result = await runCli(process.argv.slice(2), {
  root: process.cwd(),
  terminal: {interactive, colorDepth, columns:process.stdout.columns, unicode:process.env.TERM !== "dumb", version:__FLUTE_VERSION__},
  ...(interactive ? {progress:(text: string) => process.stdout.write(text)} : {}),
  port: process.env.APP_PORT ?? process.env.PORT,
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.code;
