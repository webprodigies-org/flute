#!/usr/bin/env node
import { runCli } from "./index";
const result = await runCli(process.argv.slice(2), {
  root: process.cwd(),
  port: process.env.APP_PORT ?? process.env.PORT,
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.code;
