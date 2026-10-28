#!/usr/bin/env bun
import { run } from "./index";

const code = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
process.exit(code);
