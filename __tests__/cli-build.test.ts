import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  buildRegistry,
  findDependencyCycles,
  REGISTRY_ITEM_SCHEMA_URL,
  type RegistryBuild,
} from "../src/build/build";
import { RegistryBuildError } from "../src/build/errors";
import { directoryFiles, loadRegistryInput } from "../src/build/load";
import { parsePackageInfo, parseRegistryManifest, type RegistryManifest } from "../src/build/manifest";
import { findStaleFiles, serializeJson, serializeRegistry, writeRegistryOutput } from "../src/build/output";
import {
  canonicalAlias,
  classifyImport,
  emittedPath,
  type ImportScope,
  packageName,
  rootForType,
} from "../src/build/resolve";
import { CliError } from "../src/errors";
import { run } from "../src/index";
import type { RegistryItem } from "../src/registry/schema";
import {
  ALIAS_ROOTS,
  type FixtureItem,
  manifest,
  memoryFiles,
  PACKAGE_JSON,
  PLAIN_COLORS,
  SAMPLE_ITEMS,
  SAMPLE_SOURCES,
  TAGGED_COLORS,
  type TempDir,
  tempDir,
  tempRegistry,
} from "./fixtures/cli-build/helpers";

const temps: TempDir[] = [];
async function track(created: Promise<TempDir>): Promise<TempDir> {
  const temp = await created;
  temps.push(temp);
  return temp;
}
afterEach(async () => {
  await Promise.all(temps.splice(0).map((temp) => temp.cleanup()));
});

function problemsOf(action: () => unknown): readonly string[] {
  try {
    action();
  } catch (error) {
    if (error instanceof RegistryBuildError) return error.problems;
    throw error;
  }
  throw new Error("expected a RegistryBuildError");
}

async function asyncProblemsOf(action: () => Promise<unknown>): Promise<readonly string[]> {
  try {
    await action();
  } catch (error) {
    if (error instanceof RegistryBuildError) return error.problems;
    throw error;
  }
  throw new Error("expected a RegistryBuildError");
}

const PACKAGE_INFO = parsePackageInfo(PACKAGE_JSON, "package.json");

async function build(
  items: readonly FixtureItem[],
  sources: Readonly<Record<string, string>>,
  extra: Record<string, unknown> = {},
): Promise<RegistryBuild> {
  return buildRegistry({
    manifest: parseRegistryManifest(manifest(items, extra), "registry.json"),
    packageInfo: PACKAGE_INFO,
    files: memoryFiles(sources),
    source: "registry.json",
  });
}

function itemNamed(result: RegistryBuild, name: string): RegistryItem {
  const found = result.items.find((item) => item.name === name);
  if (!found) throw new Error(`no item ${name}`);
  return found;
}

describe("parseRegistryManifest", () => {
  test("accepts a manifest and normalizes paths", () => {
    const parsed = parseRegistryManifest(
      manifest([{ name: "a", files: [{ path: "./src/components/ui/a.tsx" }] }], {
        aliasRoots: { ...ALIAS_ROOTS, lib: "./src/lib/" },
      }),
      "registry.json",
    );
    expect(parsed).toEqual({
      name: "fixture",
      homepage: "https://sinwanjs.com",
      aliasRoots: { ...ALIAS_ROOTS },
      items: [
        {
          name: "a",
          type: "registry:ui",
          description: "a description",
          files: [{ path: "src/components/ui/a.tsx", type: "registry:ui" }],
          dependencies: [],
          devDependencies: [],
          registryDependencies: [],
        },
      ],
    } satisfies RegistryManifest);
    const minimal = parseRegistryManifest({ name: "x", aliasRoots: ALIAS_ROOTS, items: [] }, "registry.json");
    expect(minimal).toEqual({ name: "x", aliasRoots: ALIAS_ROOTS, items: [] });
  });

  test("rejects a non-object manifest", () => {
    expect(problemsOf(() => parseRegistryManifest([], "registry.json"))).toEqual(["the manifest must be a JSON object"]);
  });

  test("lists every top-level problem", () => {
    expect(problemsOf(() => parseRegistryManifest({ name: "", homepage: 1, aliasRoots: [], items: {} }, "r"))).toEqual([
      "name must be a non-empty string",
      "manifest.homepage must be a string",
      "aliasRoots must be an object with components, ui, lib, hooks",
      "items must be an array",
    ]);
    expect(
      problemsOf(() =>
        parseRegistryManifest(
          { name: "x", aliasRoots: { components: "/abs", ui: "../out", lib: "src\\lib", hooks: "" }, items: [] },
          "r",
        ),
      ),
    ).toEqual([
      'aliasRoots.components "/abs" must be a relative path inside the registry directory',
      'aliasRoots.ui "../out" must be a relative path inside the registry directory',
      'aliasRoots.lib "src\\lib" must be a relative path inside the registry directory',
      "aliasRoots.hooks must be a non-empty string",
    ]);
  });

  test("lists every item and file problem with its location", () => {
    const value = {
      name: "x",
      aliasRoots: ALIAS_ROOTS,
      items: [
        "not an item",
        { name: 1, description: 2, type: "registry:nope", files: [] },
        {
          name: "bad",
          description: "d",
          type: "registry:ui",
          title: 3,
          docs: false,
          cssVars: { light: { radius: 1 } },
          dependencies: "x",
          devDependencies: [1],
          registryDependencies: {},
          files: [
            "nope",
            { path: "..", type: "registry:ui" },
            { path: "src/a.ts", type: "registry:x" },
            { path: "src/b.ts", type: "registry:file" },
            { path: "src/c.ts", type: "registry:ui", target: 4 },
          ],
        },
      ],
    };
    expect(problemsOf(() => parseRegistryManifest(value, "r"))).toEqual([
      "items[0] must be an object",
      "items[1].name must be a non-empty string",
      "items[1].description must be a string",
      "items[1].type must be one of registry:ui, registry:lib, registry:hook, registry:style, registry:block, registry:file",
      "items[1].files must be a non-empty array",
      'items[2] "bad".cssVars must map scopes to objects of string values',
      'items[2] "bad".title must be a string',
      'items[2] "bad".docs must be a string',
      'items[2] "bad".files[0] must be an object',
      'items[2] "bad".files[1].path ".." must be a relative path inside the registry directory',
      'items[2] "bad".files[2].type must be one of registry:ui, registry:lib, registry:hook, registry:style, registry:block, registry:file',
      'items[2] "bad".files[3] has type registry:file and needs a "target"',
      'items[2] "bad".files[4].target must be a string',
      'items[2] "bad".dependencies must be an array of strings',
      'items[2] "bad".devDependencies must be an array of strings',
      'items[2] "bad".registryDependencies must be an array of strings',
    ]);
  });
});

describe("parsePackageInfo", () => {
  test("reads the version and the first range of each package", () => {
    const info = parsePackageInfo(PACKAGE_JSON, "package.json");
    expect(info.version).toBe("1.2.3");
    expect(info.ranges.get("echarts")).toBe("^6.1.0");
    expect(info.ranges.get("tw-animate-css")).toBe("^1.4.0");
    expect(parsePackageInfo({ version: "0.0.1" }, "p").ranges.size).toBe(0);
  });

  test("rejects malformed package.json files", () => {
    expect(problemsOf(() => parsePackageInfo("x", "p"))).toEqual(["package.json must be a JSON object"]);
    expect(
      problemsOf(() => parsePackageInfo({ dependencies: [], peerDependencies: { a: 1 } }, "p")),
    ).toEqual([
      '"version" must be a non-empty string; it becomes the registry version',
      '"dependencies" must be an object',
      '"peerDependencies.a" must be a version range string',
    ]);
  });
});

describe("resolve helpers", () => {
  test("packageName handles scopes and subpaths", () => {
    expect(packageName("echarts")).toBe("echarts");
    expect(packageName("echarts/core")).toBe("echarts");
    expect(packageName("@tanstack/table-core")).toBe("@tanstack/table-core");
    expect(packageName("@tanstack/table-core/sub")).toBe("@tanstack/table-core");
    expect(packageName("@scope")).toBe("@scope");
  });

  test("canonicalAlias uses the longest root and drops extensions and index", () => {
    expect(canonicalAlias("src/components/ui/spinner.tsx", ALIAS_ROOTS)).toBe("@/components/ui/spinner");
    expect(canonicalAlias("src/components/ui/select/index.ts", ALIAS_ROOTS)).toBe("@/components/ui/select");
    expect(canonicalAlias("src/components/blocks/login.tsx", ALIAS_ROOTS)).toBe("@/components/blocks/login");
    expect(canonicalAlias("src/lib/utils.ts", ALIAS_ROOTS)).toBe("@/lib/utils");
    expect(canonicalAlias("src/lib/echarts-gl.d.ts", ALIAS_ROOTS)).toBe("@/lib/echarts-gl");
    expect(canonicalAlias("src/lib/index.ts", ALIAS_ROOTS)).toBe("@/lib");
    expect(canonicalAlias("src/hooks/theme.css", ALIAS_ROOTS)).toBe("@/hooks/theme.css");
    expect(canonicalAlias("src/styles/global.css", ALIAS_ROOTS)).toBeUndefined();
  });

  test("emittedPath is relative to the alias root of the file type", () => {
    expect(emittedPath({ path: "src/components/ui/select/select.tsx", type: "registry:ui" }, ALIAS_ROOTS)).toBe(
      "select/select.tsx",
    );
    expect(emittedPath({ path: "src/lib/utils.ts", type: "registry:lib" }, ALIAS_ROOTS)).toBe("utils.ts");
    expect(emittedPath({ path: "src/hooks/use-mobile.ts", type: "registry:hook" }, ALIAS_ROOTS)).toBe("use-mobile.ts");
    expect(emittedPath({ path: "src/components/blocks/a.tsx", type: "registry:block" }, ALIAS_ROOTS)).toBe(
      "blocks/a.tsx",
    );
    expect(emittedPath({ path: "src/styles/global.css", type: "registry:style" }, ALIAS_ROOTS)).toBe("global.css");
    expect(emittedPath({ path: "t/env.d.ts", type: "registry:file", target: "src/env.d.ts" }, ALIAS_ROOTS)).toBe(
      "src/env.d.ts",
    );
    expect(emittedPath({ path: "t/env.d.ts", type: "registry:file" }, ALIAS_ROOTS)).toBe("t/env.d.ts");
    expect(emittedPath({ path: "src/lib/a.tsx", type: "registry:ui" }, ALIAS_ROOTS)).toBeUndefined();
    expect(rootForType("registry:hook")).toBe("hooks");
    expect(rootForType("registry:style")).toBeUndefined();
  });

  test("classifyImport", async () => {
    const scope: ImportScope = {
      file: "src/components/ui/a/a.tsx",
      item: "a",
      owners: new Map([
        ["src/components/ui/a/a.tsx", "a"],
        ["src/components/ui/a/index.ts", "a"],
        ["src/lib/utils.ts", "utils"],
        ["src/styles/global.css", "style"],
      ]),
      ranges: PACKAGE_INFO.ranges,
      aliasRoots: ALIAS_ROOTS,
      exists: async (path) => path === "src/components/ui/a/orphan.tsx",
    };
    const where = (specifier: string) => `src/components/ui/a/a.tsx imports "${specifier}"`;
    expect(await classifyImport(".", scope)).toEqual({ kind: "internal" });
    expect(await classifyImport("./index", scope)).toEqual({ kind: "internal" });
    expect(await classifyImport("../../../lib/utils", scope)).toEqual({
      kind: "registry",
      item: "utils",
      alias: "@/lib/utils",
    });
    expect(await classifyImport("../../../styles/global.css", scope)).toEqual({
      kind: "error",
      message: `${where("../../../styles/global.css")}: src/styles/global.css (item "style") lies outside every alias root`,
    });
    expect(await classifyImport("./orphan", scope)).toEqual({
      kind: "error",
      message: `${where("./orphan")}: src/components/ui/a/orphan.tsx belongs to no registry item`,
    });
    expect(await classifyImport("..", scope)).toEqual({
      kind: "error",
      message: `${where("..")}: no file matches src/components/ui`,
    });
    expect(await classifyImport("@/lib/utils", scope)).toEqual({
      kind: "error",
      message: `${where("@/lib/utils")}: registry source must import other items by relative path`,
    });
    expect(await classifyImport("/abs/x", scope)).toEqual({
      kind: "error",
      message: `${where("/abs/x")}: absolute paths are not portable`,
    });
    expect(await classifyImport("sinwan", scope)).toEqual({ kind: "ignored" });
    expect(await classifyImport("sinwan/component", scope)).toEqual({ kind: "ignored" });
    expect(await classifyImport("tailwindcss", scope)).toEqual({ kind: "ignored" });
    expect(await classifyImport("@tanstack/table-core/sub", scope)).toEqual({
      kind: "npm",
      dependency: "@tanstack/table-core@^9.2.4",
    });
    expect(await classifyImport("left-pad", scope)).toEqual({
      kind: "error",
      message: `${where("left-pad")}: package "left-pad" is not declared in package.json`,
    });
  });
});

describe("buildRegistry", () => {
  test("builds items with detected dependencies and canonical aliases", async () => {
    const result = await build(SAMPLE_ITEMS, SAMPLE_SOURCES);
    expect(result.index).toEqual({
      name: "fixture",
      homepage: "https://sinwanjs.com",
      version: "1.2.3",
      items: [
        { name: "button", type: "registry:ui", title: "Button", description: "button description", registryDependencies: ["spinner", "utils"] },
        { name: "env", type: "registry:file", description: "env description", registryDependencies: [] },
        { name: "select", type: "registry:ui", description: "select description", registryDependencies: ["button"] },
        { name: "spinner", type: "registry:ui", title: "Spinner", description: "spinner description", registryDependencies: ["utils"] },
        { name: "style", type: "registry:style", description: "style description", registryDependencies: [] },
        { name: "use-mobile", type: "registry:hook", description: "use-mobile description", registryDependencies: [] },
        { name: "utils", type: "registry:lib", title: "Utils", description: "utils description", registryDependencies: [] },
      ],
    });

    const button = itemNamed(result, "button");
    expect(Object.keys(button)).toEqual([
      "$schema",
      "name",
      "type",
      "title",
      "description",
      "dependencies",
      "devDependencies",
      "registryDependencies",
      "files",
    ]);
    expect(button.$schema).toBe(REGISTRY_ITEM_SCHEMA_URL);
    expect(button.dependencies).toEqual(["class-variance-authority@^0.7.1", "sinwan-ui-core@^1.0.0"]);
    expect(button.devDependencies).toEqual([]);
    expect(button.files).toEqual([
      {
        path: "button.tsx",
        type: "registry:ui",
        content: (SAMPLE_SOURCES["src/components/ui/button.tsx"] ?? "")
          .replace(`"../../lib/utils"`, `"@/lib/utils"`)
          .replace(`'./spinner'`, `'@/components/ui/spinner'`),
      },
    ]);

    const select = itemNamed(result, "select");
    expect(select.dependencies).toEqual(["@tanstack/table-core@^9.2.4", "echarts@^6.1.0"]);
    expect(select.docs).toBe("https://sinwanjs.com/docs/select");
    expect(select.files.map(({ path, type }) => ({ path, type }))).toEqual([
      { path: "select/index.ts", type: "registry:ui" },
      { path: "select/select.tsx", type: "registry:ui" },
      { path: "select/use-select.ts", type: "registry:ui" },
      { path: "echarts-gl.d.ts", type: "registry:lib" },
    ]);
    expect(select.files[0]?.content).toBe(SAMPLE_SOURCES["src/components/ui/select/index.ts"]);
    expect(select.files[1]?.content).toBe(
      `import { Button } from "@/components/ui/button";\nimport { useSelect } from "./use-select";\n\nexport const Select = () => <Button>{useSelect()}</Button>;\n`,
    );

    const style = itemNamed(result, "style");
    expect(style.dependencies).toEqual(["tw-animate-css@^1.4.0"]);
    expect(style.cssVars).toEqual({ light: { radius: "0.5rem" } });
    expect(style.files).toEqual([
      {
        path: "global.css",
        type: "registry:style",
        content: `@import "tailwindcss";\n@import "tw-animate-css";\n\n:root { --radius: 0.5rem; }\n`,
      },
    ]);

    const env = itemNamed(result, "env");
    expect(env.devDependencies).toEqual(["vite@^7.0.0"]);
    expect(env.files).toEqual([
      {
        path: "src/env.d.ts",
        type: "registry:file",
        target: "src/env.d.ts",
        content: SAMPLE_SOURCES["templates/env.d.ts"] ?? "",
      },
    ]);
    expect(itemNamed(result, "use-mobile").files[0]?.path).toBe("use-mobile.ts");
  });

  test("merges declared dependencies, copies unscanned files and keeps non-style CSS verbatim", async () => {
    const sources = {
      "src/components/ui/card/card.tsx": `import "./card.css";\nexport const Card = 1;\n`,
      "src/components/ui/card/card.css": `@import "./tokens.css";\n@import "tw-animate-css";\n@source "./";\n`,
      "src/components/ui/card/tokens.css": `:root {}\n`,
      "src/components/ui/card/README.md": `import "not-scanned";\n`,
    };
    const result = await build(
      [
        {
          name: "card",
          files: [
            "src/components/ui/card/card.tsx",
            "src/components/ui/card/card.css",
            "src/components/ui/card/tokens.css",
            "src/components/ui/card/README.md",
          ],
          dependencies: ["lucide@^0.544.0", "tw-animate-css@^1.4.0"],
          registryDependencies: ["@acme/thing", "https://example.com/r/x.json"],
        },
      ],
      sources,
      { homepage: undefined },
    );
    expect(result.index.homepage).toBeUndefined();
    expect("homepage" in result.index).toBe(false);
    const card = itemNamed(result, "card");
    expect(card.dependencies).toEqual(["lucide@^0.544.0", "tw-animate-css@^1.4.0"]);
    expect(card.registryDependencies).toEqual(["@acme/thing", "https://example.com/r/x.json"]);
    expect(card.files.map((file) => file.content)).toEqual(Object.values(sources));
  });

  test("aggregates every problem into one error", async () => {
    const sources = {
      "src/components/ui/a.tsx": [
        `import { b } from "./b";`,
        `import "@/lib/utils";`,
        `import "left-pad";`,
        `import "./orphan";`,
        `import "./ghost";`,
        `import "../../../templates/t";`,
        `export const a = 1;`,
      ].join("\n"),
      "src/components/ui/b.tsx": `import { a } from "./a";\nexport const b = 1;\n`,
      "src/components/ui/orphan.ts": `export {};\n`,
      "src/components/ui/ok.tsx": `export {};\n`,
      "src/lib/shared.ts": `export {};\n`,
      "src/lib/misplaced.tsx": `export {};\n`,
      "src/lib/dup.ts": `export {};\n`,
      "src/components/ui/broken.tsx": `import { from "x"\n`,
      "src/components/ui/hidden.tsx": "export const A = () => <p>`</p>;\nexport const load = () => import(\"./late\");\n",
      "templates/t.ts": `export {};\n`,
    };
    const problems = await asyncProblemsOf(() =>
      build(
        [
          { name: "a", files: ["src/components/ui/a.tsx"] },
          { name: "b", files: ["src/components/ui/b.tsx", "src/lib/shared.ts"] },
          { name: "c", files: ["src/lib/shared.ts", "src/components/ui/ok.tsx", "src/components/ui/ok.tsx"] },
          { name: "Bad_Name", files: ["src/components/ui/missing.tsx"] },
          { name: "index", files: [{ path: "templates/t.ts", type: "registry:file", target: "src/t.ts" }] },
          { name: "c", files: ["src/lib/dup.ts"] },
          { name: "misplaced", files: [{ path: "src/lib/misplaced.tsx", type: "registry:ui" }] },
          { name: "broken", files: ["src/components/ui/broken.tsx"] },
          { name: "hidden", files: ["src/components/ui/hidden.tsx"] },
          { name: "dangling", files: [{ path: "src/components/blocks/x.tsx", type: "registry:block" }], registryDependencies: ["nope"] },
        ],
        { ...sources, "src/components/blocks/x.tsx": `export {};\n` },
      ),
    );
    expect(problems.slice(0, 4)).toEqual([
      'item name "Bad_Name" must match ^[a-z0-9-]+$',
      'item name "index" is reserved for the registry index',
      'item name "c" is used by more than one item',
      'src/lib/shared.ts is listed by both "b" and "c"',
    ]);
    expect(problems.slice(4)).toEqual([
      'src/components/ui/ok.tsx is listed twice by "c"',
      'src/components/ui/a.tsx imports "@/lib/utils": registry source must import other items by relative path',
      'src/components/ui/a.tsx imports "left-pad": package "left-pad" is not declared in package.json',
      'src/components/ui/a.tsx imports "./orphan": src/components/ui/orphan.ts belongs to no registry item',
      'src/components/ui/a.tsx imports "./ghost": no file matches src/components/ui/ghost',
      'src/components/ui/a.tsx imports "../../../templates/t": templates/t.ts (item "index") lies outside every alias root',
      'item "Bad_Name" lists src/components/ui/missing.tsx, which does not exist',
      'src/lib/misplaced.tsx (registry:ui) must lie under the "ui" alias root src/components/ui',
      expect.stringMatching(/^src\/components\/ui\/broken\.tsx could not be parsed: line 1: /),
      'src/components/ui/hidden.tsx: Bun reports an import of "./late" that the specifier scanner could not locate',
      'item "dangling" depends on "nope", which is not an item',
      "dependency cycle: a -> b -> a",
    ]);
  });

  test("a block outside the components root names that root", async () => {
    const problems = await asyncProblemsOf(() =>
      build([{ name: "x", files: [{ path: "blocks/x.tsx", type: "registry:block" }] }], { "blocks/x.tsx": "" }),
    );
    expect(problems).toEqual(['blocks/x.tsx (registry:block) must lie under the "components" alias root src/components']);
  });

  test("findDependencyCycles reports each cycle as a closed path", () => {
    const graph = new Map<string, string[]>([
      ["a", ["b"]],
      ["b", ["c", "external"]],
      ["c", ["a"]],
      ["d", ["d"]],
      ["e", ["a"]],
    ]);
    expect(findDependencyCycles(graph)).toEqual([
      ["a", "b", "c", "a"],
      ["d", "d"],
    ]);
  });
});

describe("registry output", () => {
  const STALE_ITEM: RegistryItem = {
    name: "old",
    type: "registry:ui",
    description: "",
    dependencies: [],
    devDependencies: [],
    registryDependencies: [],
    files: [],
  };

  test("serializes deterministically", async () => {
    const first = serializeRegistry(await build(SAMPLE_ITEMS, SAMPLE_SOURCES));
    const second = serializeRegistry(await build(SAMPLE_ITEMS, SAMPLE_SOURCES));
    expect([...first.keys()]).toEqual([
      "index.json",
      "button.json",
      "env.json",
      "select.json",
      "spinner.json",
      "style.json",
      "use-mobile.json",
      "utils.json",
    ]);
    expect(second).toEqual(first);
    expect(serializeJson({ a: [1] })).toBe(`{\n  "a": [\n    1\n  ]\n}\n`);
  });

  test("writes outputs and removes only stale generated item files", async () => {
    const out = await track(
      tempDir({
        "r/old.json": serializeJson(STALE_ITEM),
        "r/button.json": "{}",
        "r/notes.json": `{"name":"notes"}`,
        "r/Upper.json": serializeJson({ ...STALE_ITEM, name: "Upper" }),
        "r/broken.json": "{",
        "r/readme.md": "# r",
        "r/dir.json/inner.txt": "",
      }),
    );
    const outDir = join(out.dir, "r");
    const outputs = new Map([
      ["index.json", "{}\n"],
      ["button.json", "{\"name\":\"button\"}\n"],
    ]);
    expect(await findStaleFiles(outDir, outputs)).toEqual([join(outDir, "old.json")]);

    const dry = await writeRegistryOutput(outDir, outputs, true);
    expect(dry).toEqual({
      written: [join(outDir, "index.json"), join(outDir, "button.json")],
      removed: [join(outDir, "old.json")],
    });
    expect(await out.read("r/button.json")).toBe("{}");
    expect(await out.list("r")).toContain("old.json");

    expect(await writeRegistryOutput(outDir, outputs, false)).toEqual(dry);
    expect(await out.read("r/button.json")).toBe("{\"name\":\"button\"}\n");
    expect(await out.list("r")).toEqual([
      "Upper.json",
      "broken.json",
      "button.json",
      "dir.json",
      "index.json",
      "notes.json",
      "readme.md",
    ]);
  });

  test("creates a missing output directory", async () => {
    const out = await track(tempDir());
    const outDir = join(out.dir, "public", "r");
    expect(await findStaleFiles(outDir, new Map())).toEqual([]);
    await writeRegistryOutput(outDir, new Map([["index.json", "{}\n"]]), false);
    expect(await out.read("public/r/index.json")).toBe("{}\n");
  });
});

describe("loading a registry from disk", () => {
  test("directoryFiles reads files and reports missing paths", async () => {
    const temp = await track(tempDir({ "src/a.ts": "a", "src/dir/x.ts": "x" }));
    const files = directoryFiles(temp.dir);
    expect(await files.read("src/a.ts")).toBe("a");
    expect(await files.read("src/missing.ts")).toBeUndefined();
    expect(await files.exists("src/a.ts")).toBe(true);
    expect(await files.exists("src/dir")).toBe(false);
    expect(await files.exists("src/missing.ts")).toBe(false);
  });

  test("loadRegistryInput reads the manifest and package.json beside it", async () => {
    const temp = await track(tempRegistry(SAMPLE_ITEMS, SAMPLE_SOURCES));
    const input = await loadRegistryInput(join(temp.dir, "registry.json"), "registry.json");
    expect(input.source).toBe("registry.json");
    expect(input.packageInfo.version).toBe("1.2.3");
    expect(input.manifest.items.map((item) => item.name)).toEqual(SAMPLE_ITEMS.map((item) => item.name));
    expect(await input.files.read("src/lib/utils.ts")).toBe(SAMPLE_SOURCES["src/lib/utils.ts"]);
  });

  test("reports a missing or invalid manifest or package.json", async () => {
    const temp = await track(tempDir({ "bad/registry.json": "{", "nopkg/registry.json": "{}" }));
    const missing = join(temp.dir, "registry.json");
    await expect(loadRegistryInput(missing, "registry.json")).rejects.toThrow(
      new CliError(`Registry manifest not found: ${missing}`),
    );
    await expect(loadRegistryInput(join(temp.dir, "bad/registry.json"), "bad/registry.json")).rejects.toThrow(
      `${join(temp.dir, "bad/registry.json")} is not valid JSON: `,
    );
    await temp.write("nopkg/registry.json", JSON.stringify(manifest([])));
    await expect(loadRegistryInput(join(temp.dir, "nopkg/registry.json"), "nopkg/registry.json")).rejects.toThrow(
      'No package.json next to nopkg/registry.json; its "version" is the registry version.',
    );
    await temp.write("nopkg/package.json", "{}");
    const problems = await asyncProblemsOf(() =>
      loadRegistryInput(join(temp.dir, "nopkg/registry.json"), "nopkg/registry.json"),
    );
    expect(problems).toEqual(['"version" must be a non-empty string; it becomes the registry version']);
  });
});

describe("sinwan-ui build", () => {
  function captureIo() {
    let out = "";
    let err = "";
    return {
      stdout: (text: string) => {
        out += text;
      },
      stderr: (text: string) => {
        err += text;
      },
      out: () => out,
      err: () => err,
    };
  }

  async function cli(cwd: string, argv: string[], colors = PLAIN_COLORS) {
    const io = captureIo();
    const code = await run(argv, io, { cwd, colors, isTTY: false });
    return { code, out: io.out(), err: io.err() };
  }

  test("builds registry.json into public/r by default", async () => {
    const registry = await track(tempRegistry(SAMPLE_ITEMS, SAMPLE_SOURCES));
    const result = await cli(registry.dir, ["build"]);
    expect(result).toEqual({
      code: 0,
      out: "Built 7 items (10 files) and index.json into public/r; removed 0 stale file(s).\n",
      err: "",
    });
    expect(await registry.list("public/r")).toEqual([
      "button.json",
      "env.json",
      "index.json",
      "select.json",
      "spinner.json",
      "style.json",
      "use-mobile.json",
      "utils.json",
    ]);
    const button: unknown = JSON.parse(await registry.read("public/r/button.json"));
    expect(button).toEqual(itemNamed(await build(SAMPLE_ITEMS, SAMPLE_SOURCES), "button"));
  });

  test("takes a manifest path, --output and --cwd, and removes stale items", async () => {
    const root = await track(
      tempDir({
        "registry/registry.json": JSON.stringify(manifest(SAMPLE_ITEMS.slice(0, 2))),
        "registry/package.json": JSON.stringify(PACKAGE_JSON),
        "registry/src/lib/utils.ts": SAMPLE_SOURCES["src/lib/utils.ts"] ?? "",
        "registry/src/components/ui/spinner.tsx": SAMPLE_SOURCES["src/components/ui/spinner.tsx"] ?? "",
      }),
    );
    const stale = itemNamed(await build(SAMPLE_ITEMS, SAMPLE_SOURCES), "button");
    const out = await track(tempDir({ "old.json": serializeJson({ ...stale, name: "old" }) }));

    const dry = await cli(root.dir, ["build", "registry/registry.json", "--output", out.dir, "--dry-run"], TAGGED_COLORS);
    expect(dry.code).toBe(0);
    expect(dry.out).toBe(
      [
        `<dim>would write</dim> ${join(out.dir, "index.json")}`,
        `<dim>would write</dim> ${join(out.dir, "spinner.json")}`,
        `<dim>would write</dim> ${join(out.dir, "utils.json")}`,
        `<dim>would remove</dim> ${join(out.dir, "old.json")}`,
        `<warn>Dry run:</warn> would write 2 items (2 files) and index.json to ${out.dir} and remove 1 stale file(s).`,
        ``,
      ].join("\n"),
    );
    expect(await out.list(".")).toEqual(["old.json"]);

    const real = await cli("/", ["build", "registry/registry.json", "--output", "out", "--cwd", root.dir]);
    expect(real.err).toBe("");
    expect(real.out).toBe("Built 2 items (2 files) and index.json into out; removed 0 stale file(s).\n");
    const again = await cli(root.dir, ["build", "registry/registry.json", "--output", out.dir], TAGGED_COLORS);
    expect(again.out).toBe(
      `<dim>removed</dim> ${join(out.dir, "old.json")}\n<success>Built</success> 2 items (2 files) and index.json into ${out.dir}; removed 1 stale file(s).\n`,
    );
    expect(await out.list(".")).toEqual(["index.json", "spinner.json", "utils.json"]);
  });

  test("reports argument and build errors", async () => {
    const registry = await track(tempRegistry([{ name: "a", files: ["src/components/ui/a.tsx"] }], {
      "src/components/ui/a.tsx": `import "left-pad";\n`,
    }));
    expect(await cli(registry.dir, ["build", "a.json", "b.json"])).toEqual({
      code: 1,
      out: "",
      err: 'sinwan-ui: "sinwan-ui build" takes at most one manifest path (got: a.json b.json).\n',
    });
    expect(await cli(registry.dir, ["build"])).toEqual({
      code: 1,
      out: "",
      err: 'sinwan-ui: registry.json has 1 problem(s):\n  - src/components/ui/a.tsx imports "left-pad": package "left-pad" is not declared in package.json\n',
    });
    expect(await registry.list(".")).not.toContain("public");
  });
});
