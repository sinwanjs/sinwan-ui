import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { preProcessFile } from "typescript";
import { findCssImports, stripTailwindSources } from "../src/build/scan-css";
import { findModuleSpecifiers, scanModule } from "../src/build/scan-module";

function specifiers(source: string): string[] {
  const found = findModuleSpecifiers(source);
  for (const occurrence of found) expect(source.slice(occurrence.start, occurrence.end)).toBe(occurrence.specifier);
  return found.map((occurrence) => occurrence.specifier);
}

describe("findModuleSpecifiers", () => {
  test("finds value, type-only, side-effect, re-export and dynamic specifiers", () => {
    const source = [
      `import Default from "default";`,
      `import * as ns from 'namespace';`,
      `import Both, { named } from "both";`,
      `import type { A } from "type-only";`,
      `import { type B, C } from "inline-type";`,
      `import "side-effect";`,
      `import json from "./data.json" with { type: "json" };`,
      `export * from "star";`,
      `export * as starNs from "star-ns";`,
      `export { default, x as y } from "reexport";`,
      `export type { F } from "type-reexport";`,
      `export { from } from "named-from";`,
      `const lazy = import("dynamic");`,
      `const withOptions = import("dynamic-options", { with: { type: "json" } });`,
      `type T = typeof import("type-import");`,
      "type U = import(`template-type`).U;",
      `declare module "ambient" {}`,
    ].join("\n");
    expect(specifiers(source)).toEqual([
      "default",
      "namespace",
      "both",
      "type-only",
      "inline-type",
      "side-effect",
      "./data.json",
      "star",
      "star-ns",
      "reexport",
      "type-reexport",
      "named-from",
      "dynamic",
      "dynamic-options",
      "type-import",
      "template-type",
    ]);
  });

  test("multi-line clauses and statements sharing a line", () => {
    const source = `import {\n  type A,\n  B,\n  C as D,\n} from\n  "multi";\nfoo(); import "after-semicolon"; export {\n  E,\n} from "multi-export";\n`;
    expect(specifiers(source)).toEqual(["multi", "after-semicolon", "multi-export"]);
  });

  test("ignores comments, strings, templates and regular expressions", () => {
    const source = [
      `// import x from "line-comment";`,
      `/* export * from "block-comment"; import "block" */`,
      `/**`,
      ` * import("doc-comment")`,
      ` */`,
      `const a = 'import x from "single"';`,
      `const b = "export * from \\"double\\"";`,
      "const c = `import y from \"template\" ${value} from \"tail\" \\` from \"escaped\"`;",
      "const d = `outer ${`inner ${import(\"nested-dynamic\")}`} import \"text\"`;",
      `const e = /from "regex" [/"] import("re")/gi.test(s);`,
      `const f = a / b / import("after-division");`,
      `if (ok) return /"/.test(s) ? 1 : 2;`,
      `const g = { from: "object-key", import: "object-key" };`,
      `loader.import("member-call"); obj.from;`,
      `const from = "variable";`,
      `real(); import("real-dynamic");`,
    ].join("\n");
    expect(specifiers(source)).toEqual(["nested-dynamic", "after-division", "real-dynamic"]);
  });

  test("JSX text cannot fake or hide imports", () => {
    const source = [
      `import { cn } from "../lib/utils";`,
      `export const A = () => (`,
      `  <p class={cn("a")}>`,
      `    It's copied from "the docs"; don't import "x" from "y".`,
      `    <a href="https://sinwanjs.com">https://sinwanjs.com/docs</a> a / b`,
      `    <Icon /> <br/> {count > 1 ? "s" : ""}</p>`,
      `);`,
      `export const B = () => import("./after-jsx");`,
    ].join("\n");
    expect(specifiers(source)).toEqual(["../lib/utils", "./after-jsx"]);
  });

  test("unterminated constructs end the scan without throwing", () => {
    expect(specifiers(`import "a";\nconst s = "unterminated\nimport "b";`)).toEqual(["a", "b"]);
    expect(specifiers(`import "a";\nconst r = /unterminated\nimport "b";`)).toEqual(["a", "b"]);
    expect(specifiers(`import "a"; const s = 'tail\\`)).toEqual(["a"]);
    expect(specifiers(`import "a"; /* open`)).toEqual(["a"]);
    expect(specifiers("import \"a\"; const t = `open ${x")).toEqual(["a"]);
    expect(specifiers("import \"a\"; const t = `open")).toEqual(["a"]);
    expect(specifiers(`} import "after-stray-brace";`)).toEqual([]);
    expect(specifiers(`}\nimport "after-stray-brace";\nconst ünïcode = import("unicode");`)).toEqual([
      "after-stray-brace",
      "unicode",
    ]);
  });
});

describe("scanModule", () => {
  test("runtime imports from Bun are all located; type-only ones come from the text scanner", () => {
    const scan = scanModule(`import type { A } from "types";\nimport { b } from "values";\nexport const c = <div>{b}</div>;\n`, "tsx");
    expect(scan.occurrences.map((occurrence) => occurrence.specifier)).toEqual(["types", "values"]);
    expect(scan.unlocated).toEqual([]);
    expect(scanModule(`const value = <string>input;\nimport("./cast");\n`, "ts").unlocated).toEqual([]);
  });

  test("reports runtime imports the text scanner could not locate", () => {
    const scan = scanModule("export const A = () => <p>`</p>;\nexport const load = () => import(\"./late\");\n", "tsx");
    expect(scan.occurrences).toEqual([]);
    expect(scan.unlocated).toEqual(["./late"]);
  });

  test("syntax errors are reported with their line", () => {
    expect(() => scanModule(`const ok = 1;\nimport { from "x"`, "ts")).toThrow(/^line 2: Expected/);
  });

  test("agrees with TypeScript's pre-processor on every source file of this package", async () => {
    const root = join(import.meta.dir, "..", "src");
    let compared = 0;
    for await (const file of new Bun.Glob("**/*.{ts,tsx}").scan(root)) {
      const source = await Bun.file(join(root, file)).text();
      const ours = [...new Set(findModuleSpecifiers(source).map((occurrence) => occurrence.specifier))].sort();
      const typescript = [...new Set(preProcessFile(source, true, true).importedFiles.map((entry) => entry.fileName))].sort();
      expect({ file, specifiers: ours }).toEqual({ file, specifiers: typescript });
      compared += 1;
    }
    expect(compared).toBeGreaterThan(10);
  });
});

describe("findCssImports", () => {
  test("finds quoted and url() imports outside comments and strings", () => {
    const css = [
      `@import "tailwindcss";`,
      `@import 'tw-animate-css' layer(base);`,
      `@import url(./local.css);`,
      `@import url( "./quoted.css" ) screen;`,
      `/* @import "commented"; */`,
      `.a::before { content: "@import 'string'"; }`,
      `@media (min-width: 1px) { .b { color: red; } }`,
      `@importer "not-an-import";`,
    ].join("\n");
    const found = findCssImports(css);
    for (const occurrence of found) expect(css.slice(occurrence.start, occurrence.end)).toBe(occurrence.specifier);
    expect(found.map((occurrence) => occurrence.specifier)).toEqual([
      "tailwindcss",
      "tw-animate-css",
      "./local.css",
      "./quoted.css",
    ]);
  });

  test("unterminated comments and strings end the scan", () => {
    expect(findCssImports(`@import "a"; /* open`).map((occurrence) => occurrence.specifier)).toEqual(["a"]);
    expect(findCssImports(`@import "a"; .x { content: "open`).map((occurrence) => occurrence.specifier)).toEqual(["a"]);
  });
});

describe("stripTailwindSources", () => {
  test("removes @source lines with the comment block dedicated to them", () => {
    const css = [
      `@import "tailwindcss";`,
      ``,
      `/* ------------`,
      ` * Tailwind content sources`,
      ` * ---------- */`,
      `@source "../";`,
      `@source not "../legacy";`,
      `@source inline("{hover:,}underline");`,
      ``,
      `/* variants */`,
      `@custom-variant dark (&:is(.dark *));`,
      ``,
    ].join("\n");
    expect(stripTailwindSources(css)).toBe(
      [`@import "tailwindcss";`, ``, `/* variants */`, `@custom-variant dark (&:is(.dark *));`, ``].join("\n"),
    );
  });

  test("a single-line dedicated comment is removed too", () => {
    expect(stripTailwindSources(`a {}\n\n/* sources */\n@source "./x";\n\nb {}`)).toBe(`a {}\n\nb {}`);
  });

  test("keeps comments that are not cleanly dedicated to the @source lines", () => {
    // Followed directly by a rule.
    expect(stripTailwindSources(`a {}\n\n/* sources */\n@source "./x";\nb {}`)).toBe(`a {}\n\n/* sources */\nb {}`);
    // Preceded directly by a rule.
    expect(stripTailwindSources(`a {}\n/* sources */\n@source "./x";\n\nb {}`)).toBe(`a {}\n/* sources */\n\nb {}`);
    // The comment's opening line also closes an earlier comment.
    expect(stripTailwindSources(`/* a */ /*\n b */\n@source "./x";\n`)).toBe(`/* a */ /*\n b */\n`);
    // A comment end with code between it and another comment end.
    expect(stripTailwindSources(`/* a\n a */\nb {}\n c */\n@source "./x";\n`)).toBe(`/* a\n a */\nb {}\n c */\n`);
    // A stray comment end without an opening line.
    expect(stripTailwindSources(`x */\n@source "./x";\n`)).toBe(`x */\n`);
  });

  test("@source lines at the file edges and without a comment", () => {
    expect(stripTailwindSources(`@source "./x";\n\na {}`)).toBe(`a {}`);
    expect(stripTailwindSources(`a {}\n@source "./x";`)).toBe(`a {}`);
    expect(stripTailwindSources(`a {}\n@source "./x";\nb {}`)).toBe(`a {}\nb {}`);
    expect(stripTailwindSources(`a {}\r\n@source "./x";\r\nb {}`)).toBe(`a {}\r\nb {}`);
    expect(stripTailwindSources(`a {}\n.source {}\n`)).toBe(`a {}\n.source {}\n`);
  });
});
