import { describe, expect, test } from "bun:test";
import { checkCliBundle, CLI_SHEBANG, scanSpecifiers } from "../scripts/dist-check";

describe("scanSpecifiers", () => {
  test("scans static, re-export and dynamic imports", () => {
    expect(scanSpecifiers('import "./a.js"; export * from "./b.js"; import("./c.js");')).toEqual([
      "./a.js",
      "./b.js",
      "./c.js",
    ]);
  });
});

describe("checkCliBundle", () => {
  test("accepts a shebang bundle that only imports runtime built-ins", () => {
    const code = `${CLI_SHEBANG}\n// @bun\nimport { join } from "path";\nimport { readFile } from "node:fs/promises";\nimport { $ } from "bun";\nimport { test } from "bun:test";\n`;
    expect(checkCliBundle(code)).toEqual([]);
  });

  test("rejects a missing shebang and npm imports", () => {
    expect(checkCliBundle('import { cn } from "clsx";\n')).toEqual([
      `cli.js must start with "${CLI_SHEBANG}"`,
      'cli.js imports "clsx"; the CLI may only use runtime built-ins',
    ]);
  });
});
