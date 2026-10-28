import { isBuiltin } from "node:module";

const JS_SCANNER = new Bun.Transpiler({ loader: "js" });

export function scanSpecifiers(code: string): string[] {
  return JS_SCANNER.scanImports(code).map((entry) => entry.path);
}

export const CLI_SHEBANG = "#!/usr/bin/env bun";

/** The CLI ships as one self-contained file: shebang, no chunks, only runtime built-ins. */
export function checkCliBundle(code: string): string[] {
  const problems: string[] = [];
  if (!code.startsWith(`${CLI_SHEBANG}\n`)) problems.push(`cli.js must start with "${CLI_SHEBANG}"`);
  for (const specifier of scanSpecifiers(code.replace(/^#!.*/, ""))) {
    if (!isBuiltin(specifier) && specifier !== "bun" && !specifier.startsWith("bun:")) {
      problems.push(`cli.js imports "${specifier}"; the CLI may only use runtime built-ins`);
    }
  }
  return problems;
}
