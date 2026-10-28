import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { DEFAULT_ALIASES, type SinwanUiConfig } from "../src/config";
import { mergeCssVars, scopeSelector } from "../src/css-vars";
import { ITEM_NAME, parseItemRef, type RefContext, type RefScope } from "../src/item-ref";
import { loadProjectPaths, resolveProjectPaths } from "../src/project-paths";
import { CANONICAL_PREFIXES, rewriteImports, rewriteSpecifier } from "../src/rewrite-imports";
import { addAtAlias, newConfigWithAtAlias } from "../src/tsconfig-edit";
import { addViteAtAlias, VITE_AT_ALIAS_ENTRY } from "../src/vite-config-edit";
import {
  aliasDirectory,
  type AliasSource,
  findProjectConfig,
  loadAliasSource,
  parseJsonc,
  readJsoncFile,
  resolveSpecifier,
} from "../src/tsconfig-paths";
import { CONFIG, type Project, tempProject } from "./fixtures/cli/helpers";

const projects: Project[] = [];
async function project(tsconfig: string | null = null): Promise<Project> {
  const created = await tempProject(undefined, tsconfig);
  projects.push(created);
  return created;
}
afterEach(async () => {
  await Promise.all(projects.splice(0).map((entry) => entry.cleanup()));
});

async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error(`non-Error rejection: ${String(error)}`);
  }
  throw new Error("expected a rejection");
}

function source(paths: AliasSource["paths"], baseDir = "/p"): AliasSource {
  return { rootFile: "/p/tsconfig.json", file: "/p/tsconfig.json", baseDir, paths, ownPaths: true };
}

describe("cli tsconfig paths", () => {
  test("parseJsonc accepts comments and trailing commas", async () => {
    expect(parseJsonc('{ // c\n "a": [1,], /* b */ }', "x")).toEqual({ a: [1] });
    expect(() => parseJsonc("{", "tsconfig.json")).toThrow(/^Cannot parse tsconfig\.json: /);
    expect((await rejection(readJsoncFile("/does/not/exist.json"))).message).toStartWith(
      "Cannot read /does/not/exist.json: ",
    );
  });

  test("resolveSpecifier: exact match first, else the longest wildcard prefix", () => {
    const mapped = source({
      "@/*": ["./src/*"],
      "@/ui/*": ["./src/components/ui/*", "./other/*"],
      "@utils": ["./src/lib/utils.ts"],
      "@/empty/*": [],
      "*.css": ["./styles/*.css"],
    });
    expect(resolveSpecifier(mapped, "@/lib/utils")).toBe("/p/src/lib/utils");
    expect(resolveSpecifier(mapped, "@/ui/button")).toBe("/p/src/components/ui/button");
    expect(resolveSpecifier(mapped, "@utils")).toBe("/p/src/lib/utils.ts");
    expect(resolveSpecifier(mapped, "@/empty/x")).toBe("/p/src/empty/x");
    expect(resolveSpecifier(mapped, "theme.css")).toBe("/p/styles/theme.css");
    expect(resolveSpecifier(mapped, "~/x")).toBeNull();
    expect(resolveSpecifier(source({ "a*b": ["./x/*"] }), "ab")).toBe("/p/x");
    expect(resolveSpecifier(source({ "ab*b": ["./x/*"] }), "ab")).toBeNull();
  });

  test("aliasDirectory maps aliases through a probe child", () => {
    const mapped = source({ "@/*": ["./src/*"], "#ui": ["./src/ui/index.ts"], "~/ui/*": ["./app/ui/*"] });
    expect(aliasDirectory(mapped, "@/components/ui")).toBe("/p/src/components/ui");
    expect(aliasDirectory(mapped, "~/ui")).toBe("/p/app/ui");
    expect(aliasDirectory(mapped, "#ui")).toBeNull();
    expect(aliasDirectory(source({ "#ui/*": ["./src/ui/index.ts"] }), "#ui")).toBeNull();
  });

  test("loadAliasSource reads tsconfig.json, else jsconfig.json, else null", async () => {
    const none = await project();
    expect(await findProjectConfig(none.dir)).toBeNull();
    expect(await loadAliasSource(none.dir)).toBeNull();

    await none.write("jsconfig.json", '{ "compilerOptions": { "baseUrl": "src", "paths": { "@/*": ["./*"] } } }');
    const js = await loadAliasSource(none.dir);
    expect(js).toEqual({
      rootFile: join(none.dir, "jsconfig.json"),
      file: join(none.dir, "jsconfig.json"),
      baseDir: join(none.dir, "src"),
      paths: { "@/*": ["./*"] },
      ownPaths: true,
    });

    await none.write("tsconfig.json", "{ /* no options */ }");
    expect(await loadAliasSource(none.dir)).toEqual({
      rootFile: join(none.dir, "tsconfig.json"),
      file: join(none.dir, "tsconfig.json"),
      baseDir: none.dir,
      paths: {},
      ownPaths: false,
    });
    await none.write("tsconfig.json", "[]");
    expect((await rejection(loadAliasSource(none.dir))).message).toBe(`${join(none.dir, "tsconfig.json")} must contain a JSON object.`);
  });

  test("extends: relative parents (string or array) provide paths and baseUrl; packages are ignored", async () => {
    const app = await project('{ "extends": ["@tsconfig/bun", "./config/base"], "compilerOptions": { "strict": true } }');
    await app.write(
      "config/base.json",
      '{ "extends": "./root.json", "compilerOptions": { "paths": { "@/*": ["../src/*"], "bad": "x" } } }',
    );
    await app.write("config/root.json", '{ "compilerOptions": { "baseUrl": "..", "paths": { "old/*": ["./x/*"] } } }');
    const loaded = await loadAliasSource(app.dir);
    expect(loaded).toEqual({
      rootFile: join(app.dir, "tsconfig.json"),
      file: join(app.dir, "tsconfig.json"),
      baseDir: app.dir,
      paths: { "@/*": ["../src/*"] },
      ownPaths: false,
    });

    const child = await project('{ "extends": "./base.json" }');
    await child.write("base.json", '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }');
    const inherited = await loadAliasSource(child.dir);
    expect(inherited?.baseDir).toBe(child.dir);
    expect(inherited?.ownPaths).toBe(false);
    expect(aliasDirectory(inherited ?? source({}), "@/lib")).toBe(join(child.dir, "src/lib"));

    const missing = await project('{ "extends": "./nope" }');
    expect((await rejection(loadAliasSource(missing.dir))).message).toStartWith(`Cannot read ${join(missing.dir, "nope.json")}`);
  });

  test("extends chains stop at five levels and tolerate cycles", async () => {
    const deep = await project('{ "extends": "./1.json" }');
    for (let level = 1; level <= 6; level += 1) {
      const options = level === 6 ? ', "compilerOptions": { "paths": { "@/*": ["./src/*"] } }' : "";
      await deep.write(`${level}.json`, `{ "extends": "./${level + 1}.json"${options} }`);
    }
    expect((await loadAliasSource(deep.dir))?.paths).toEqual({});

    const cycle = await project('{ "extends": "./tsconfig.json", "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }');
    expect((await loadAliasSource(cycle.dir))?.paths).toEqual({ "@/*": ["./src/*"] });
  });

  test("references: the first referenced config with paths, else the first reference", async () => {
    const vite = await project(
      '{ "files": [], "references": [{ "path": "./tsconfig.node.json" }, { "path": "./tsconfig.app.json" }, { "path": "./missing.json" }, "x", { "path": 1 }] }',
    );
    await vite.write("tsconfig.node.json", '{ "compilerOptions": {} }');
    await vite.write("tsconfig.app.json", '{ "compilerOptions": { /* c */ "paths": { "@/*": ["./src/*"] } } }');
    const loaded = await loadAliasSource(vite.dir);
    expect(loaded?.file).toBe(join(vite.dir, "tsconfig.app.json"));
    expect(loaded?.rootFile).toBe(join(vite.dir, "tsconfig.json"));

    const noPaths = await project('{ "references": [{ "path": "./packages/app" }] }');
    await noPaths.write("packages/app/tsconfig.json", "{}");
    expect((await loadAliasSource(noPaths.dir))?.file).toBe(join(noPaths.dir, "packages/app/tsconfig.json"));

    const noneExist = await project('{ "references": [{ "path": "./gone.json" }] }');
    expect((await loadAliasSource(noneExist.dir))?.file).toBe(join(noneExist.dir, "tsconfig.json"));
  });
});

describe("cli tsconfig edit", () => {
  const parsedPaths = (text: string | null): unknown => {
    if (text === null) return null;
    const parsed = parseJsonc(text, "x");
    return typeof parsed === "object" && parsed !== null && "compilerOptions" in parsed ? parsed.compilerOptions : null;
  };

  test("adds paths inside compilerOptions, keeping comments and indentation", () => {
    const text = '{\n  // options\n  "compilerOptions": {\n    /* Bundler mode */\n    "strict": true,\n  },\n}\n';
    const next = addAtAlias(text, "./src/*");
    expect(next).toBe(
      '{\n  // options\n  "compilerOptions": {\n    "paths": { "@/*": ["./src/*"] },\n    /* Bundler mode */\n    "strict": true,\n  },\n}\n',
    );
    expect(parsedPaths(next)).toEqual({ paths: { "@/*": ["./src/*"] }, strict: true });
  });

  test("adds @/* to an existing paths object, empty objects and CRLF files", () => {
    expect(addAtAlias('{\n\t"compilerOptions": {\n\t\t"paths": {\n\t\t\t"#x": ["./x"]\n\t\t}\n\t}\n}', "./*")).toBe(
      '{\n\t"compilerOptions": {\n\t\t"paths": {\n\t\t\t"@/*": ["./*"],\n\t\t\t"#x": ["./x"]\n\t\t}\n\t}\n}',
    );
    expect(addAtAlias('{\r\n  "compilerOptions": { "paths": {} }\r\n}\r\n', "./src/*")).toBe(
      '{\r\n  "compilerOptions": { "paths": {\r\n    "@/*": ["./src/*"]\r\n  } }\r\n}\r\n',
    );
    expect(addAtAlias('{ "compilerOptions": {} }', "./src/*")).toBe(
      '{ "compilerOptions": {\n  "paths": { "@/*": ["./src/*"] }\n} }',
    );
  });

  test("adds compilerOptions to a root object", () => {
    expect(addAtAlias("{}", "./src/*")).toBe('{\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } }\n}');
    expect(addAtAlias('{\n  "files": []\n}\n', "./src/*")).toBe(
      '{\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },\n  "files": []\n}\n',
    );
  });

  test("returns null when an edit is not provably safe", () => {
    expect(addAtAlias("{", "./src/*")).toBeNull();
    expect(addAtAlias("[]", "./src/*")).toBeNull();
    expect(addAtAlias('// lead\n{ "files": [] }', "./src/*")).toBeNull();
    expect(addAtAlias('{ "compilerOptions": 1 }', "./src/*")).toBeNull();
    expect(addAtAlias('{ "compilerOptions": { "paths": [] } }', "./src/*")).toBeNull();
    expect(
      addAtAlias('{ "compilerOptions": { "a": { "compilerOptions": {} } } }', "./src/*"),
    ).toBeNull();
    expect(addAtAlias('{ /* "paths": { */ "compilerOptions": { "paths": { "@/*": ["./old/*"] } } }', "./src/*")).toBeNull();
    expect(addAtAlias('{ "compilerOptions": { "paths": { "@/*": ["./old/*"] } } }', "./src/*")).toBeNull();
  });

  test("newConfigWithAtAlias", () => {
    expect(JSON.parse(newConfigWithAtAlias("./src/*"))).toEqual({ compilerOptions: { paths: { "@/*": ["./src/*"] } } });
  });
});

describe("cli vite config edit", () => {
  const RESOLVE = `resolve: { alias: { ${VITE_AT_ALIAS_ENTRY} } },`;

  test("inserts resolve.alias as the first member, matching the indentation", () => {
    expect(addViteAtAlias("export default defineConfig({\n    plugins: [],\n});\n")).toBe(
      `import { fileURLToPath } from "node:url";\nexport default defineConfig({\n    ${RESOLVE}\n    plugins: [],\n});\n`,
    );
    expect(addViteAtAlias("export default defineConfig({});")).toBe(
      `import { fileURLToPath } from "node:url";\nexport default defineConfig({ ${RESOLVE}});`,
    );
  });

  test("keeps CRLF line endings and an existing fileURLToPath import", () => {
    expect(addViteAtAlias("import { fileURLToPath, URL } from 'url';\r\nexport default defineConfig({\r\n  plugins: [],\r\n});\r\n")).toBe(
      `import { fileURLToPath, URL } from 'url';\r\nexport default defineConfig({\r\n  ${RESOLVE}\r\n  plugins: [],\r\n});\r\n`,
    );
  });

  test("refuses ambiguous configs", () => {
    expect(addViteAtAlias("export default { plugins: [] };")).toBeNull();
    expect(addViteAtAlias("defineConfig({ a: 1 }); defineConfig({ b: 2 });")).toBeNull();
    expect(addViteAtAlias("export default defineConfig({ resolve: { dedupe: [] } });")).toBeNull();
  });
});

describe("cli project paths", () => {
  test("resolves every alias, the utils module and the stylesheet", () => {
    const mapped = source({ "@/*": ["./src/*"] });
    expect(resolveProjectPaths("/p", CONFIG, mapped)).toEqual({
      projectDir: "/p",
      css: "/p/src/styles/global.css",
      dirs: { components: "/p/src/components", ui: "/p/src/components/ui", lib: "/p/src/lib", hooks: "/p/src/hooks" },
      utils: "/p/src/lib/utils",
    });
    const custom: SinwanUiConfig = { ...CONFIG, aliases: { ...DEFAULT_ALIASES, ui: "@/ui", utils: "#cn" } };
    const withCn = source({ "@/*": ["./src/*"], "#cn": ["./src/helpers/cn"] });
    expect(resolveProjectPaths("/p", custom, withCn)).toMatchObject({ dirs: { ui: "/p/src/ui" }, utils: "/p/src/helpers/cn" });
  });

  test("errors name the alias and suggest init", () => {
    expect(() => resolveProjectPaths("/p", CONFIG, null)).toThrow(
      'Cannot resolve the "components" alias "@/components" from sinwan-ui.json: there is no tsconfig.json or jsconfig.json in /p. Add "@/*": ["./src/*"] to compilerOptions.paths, or run "sinwan-ui init".',
    );
    const partial = source({ "@/components/*": ["./src/components/*"], "@/lib/*": ["./src/lib/*"] });
    expect(() => resolveProjectPaths("/p", CONFIG, partial)).toThrow(
      'Cannot resolve the "hooks" alias "@/hooks" from sinwan-ui.json: no compilerOptions.paths entry in tsconfig.json matches it.',
    );
    const noUtils = source({ "@/components/*": ["./c/*"], "@/lib/*": ["./l/*"], "@/hooks/*": ["./h/*"] });
    expect(() => resolveProjectPaths("/p", { ...CONFIG, aliases: { ...DEFAULT_ALIASES, utils: "#u" } }, noUtils)).toThrow(
      'the "utils" alias "#u"',
    );
  });

  test("aliases and the stylesheet must stay inside the project", () => {
    expect(() => resolveProjectPaths("/p", CONFIG, source({ "@/*": ["../elsewhere/*"] }))).toThrow(
      'The "components" alias "@/components" resolves to /elsewhere/components, outside the project directory.',
    );
    const utilsOut = source({ "@/*": ["./src/*"], "#u": ["../u"] });
    expect(() => resolveProjectPaths("/p", { ...CONFIG, aliases: { ...DEFAULT_ALIASES, utils: "#u" } }, utilsOut)).toThrow(
      'The "utils" alias "#u" resolves to /u, outside the project directory.',
    );
    expect(() => resolveProjectPaths("/p", { ...CONFIG, tailwind: { css: "../x.css" } }, source({}))).toThrow(
      '"tailwind.css" must be a relative path inside the project directory.',
    );
  });

  test("loadProjectPaths reads the project's tsconfig", async () => {
    const app = await project('{ "compilerOptions": { "paths": { "@/*": ["./app/*"] } } }');
    expect((await loadProjectPaths(app.dir, CONFIG)).dirs.ui).toBe(join(app.dir, "app/components/ui"));
  });
});

describe("cli rewrite imports", () => {
  const aliases = { components: "~/components", ui: "~/ui", lib: "#lib", utils: "#lib/cn", hooks: "@/use" };

  test("prefixes are ordered longest first", () => {
    expect(CANONICAL_PREFIXES.map(([prefix]) => prefix)).toEqual([
      "@/components/ui",
      "@/components",
      "@/lib/utils",
      "@/lib",
      "@/hooks",
    ]);
  });

  test("rewriteSpecifier respects path-segment boundaries", () => {
    expect(rewriteSpecifier("@/components/ui/button", aliases)).toBe("~/ui/button");
    expect(rewriteSpecifier("@/components/ui", aliases)).toBe("~/ui");
    expect(rewriteSpecifier("@/components/uix", aliases)).toBe("~/components/uix");
    expect(rewriteSpecifier("@/components/card", aliases)).toBe("~/components/card");
    expect(rewriteSpecifier("@/lib/utils", aliases)).toBe("#lib/cn");
    expect(rewriteSpecifier("@/lib/utils-extra", aliases)).toBe("#lib/utils-extra");
    expect(rewriteSpecifier("@/lib/icons", aliases)).toBe("#lib/icons");
    expect(rewriteSpecifier("@/hooks/use-mobile", aliases)).toBe("@/use/use-mobile");
    expect(rewriteSpecifier("@/hooksy", aliases)).toBe("@/hooksy");
    expect(rewriteSpecifier("sinwan-ui-core/overlay", aliases)).toBe("sinwan-ui-core/overlay");
    expect(rewriteSpecifier("./local", aliases)).toBe("./local");
    expect(rewriteSpecifier("@/components/ui/button", DEFAULT_ALIASES)).toBe("@/components/ui/button");
  });

  test("rewriteImports covers import, export, side-effect and dynamic forms in script files only", () => {
    const source = [
      'import { cn } from "@/lib/utils";',
      "import type { X } from '@/components/ui/x';",
      'export * from "@/hooks/use-mobile";',
      'export { a } from"@/lib/icons";',
      'import "@/components/ui/side.css";',
      'const lazy = import( "@/components/ui/lazy" );',
      'const text = "@/lib/utils";',
      'import { Slot } from "sinwan-ui-core/slot";',
      'import { Dialog } from "./dialog";',
    ].join("\n");
    expect(rewriteImports(source, "x/a.tsx", aliases)).toBe(
      [
        'import { cn } from "#lib/cn";',
        "import type { X } from '~/ui/x';",
        'export * from "@/use/use-mobile";',
        'export { a } from"#lib/icons";',
        'import "~/ui/side.css";',
        'const lazy = import( "~/ui/lazy" );',
        'const text = "@/lib/utils";',
        'import { Slot } from "sinwan-ui-core/slot";',
        'import { Dialog } from "./dialog";',
      ].join("\n"),
    );
    for (const ext of [".ts", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]) {
      expect(rewriteImports('import "@/lib/a";', `a${ext}`, aliases)).toBe('import "#lib/a";');
    }
    expect(rewriteImports('@import "@/lib/a";', "global.css", aliases)).toBe('@import "@/lib/a";');
  });
});

describe("cli css vars", () => {
  test("scopeSelector", () => {
    expect(scopeSelector("light")).toBe(":root");
    expect(scopeSelector("dark")).toBe(".dark");
    expect(scopeSelector("theme")).toBe("@theme inline");
    expect(scopeSelector("@layer base")).toBe("@layer base");
  });

  const CSS = [
    '@import "tailwindcss";',
    "/* :root { --fake: 1; } */",
    ":root {",
    "    --primary: red; /* keep */",
    '  --font: "a;b{";',
    "  .nested { --inner: 1; }",
    "  --radius: 1rem",
    "}",
    "",
    ".dark { --primary: blue }",
    "@media (x) { :root { --z: 1; } }",
    "}",
    "",
  ].join("\n");

  test("adds missing variables to matching blocks and appends new blocks", () => {
    const result = mergeCssVars(
      CSS,
      {
        light: { primary: "green", "--ring": "black", font: "x", inner: "2" },
        dark: { ring: "white" },
        theme: { "color-primary": "var(--primary)" },
      },
      false,
    );
    expect(result).toMatchObject({ added: 4, updated: 0 });
    expect(result.content).toBe(
      [
        '@import "tailwindcss";',
        "/* :root { --fake: 1; } */",
        ":root {",
        "    --primary: red; /* keep */",
        '  --font: "a;b{";',
        "  .nested { --inner: 1; }",
        "  --radius: 1rem;",
        "    --ring: black;",
        "    --inner: 2;",
        "}",
        "",
        ".dark { --primary: blue;",
        "  --ring: white; }",
        "@media (x) { :root { --z: 1; } }",
        "}",
        "",
        "@theme inline {",
        "  --color-primary: var(--primary);",
        "}",
        "",
      ].join("\n"),
    );
    expect(mergeCssVars(result.content, { light: { ring: "black", primary: "pink" } }, false)).toEqual({
      content: result.content,
      added: 0,
      updated: 0,
    });
  });

  test("--overwrite replaces differing values in place", () => {
    const result = mergeCssVars(CSS, { light: { primary: "green", font: '"a;b{"', radius: "2rem" } }, true);
    expect(result).toMatchObject({ added: 0, updated: 2 });
    expect(result.content).toContain("    --primary: green; /* keep */\n");
    expect(result.content).toContain('  --font: "a;b{";\n');
    expect(result.content).toContain("  --radius: 2rem\n}");
  });

  test("empty files and empty blocks", () => {
    expect(mergeCssVars("", { light: { a: "1" }, dark: { a: "2" } }, false).content).toBe(
      ":root {\n  --a: 1;\n}\n\n.dark {\n  --a: 2;\n}\n",
    );
    expect(mergeCssVars("body{}", { light: { a: "1" } }, false).content).toBe("body{}\n\n:root {\n  --a: 1;\n}\n");
    expect(mergeCssVars(":root {}\n", { light: { a: "1" } }, false).content).toBe(":root {\n  --a: 1;}\n");
    expect(mergeCssVars(":root { --a: 1; }", {}, false)).toEqual({ content: ":root { --a: 1; }", added: 0, updated: 0 });
  });
});

describe("cli item refs", () => {
  const context: RefContext = {
    projectDir: "/app",
    registries: { "@acme": "https://acme.test/r/{name}.json", "@local": "./registry/{name}.json" },
  };
  const defaultScope: RefScope = { template: "https://reg.test/r/{name}.json", isDefault: true, base: "/cwd" };

  test("bare names use the scope template and keep it for their dependencies", () => {
    expect(ITEM_NAME.test("button-group")).toBe(true);
    expect(parseItemRef("button", defaultScope, context)).toEqual({
      display: "button",
      location: "https://reg.test/r/button.json",
      name: "button",
      inDefaultRegistry: true,
      scope: { template: "https://reg.test/r/{name}.json", isDefault: true, base: "https://reg.test/r/button.json" },
    });
    const local = parseItemRef("slot", { template: "/reg/{name}.json", isDefault: false, base: "/x" }, context);
    expect(local.scope.base).toBe("/reg");
    expect(local.inDefaultRegistry).toBe(false);
  });

  test("@namespace/name uses the configured template (URL or project-relative path)", () => {
    const acme = parseItemRef("@acme/card", defaultScope, context);
    expect(acme).toEqual({
      display: "@acme/card",
      location: "https://acme.test/r/card.json",
      name: "card",
      inDefaultRegistry: false,
      scope: { template: "https://acme.test/r/{name}.json", isDefault: false, base: "https://acme.test/r/card.json" },
    });
    expect(parseItemRef("button", acme.scope, context).location).toBe("https://acme.test/r/button.json");
    expect(parseItemRef("@local/card", defaultScope, context)).toMatchObject({
      location: "/app/registry/card.json",
      scope: { template: "/app/registry/{name}.json", base: "/app/registry" },
    });
  });

  test("unknown namespaces list the configured ones", () => {
    expect(() => parseItemRef("@nope/card", defaultScope, context)).toThrow(
      'Unknown registry "@nope" in "@nope/card". Configured registries: @acme, @local.',
    );
    expect(() => parseItemRef("@nope/card", defaultScope, { projectDir: "/app", registries: {} })).toThrow(
      'No registries are configured; add "registries": { "@nope": "https://…/{name}.json" } to sinwan-ui.json.',
    );
  });

  test("URLs and JSON paths resolve against the scope base", () => {
    expect(parseItemRef("https://x.test/r/a.json?v=1", defaultScope, context)).toEqual({
      display: "https://x.test/r/a.json?v=1",
      location: "https://x.test/r/a.json?v=1",
      name: undefined,
      inDefaultRegistry: false,
      scope: { template: "https://x.test/r/{name}.json", isDefault: false, base: "https://x.test/r/a.json?v=1" },
    });
    expect(parseItemRef("./items/a.json", defaultScope, context)).toEqual({
      display: "./items/a.json",
      location: "/cwd/items/a.json",
      name: undefined,
      inDefaultRegistry: false,
      scope: { template: "/cwd/items/{name}.json", isDefault: false, base: "/cwd/items" },
    });
    expect(parseItemRef("../b.json", { ...defaultScope, base: "https://x.test/r/a/x.json" }, context).location).toBe(
      "https://x.test/r/b.json",
    );
    expect(parseItemRef("/abs/c", defaultScope, context).location).toBe("/abs/c");
    expect(parseItemRef("@acme/x.json", defaultScope, context).location).toBe("/cwd/@acme/x.json");
    expect(parseItemRef("item.json", defaultScope, context).location).toBe("/cwd/item.json");
  });

  test("invalid references", () => {
    for (const input of ["Button", "a b", "@acme/Bad", "@acme/a/b"]) {
      expect(() => parseItemRef(input, defaultScope, context)).toThrow(
        "expected a name, @namespace/name, an http(s) URL or a path to an item JSON file.",
      );
    }
  });
});
