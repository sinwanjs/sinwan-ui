import { afterEach, describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCliArgs } from "../src/args";
import {
  CONFIG_FILE,
  configProblems,
  createConfig,
  DEFAULT_ALIASES,
  detectPackageManager,
  isPackageManager,
  isSinwanUiConfig,
  MIGRATE_HINT,
  type PackageManager,
  readConfig,
  readConfigState,
  requireConfig,
  writeConfig,
} from "../src/config";
import type { ItemRef } from "../src/item-ref";
import type { ProjectPaths } from "../src/project-paths";
import type { RegistryItem } from "../src/registry/schema";
import { colorizeDiff, diffLines, unifiedDiff } from "../src/diff";
import { CliError, errorMessage } from "../src/errors";
import { pathExists, readTextIfExists, resolveInside } from "../src/fs-utils";
import {
  installCommand,
  missingDependencies,
  packageName,
  readProjectDependencies,
  runInstallCommand,
} from "../src/install";
import {
  ENTRY_STYLESHEETS,
  findEntryStylesheet,
  importSpecifier,
  linkTheme,
} from "../src/stylesheet-link";
import { createRegistrySource, isHttpUrl } from "../src/registry-source";
import { type ItemResolver, resolveItems, unknownItemMessage } from "../src/resolve";
import { closeMatches } from "../src/suggest";
import { CLI_VERSION, DEFAULT_REGISTRY_REF, defaultRegistryUrl } from "../src/version";
import { type InstallTargets, planFiles, targetPath, writePlannedFiles } from "../src/write-files";
import {
  captureIo,
  CONFIG,
  indexOf,
  item,
  LEGACY_CONFIG,
  mockFetch,
  REGISTRY_URL,
  registryFiles,
  PLAIN_COLORS,
  sampleItems,
  scriptedPrompts,
  type ScriptedAnswer,
  TAGGED_COLORS,
  tempProject,
  type Project,
  writeLocalRegistry,
} from "./fixtures/cli/helpers";

const projects: Project[] = [];
async function project(packageJson?: unknown): Promise<Project> {
  const created = await tempProject(packageJson);
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

describe("cli args", () => {
  test("defaults", () => {
    expect(parseCliArgs([])).toEqual({
      command: undefined,
      positionals: [],
      options: {
        cwd: undefined,
        yes: false,
        defaults: false,
        overwrite: false,
        all: false,
        path: undefined,
        output: undefined,
        registry: undefined,
        ref: undefined,
        dryRun: false,
        help: false,
        version: false,
      },
    });
  });

  test("parses every flag and positionals", () => {
    const parsed = parseCliArgs([
      "add",
      "button",
      "dialog",
      "--cwd",
      "app",
      "-y",
      "--overwrite",
      "--defaults",
      "--all",
      "--path",
      "src/ui",
      "--output",
      "public/r",
      "--registry",
      "../r",
      "--ref",
      "main",
      "--dry-run",
      "-h",
      "-v",
    ]);
    expect(parsed).toEqual({
      command: "add",
      positionals: ["button", "dialog"],
      options: {
        cwd: "app",
        yes: true,
        defaults: true,
        overwrite: true,
        all: true,
        path: "src/ui",
        output: "public/r",
        registry: "../r",
        ref: "main",
        dryRun: true,
        help: true,
        version: true,
      },
    });
  });

  test("short aliases for the new flags", () => {
    expect(parseCliArgs(["add", "-d", "-a", "-p", "x"]).options).toMatchObject({
      defaults: true,
      all: true,
      path: "x",
    });
  });

  test("unknown flags and missing values are CLI errors", () => {
    expect(() => parseCliArgs(["--nope"])).toThrow(CliError);
    expect(() => parseCliArgs(["--nope"])).toThrow(/--help/);
    expect(() => parseCliArgs(["--cwd"])).toThrow(CliError);
  });
});

describe("cli errors", () => {
  test("errorMessage handles non-Error values", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("text")).toBe("text");
    expect(new CliError("x").name).toBe("CliError");
  });
});

describe("cli fs-utils", () => {
  test("resolveInside keeps paths inside the root", () => {
    expect(resolveInside("/p", "src/a.ts", false)).toBe("/p/src/a.ts");
    expect(resolveInside("/p", "..foo/a.ts", false)).toBe("/p/..foo/a.ts");
    expect(resolveInside("/p", ".", true)).toBe("/p");
    expect(resolveInside("/p", ".", false)).toBeNull();
    expect(resolveInside("/p", "..", false)).toBeNull();
    expect(resolveInside("/p", "../q/a.ts", false)).toBeNull();
    expect(resolveInside("/p", "src/../../a.ts", false)).toBeNull();
    expect(resolveInside("/p", "/p/a.ts", false)).toBeNull();
  });

  test("pathExists and readTextIfExists", async () => {
    const { dir } = await project();
    expect(await pathExists(join(dir, "package.json"))).toBe(true);
    expect(await pathExists(join(dir, "missing"))).toBe(false);
    expect(await readTextIfExists(join(dir, "missing"))).toBeNull();
    await writeFile(join(dir, "a.txt"), "hello");
    expect(await readTextIfExists(join(dir, "a.txt"))).toBe("hello");
  });
});

describe("cli config", () => {
  test("type guards and typed problems", () => {
    expect(isPackageManager("pnpm")).toBe(true);
    expect(isPackageManager("deno")).toBe(false);
    expect(isPackageManager(1)).toBe(false);
    expect(isSinwanUiConfig(CONFIG)).toBe(true);
    const { registries: _registries, ...withoutRegistries } = CONFIG;
    expect(isSinwanUiConfig(withoutRegistries)).toBe(true);
    expect(isSinwanUiConfig([])).toBe(false);
    expect(configProblems(null)).toEqual(["expected a JSON object"]);
    expect(
      configProblems({
        $schema: 1,
        tsx: "yes",
        tailwind: { css: " " },
        aliases: { ...DEFAULT_ALIASES, ui: "", hooks: 3 },
        registries: { acme: "x/{name}.json", "@ok": "https://x/{name}.json", "@bad": "https://x/a.json", "@num": 1 },
        packageManager: "deno",
      }),
    ).toEqual([
      '"$schema" must be a string',
      '"tsx" must be true or false',
      '"tailwind.css" must be a non-empty string',
      '"aliases.ui" must be a non-empty string',
      '"aliases.hooks" must be a non-empty string',
      'registry namespace "acme" must look like "@name"',
      '"registries.@bad" must be a string containing {name}',
      '"registries.@num" must be a string containing {name}',
      '"packageManager" must be one of bun, npm, pnpm, yarn',
    ]);
    expect(configProblems({ ...CONFIG, tailwind: "x", aliases: [], registries: [] })).toEqual([
      '"tailwind.css" must be a non-empty string',
      '"aliases" must be an object',
      '"registries" must be an object',
    ]);
  });

  test("createConfig fills the schema and an empty registries map", () => {
    expect(createConfig({ tsx: false, css: "a.css", aliases: DEFAULT_ALIASES, packageManager: "npm" })).toEqual({
      $schema: CONFIG.$schema,
      tsx: false,
      tailwind: { css: "a.css" },
      aliases: DEFAULT_ALIASES,
      registries: {},
      packageManager: "npm",
    });
  });

  test("readConfig, requireConfig and writeConfig", async () => {
    const { dir, write } = await project();
    expect(await readConfig(dir)).toBeNull();
    expect(await readConfigState(dir)).toEqual({ kind: "missing" });
    expect((await rejection(requireConfig(dir))).message).toContain('Run "sinwan-ui init" first');

    await write(CONFIG_FILE, "{");
    expect((await rejection(readConfig(dir))).message).toContain("Cannot parse");
    await write(CONFIG_FILE, JSON.stringify({ tsx: true }));
    expect((await rejection(readConfig(dir))).message).toBe(
      `Invalid ${CONFIG_FILE}:\n  - "tailwind.css" must be a non-empty string\n  - "aliases" must be an object\n  - "packageManager" must be one of bun, npm, pnpm, yarn`,
    );

    const nested = join(dir, "nested");
    await writeConfig(nested, CONFIG);
    expect(await readFile(join(nested, CONFIG_FILE), "utf8")).toBe(`${JSON.stringify(CONFIG, null, 2)}\n`);
    expect(await requireConfig(nested)).toEqual(CONFIG);
  });

  test("v1 configs are recognised and need a migration", async () => {
    const { dir, write } = await project();
    await write(CONFIG_FILE, JSON.stringify(LEGACY_CONFIG));
    expect(await readConfigState(dir)).toEqual({ kind: "legacy", legacy: { css: "src/app.css", packageManager: "pnpm" } });
    expect((await rejection(readConfig(dir))).message).toBe(MIGRATE_HINT);
    await write(CONFIG_FILE, JSON.stringify({ baseDir: "src", packageManager: "deno" }));
    expect(await readConfigState(dir)).toEqual({ kind: "legacy", legacy: { css: undefined, packageManager: undefined } });
    await write(CONFIG_FILE, JSON.stringify({ ...CONFIG, css: "x" }));
    expect((await readConfigState(dir)).kind).toBe("current");
    await write(CONFIG_FILE, "[]");
    expect((await rejection(readConfigState(dir))).message).toContain("expected a JSON object");
  });

  test("detectPackageManager reads lockfiles", async () => {
    const cases: Array<[string, PackageManager]> = [
      ["bun.lock", "bun"],
      ["bun.lockb", "bun"],
      ["pnpm-lock.yaml", "pnpm"],
      ["yarn.lock", "yarn"],
      ["package-lock.json", "npm"],
    ];
    for (const [lockfile, expected] of cases) {
      const { dir, write } = await project();
      await write(lockfile, "");
      expect(await detectPackageManager(dir)).toBe(expected);
    }
    const { dir } = await project();
    expect(await detectPackageManager(dir)).toBe("bun");
  });

});

describe("cli suggest", () => {
  const names = ["button", "button-group", "dialog", "alert-dialog", "sheet", "select"];

  test("finds substrings and near misses, closest first", () => {
    expect(closeMatches("buton", names)).toEqual(["button"]);
    expect(closeMatches("dialog", names)).toEqual(["alert-dialog", "dialog"]);
    expect(closeMatches("Button", names)).toEqual(["button", "button-group"]);
    expect(closeMatches("shet", names)).toEqual(["sheet"]);
    expect(closeMatches("selet", names)).toEqual(["select", "sheet"]);
    expect(closeMatches("zzzzzz", names)).toEqual([]);
    expect(closeMatches("e", names, 2)).toHaveLength(2);
  });
});

describe("cli resolve", () => {
  /** Bare names live at `mem://<name>`; `ext:<name>` refs are outside the default registry. */
  const ref = (input: string): ItemRef => {
    const external = input.startsWith("ext:");
    const name = external ? input.slice(4) : input;
    return {
      display: input,
      location: `mem://${name}`,
      name,
      inDefaultRegistry: !external,
      scope: { template: "mem://{name}", isDefault: true, base: "/" },
    };
  };
  const refs = (...inputs: string[]): ItemRef[] => inputs.map(ref);

  function fakeResolver(items: readonly RegistryItem[]): { resolver: ItemResolver; loads: string[]; indexCalls: () => number } {
    const byName = new Map(items.map((entry) => [entry.name, entry]));
    const loads: string[] = [];
    let indexCalls = 0;
    return {
      loads,
      indexCalls: () => indexCalls,
      resolver: {
        index: async () => {
          indexCalls += 1;
          return indexOf(items);
        },
        load: async (target) => {
          loads.push(target.display);
          const found = target.name === undefined ? undefined : byName.get(target.name);
          if (!found) throw new CliError(`missing ${target.display}`);
          return found;
        },
        child: (dependency) => ref(dependency),
      },
    };
  }
  const names = (resolved: Awaited<ReturnType<typeof resolveItems>>): string[] => resolved.map(({ item: entry }) => entry.name);

  test("orders dependencies first, deduped by location and deterministic", async () => {
    const { resolver } = fakeResolver(sampleItems());
    expect(names(await resolveItems(refs("button"), resolver))).toEqual(["utils", "spinner", "slot", "button"]);
    expect(names(await resolveItems(refs("dialog", "button", "utils", "ext:utils"), resolver))).toEqual([
      "utils",
      "spinner",
      "slot",
      "button",
      "dialog",
    ]);
  });

  test("unknown requested names list close matches; external refs skip the index", async () => {
    const { resolver, indexCalls } = fakeResolver(sampleItems());
    const error = await rejection(resolveItems(refs("buton", "zzzzzz", "ext:x"), resolver));
    expect(error.message).toContain('Unknown item "buton". Did you mean: button?');
    expect(error.message).toContain('Unknown item "zzzzzz". Run "sinwan-ui list"');
    expect(error.message).not.toContain("ext:x");
    expect(unknownItemMessage("dialg", indexOf(sampleItems()))).toContain("Did you mean: dialog?");

    const external = fakeResolver(sampleItems());
    expect(names(await resolveItems(refs("ext:slot"), external.resolver))).toEqual(["slot"]);
    expect(external.indexCalls()).toBe(0);
    expect((await rejection(resolveItems(refs("ext:ghost"), external.resolver))).message).toBe("missing ext:ghost");
    expect(indexCalls()).toBe(1);
  });

  test("unknown registry dependencies and cycles", async () => {
    const broken = fakeResolver([item("a", { registryDependencies: ["ghost"] })]);
    expect((await rejection(resolveItems(refs("a"), broken.resolver))).message).toBe(
      'Registry item "a" depends on unknown item "ghost".',
    );
    const cyclic = fakeResolver([
      item("a", { registryDependencies: ["b"] }),
      item("b", { registryDependencies: ["a"] }),
    ]);
    expect(names(await resolveItems(refs("a"), cyclic.resolver))).toEqual(["b", "a"]);
    expect(cyclic.loads).toEqual(["a", "b"]);
  });
});

describe("cli diff", () => {
  test("diffLines marks removals before additions", () => {
    expect(diffLines(["a", "b", "c"], ["a", "B", "c", "d"])).toEqual([
      { kind: " ", text: "a" },
      { kind: "-", text: "b" },
      { kind: "+", text: "B" },
      { kind: " ", text: "c" },
      { kind: "+", text: "d" },
    ]);
    expect(diffLines(["x", "y"], [])).toEqual([
      { kind: "-", text: "x" },
      { kind: "-", text: "y" },
    ]);
    expect(diffLines(["a", "b"], ["b", "a"])).toEqual([
      { kind: "-", text: "a" },
      { kind: " ", text: "b" },
      { kind: "+", text: "a" },
    ]);
  });

  test("unifiedDiff renders hunks", () => {
    expect(unifiedDiff("same", "same", "a", "b")).toBe("");
    expect(unifiedDiff("a\nb\nc\n", "a\nB\nc\n", "x (local)", "x (registry)")).toBe(
      "--- x (local)\n+++ x (registry)\n@@ -1,4 +1,4 @@\n a\n-b\n+B\n c\n \n",
    );
    expect(unifiedDiff("a", "a\nb", "l", "r", 0)).toBe("--- l\n+++ r\n@@ -1,0 +2,1 @@\n+b\n");
    expect(unifiedDiff("a\nb", "a", "l", "r", 0)).toBe("--- l\n+++ r\n@@ -2,1 +1,0 @@\n-b\n");
  });

  test("unifiedDiff splits distant changes and merges close ones", () => {
    const lines = Array.from({ length: 20 }, (_, index) => String(index + 1));
    const before = `${lines.join("\n")}\n`;
    const after = before.replace("\n2\n", "\nX\n").replace("\n18\n", "\nY\n");
    const headers = unifiedDiff(before, after, "l", "r").split("\n").filter((line) => line.startsWith("@@"));
    expect(headers).toEqual(["@@ -1,5 +1,5 @@", "@@ -15,7 +15,7 @@"]);
    const close = before.replace("\n2\n", "\nX\n").replace("\n8\n", "\nY\n");
    expect(unifiedDiff(before, close, "l", "r").split("\n").filter((line) => line.startsWith("@@"))).toEqual([
      "@@ -1,11 +1,11 @@",
    ]);
  });
});

describe("cli install", () => {
  test("installCommand per package manager", () => {
    expect(installCommand("bun", ["a@1"])).toEqual(["bun", "add", "a@1"]);
    expect(installCommand("npm", ["a@1"])).toEqual(["npm", "install", "a@1"]);
    expect(installCommand("pnpm", ["a@1", "b"])).toEqual(["pnpm", "add", "a@1", "b"]);
    expect(installCommand("yarn", ["a@1"])).toEqual(["yarn", "add", "a@1"]);
    expect(installCommand("bun", ["a@1"], true)).toEqual(["bun", "add", "-D", "a@1"]);
    expect(installCommand("npm", ["a@1"], true)).toEqual(["npm", "install", "-D", "a@1"]);
  });

  test("packageName strips version ranges", () => {
    expect(packageName("echarts@^6.1.0")).toBe("echarts");
    expect(packageName("@floating-ui/dom@^1.8.0")).toBe("@floating-ui/dom");
    expect(packageName("@scope/pkg")).toBe("@scope/pkg");
    expect(packageName("clsx")).toBe("clsx");
  });

  test("readProjectDependencies", async () => {
    const withDeps = await project({
      dependencies: { sinwan: "1" },
      devDependencies: { clsx: "2" },
      peerDependencies: { ignored: "1" },
    });
    expect([...((await readProjectDependencies(withDeps.dir)) ?? [])]).toEqual(["sinwan", "clsx"]);
    const noFields = await project({ dependencies: "nope" });
    expect((await readProjectDependencies(noFields.dir))?.size).toBe(0);
    const array = await project([]);
    expect((await readProjectDependencies(array.dir))?.size).toBe(0);
    const missing = await project(null);
    expect(await readProjectDependencies(missing.dir)).toBeNull();
    await missing.write("package.json", "{");
    expect((await rejection(readProjectDependencies(missing.dir))).message).toContain("Cannot parse");
  });

  test("missingDependencies dedupes by package name and skips installed ones", () => {
    const specifiers = ["clsx@^2", "tailwind-merge@^3", "clsx@^2.1", "@floating-ui/dom@^1"];
    expect(missingDependencies(specifiers, null)).toEqual(["clsx@^2", "tailwind-merge@^3", "@floating-ui/dom@^1"]);
    expect(missingDependencies(specifiers, new Set(["clsx", "@floating-ui/dom"]))).toEqual(["tailwind-merge@^3"]);
    expect(missingDependencies(specifiers, null, ["clsx@^1", "tailwind-merge"])).toEqual(["@floating-ui/dom@^1"]);
  });

  test("runInstallCommand inherits stdio, or captures output when quiet", async () => {
    const { dir } = await project();
    expect(await runInstallCommand([process.execPath, "-e", "process.exit(3)"], dir, false)).toEqual({
      exitCode: 3,
      output: "",
    });
    const script = "process.stdout.write('out;'); process.stderr.write('err'); process.exit(4)";
    expect(await runInstallCommand([process.execPath, "-e", script], dir, true)).toEqual({
      exitCode: 4,
      output: "out;err",
    });
  });
});

describe("cli colorizeDiff", () => {
  test("colours headers, hunks, additions and removals", () => {
    const patch = unifiedDiff("a\n-- b\nc\n", "a\nB\nc\n", "l", "r");
    expect(colorizeDiff(patch, TAGGED_COLORS)).toBe(
      [
        "<heading>--- l</heading>",
        "<heading>+++ r</heading>",
        "<accent>@@ -1,4 +1,4 @@</accent>",
        " a",
        "<error>--- b</error>",
        "<success>+B</success>",
        " c",
        " ",
        "",
      ].join("\n"),
    );
  });
});

describe("cli stylesheet-link", () => {
  const theme = "/p/src/styles/global.css";
  const entry = "/p/src/index.css";

  test("importSpecifier is a relative POSIX path", () => {
    expect(importSpecifier(entry, theme)).toBe("./styles/global.css");
    expect(importSpecifier("/p/src/app.css", "/p/src/theme.css")).toBe("./theme.css");
    expect(importSpecifier("/p/src/css/main.css", theme)).toBe("../styles/global.css");
  });

  test("replaces only the Tailwind import line, preserving every other byte", () => {
    const variants: Array<[string, string]> = [
      ['@import "tailwindcss";', "\n"],
      ["@import 'tailwindcss';", "\n"],
      ['@import "tailwindcss"', "\n"],
      ["@import   'tailwindcss' ;  ", "\n"],
      ['@import "tailwindcss";', "\r\n"],
    ];
    for (const [line, eol] of variants) {
      const content = `/* app */${eol}${line}${eol}${eol}@layer base {${eol}  body { margin: 0; }${eol}}${eol}`;
      expect(linkTheme(content, entry, theme)).toEqual({
        status: "replace",
        specifier: "./styles/global.css",
        content: `/* app */${eol}@import "./styles/global.css";${eol}${eol}@layer base {${eol}  body { margin: 0; }${eol}}${eol}`,
      });
    }
    expect(linkTheme('@import "tailwindcss";', entry, theme)).toEqual({
      status: "replace",
      specifier: "./styles/global.css",
      content: '@import "./styles/global.css";',
    });
    expect(linkTheme('@import "tailwindcss";\n@import "tailwindcss";\n', entry, theme)?.status).toBe("replace");
    expect(
      linkTheme('@import "tailwindcss";\n@import "tailwindcss";\n', entry, theme),
    ).toMatchObject({ content: '@import "./styles/global.css";\n@import "tailwindcss";\n' });
  });

  test("ignores nested, commented and parameterised imports", () => {
    expect(linkTheme('@layer x {\n  @import "tailwindcss";\n}\n', entry, theme)).toBeNull();
    expect(linkTheme('/* @import "tailwindcss"; */\n', entry, theme)).toBeNull();
    expect(linkTheme('@import "tailwindcss" source(none);\n', entry, theme)).toBeNull();
    expect(linkTheme('@import "tw-animate-css";\nbody {}\n', entry, theme)).toBeNull();
    expect(linkTheme("", entry, theme)).toBeNull();
  });

  test("reports an existing theme import as linked", () => {
    expect(linkTheme('@import "./styles/global.css";\n', entry, theme)).toEqual({ status: "linked" });
    expect(linkTheme("@import './styles/global.css'\n@import \"tailwindcss\";\n", entry, theme)).toEqual({
      status: "linked",
    });
    expect(linkTheme('@import "../src/styles/global.css";\n', entry, theme)).toEqual({ status: "linked" });
    expect(linkTheme('@import "./other.css";\n', entry, theme)).toBeNull();
  });

  test("findEntryStylesheet checks each candidate in order", async () => {
    expect(ENTRY_STYLESHEETS).toEqual([
      "src/index.css",
      "src/app.css",
      "src/main.css",
      "src/styles.css",
      "src/global.css",
    ]);
    for (const candidate of ENTRY_STYLESHEETS) {
      const { dir, write } = await project();
      await write(candidate, '@import "tailwindcss";\n');
      const found = await findEntryStylesheet(dir, join(dir, "src/styles/global.css"));
      expect(found).toMatchObject({ status: "replace", path: join(dir, candidate) });
    }

    const { dir, write } = await project();
    const themePath = join(dir, "src/styles/global.css");
    expect(await findEntryStylesheet(dir, themePath)).toBeNull();
    await write("src/index.css", "body {}\n");
    await write("src/main.css", '@import "tailwindcss";\n');
    await write("src/app.css", '@import "./styles/global.css";\n');
    expect(await findEntryStylesheet(dir, themePath)).toEqual({ status: "linked", path: join(dir, "src/app.css") });
  });

  test("findEntryStylesheet skips the theme file itself", async () => {
    const { dir, write } = await project();
    await write("src/index.css", '@import "tailwindcss";\n');
    expect(await findEntryStylesheet(dir, join(dir, "src/index.css"))).toBeNull();
    await write("src/global.css", '@import "tailwindcss";\n');
    expect(await findEntryStylesheet(dir, join(dir, "src/index.css"))).toEqual({
      status: "replace",
      specifier: "./index.css",
      content: '@import "./index.css";\n',
      path: join(dir, "src/global.css"),
    });
  });
});

describe("cli registry source", () => {
  const files = registryFiles(sampleItems());

  test("default location uses the pinned ref and the public/r directory", () => {
    const { fetch } = mockFetch(files);
    expect(DEFAULT_REGISTRY_REF).toBe(`v${CLI_VERSION}`);
    const source = createRegistrySource({ registry: undefined, ref: undefined, cwd: "/", fetch });
    expect(source.location).toBe(defaultRegistryUrl(DEFAULT_REGISTRY_REF));
    expect(source.itemTemplate).toBe(`${defaultRegistryUrl(DEFAULT_REGISTRY_REF)}/{name}.json`);
    expect(createRegistrySource({ registry: undefined, ref: "feature/x", cwd: "/", fetch }).location).toBe(
      "https://raw.githubusercontent.com/sinwanjs/sinwan-ui-registry/feature/x/public/r",
    );
    expect(() => createRegistrySource({ registry: undefined, ref: "a b", cwd: "/", fetch })).toThrow(/Invalid --ref/);
    expect(() => createRegistrySource({ registry: undefined, ref: "x/../y", cwd: "/", fetch })).toThrow(/Invalid --ref/);
    expect(() => createRegistrySource({ registry: "/r", ref: "main", cwd: "/", fetch })).toThrow(/--ref only applies/);
  });

  test("http registry reads JSON and fetches the index once", async () => {
    const mock = mockFetch(files);
    const source = createRegistrySource({ registry: `${REGISTRY_URL}//`, ref: undefined, cwd: "/", fetch: mock.fetch });
    expect(source.location).toBe(REGISTRY_URL);
    expect((await source.getIndex()).items.map((entry) => entry.name)).toContain("button");
    expect((await source.getIndex()).name).toBe("sinwan-ui");
    expect(await source.readJson(`${REGISTRY_URL}/slot.json`)).toMatchObject({ name: "slot" });
    expect(mock.urls).toEqual([`${REGISTRY_URL}/index.json`, `${REGISTRY_URL}/slot.json`]);
    expect(isHttpUrl("HTTP://x")).toBe(true);
    expect(isHttpUrl("./r")).toBe(false);
  });

  test("http errors include the URL and the --registry hint", async () => {
    const failing = createRegistrySource({
      registry: REGISTRY_URL,
      ref: undefined,
      cwd: "/",
      fetch: async () => {
        throw new Error("offline");
      },
    });
    const offline = await rejection(failing.getIndex());
    expect(offline.message).toContain(`Failed to fetch ${REGISTRY_URL}/index.json: offline`);
    expect(offline.message).toContain("--registry");

    const source = createRegistrySource({
      registry: REGISTRY_URL,
      ref: undefined,
      cwd: "/",
      fetch: mockFetch(new Map([["index.json", "{not json"]])).fetch,
    });
    expect((await rejection(source.readJson(`${REGISTRY_URL}/ghost.json`))).message).toContain(
      `${REGISTRY_URL}/ghost.json: HTTP 404`,
    );
    expect((await rejection(source.getIndex())).message).toContain(`Invalid JSON at ${REGISTRY_URL}/index.json`);
  });

  test("local registry resolves relative to cwd and validates the index", async () => {
    const { dir } = await project();
    await writeLocalRegistry(join(dir, "r"), files);
    const source = createRegistrySource({ registry: "r", ref: undefined, cwd: dir, fetch: mockFetch(files).fetch });
    expect(source.location).toBe(join(dir, "r"));
    expect(source.itemTemplate).toBe(join(dir, "r", "{name}.json"));
    expect((await source.getIndex()).version).toBe("0.1.0");
    expect(await source.readJson(join(dir, "r", "utils.json"))).toMatchObject({ name: "utils" });
    expect((await rejection(source.readJson(join(dir, "r", "ghost.json")))).message).toContain(
      `Cannot read ${join(dir, "r", "ghost.json")}`,
    );

    await writeFile(join(dir, "r", "index.json"), JSON.stringify({ version: 1, items: [] }));
    const fresh = createRegistrySource({ registry: "r", ref: undefined, cwd: dir, fetch: mockFetch(files).fetch });
    expect((await rejection(fresh.getIndex())).message).toBe(`Invalid registry index at ${join(dir, "r", "index.json")}.`);
  });
});

describe("cli write-files", () => {
  const paths: ProjectPaths = {
    projectDir: "/p",
    css: "/p/app.css",
    dirs: { components: "/p/src/components", ui: "/p/src/components/ui", lib: "/p/src/lib", hooks: "/p/src/hooks" },
    utils: "/p/src/helpers/cn",
  };
  const targets: InstallTargets = { paths, uiDir: paths.dirs.ui };

  test("targetPath maps each file type to its alias directory", () => {
    const destination = (type: RegistryItem["type"], path: string, target?: string): string => {
      const entry = item("x", { type, files: [{ path, content: "", ...(target === undefined ? {} : { target }) }] });
      const [file] = entry.files;
      if (!file) throw new Error("fixture");
      return targetPath(entry, file, targets);
    };
    expect(destination("registry:ui", "select/select.tsx")).toBe("/p/src/components/ui/select/select.tsx");
    expect(destination("registry:lib", "slot.ts")).toBe("/p/src/lib/slot.ts");
    expect(destination("registry:lib", "utils.ts")).toBe("/p/src/helpers/cn.ts");
    expect(destination("registry:lib", "utils.tsx")).toBe("/p/src/helpers/cn.tsx");
    expect(destination("registry:lib", "deep/utils.ts")).toBe("/p/src/lib/deep/utils.ts");
    expect(destination("registry:hook", "use-mobile.ts")).toBe("/p/src/hooks/use-mobile.ts");
    expect(destination("registry:block", "login/page.tsx")).toBe("/p/src/components/login/page.tsx");
    expect(destination("registry:style", "global.css")).toBe("/p/app.css");
    expect(destination("registry:file", "x", "server/x.ts")).toBe("/p/server/x.ts");
    expect(destination("registry:file", "scripts/x.ts")).toBe("/p/scripts/x.ts");
    expect(destination("registry:ui", "ignored.tsx", "src/other/button.tsx")).toBe("/p/src/other/button.tsx");
    expect(destination("registry:style", "g.css", "src/extra.css")).toBe("/p/src/extra.css");

    const ui = item("button", { files: [{ path: "button.tsx", content: "" }] });
    const [uiFile] = ui.files;
    if (!uiFile) throw new Error("fixture");
    expect(targetPath(ui, uiFile, { paths, uiDir: "/p/app/ui" })).toBe("/p/app/ui/button.tsx");
  });

  test("targetPath rejects escapes and multiple stylesheets", () => {
    const style = item("style", {
      type: "registry:style",
      files: [
        { path: "a.css", content: "" },
        { path: "b.css", content: "" },
      ],
    });
    const [styleFile] = style.files;
    if (!styleFile) throw new Error("fixture");
    expect(() => targetPath(style, styleFile, targets)).toThrow(/exactly one stylesheet/);

    for (const path of ["../evil.ts", "/etc/passwd", ".", "a/../../x.ts"]) {
      const ui = item("button", { files: [{ path, content: "" }] });
      const [file] = ui.files;
      if (!file) throw new Error("fixture");
      expect(() => targetPath(ui, file, targets)).toThrow(/unsafe file path/);
    }
    const escaping = item("f", { type: "registry:file", files: [{ path: "x", target: "../x.ts", content: "" }] });
    const [escapingFile] = escaping.files;
    if (!escapingFile) throw new Error("fixture");
    expect(() => targetPath(escaping, escapingFile, targets)).toThrow('unsafe file path "../x.ts"; files must stay inside /p');
  });

  test("planFiles rewrites imports and classifies create, identical and conflict", async () => {
    const { dir, write } = await project();
    const local: ProjectPaths = {
      projectDir: dir,
      css: join(dir, "src/styles/global.css"),
      dirs: {
        components: join(dir, "src/components"),
        ui: join(dir, "src/ui"),
        lib: join(dir, "src/lib"),
        hooks: join(dir, "src/hooks"),
      },
      utils: join(dir, "src/lib/utils"),
    };
    await write("src/lib/a.ts", 'import { cn } from "~/lib/utils";\n');
    await write("src/lib/b.ts", "old");
    const planned = await planFiles(
      [
        item("x", {
          type: "registry:lib",
          files: [
            { path: "a.ts", content: 'import { cn } from "@/lib/utils";\n' },
            { path: "b.ts", content: "new" },
            { path: "c.ts", content: 'export * from "@/components/ui/button";\n' },
          ],
        }),
      ],
      { paths: local, uiDir: local.dirs.ui },
      { aliases: { ...DEFAULT_ALIASES, ui: "~/ui", utils: "~/lib/utils" }, tsx: true },
    );
    expect(planned.map((file) => [file.display, file.status, file.content])).toEqual([
      ["src/lib/a.ts", "identical", 'import { cn } from "~/lib/utils";\n'],
      ["src/lib/b.ts", "conflict", "new"],
      ["src/lib/c.ts", "create", 'export * from "~/ui/button";\n'],
    ]);
  });

  async function scenario(
    options: { overwrite?: boolean; interactive?: boolean; dryRun?: boolean; answers?: ScriptedAnswer[] } = {},
  ) {
    const created = await project();
    await created.write("src/lib/a.ts", "same");
    await created.write("src/lib/b.ts", "old\n");
    const local: ProjectPaths = {
      projectDir: created.dir,
      css: join(created.dir, "src/styles/global.css"),
      dirs: {
        components: join(created.dir, "src/components"),
        ui: join(created.dir, "src/components/ui"),
        lib: join(created.dir, "src/lib"),
        hooks: join(created.dir, "src/hooks"),
      },
      utils: join(created.dir, "src/lib/utils"),
    };
    const planned = await planFiles(
      [
        item("x", {
          type: "registry:lib",
          files: [
            { path: "a.ts", content: "same" },
            { path: "b.ts", content: "new\n" },
            { path: "deep/c.ts", content: "fresh" },
          ],
        }),
      ],
      { paths: local, uiDir: local.dirs.ui },
      { aliases: DEFAULT_ALIASES, tsx: true },
    );
    const io = captureIo();
    const scripted = scriptedPrompts(options.answers ?? []);
    await writePlannedFiles(planned, {
      overwrite: options.overwrite ?? false,
      interactive: options.interactive ?? true,
      dryRun: options.dryRun ?? false,
      prompts: scripted.prompts,
      colors: PLAIN_COLORS,
      io,
    });
    return { ...created, io, calls: scripted.calls };
  }

  test("creates missing files and asks about conflicts", async () => {
    const declined = await scenario({ answers: ["skip"] });
    expect(await declined.read("src/lib/deep/c.ts")).toBe("fresh");
    expect(await declined.read("src/lib/b.ts")).toBe("old\n");
    expect(declined.calls).toEqual([
      {
        kind: "select",
        message: "src/lib/b.ts differs from the registry.",
        options: [
          { value: "skip", label: "Keep my file" },
          { value: "overwrite", label: "Overwrite with the registry version" },
          { value: "diff", label: "Show the diff" },
        ],
      },
    ]);
    expect(declined.io.out()).toBe(
      "Skipped src/lib/b.ts (differs from the registry; pass --overwrite to replace it)\nCreated src/lib/deep/c.ts\n",
    );

    const diffThenOverwrite = await scenario({ answers: ["diff", "overwrite"] });
    expect(await diffThenOverwrite.read("src/lib/b.ts")).toBe("new\n");
    expect(diffThenOverwrite.io.out()).toContain("--- src/lib/b.ts (local)\n+++ src/lib/b.ts (registry)\n");
    expect(diffThenOverwrite.io.out()).toContain("-old\n+new\n");
    expect(diffThenOverwrite.io.out()).toContain("Overwrote src/lib/b.ts\n");
    expect(diffThenOverwrite.calls).toHaveLength(2);
  });

  test("--overwrite decides without prompting; non-interactive keeps local files", async () => {
    const overwritten = await scenario({ overwrite: true });
    expect(await overwritten.read("src/lib/b.ts")).toBe("new\n");
    expect(overwritten.calls).toEqual([]);
    expect(overwritten.io.out()).toContain("Overwrote src/lib/b.ts");

    const kept = await scenario({ interactive: false });
    expect(await kept.read("src/lib/b.ts")).toBe("old\n");
    expect(kept.calls).toEqual([]);
    expect(kept.io.out()).toContain("Skipped src/lib/b.ts");
  });

  test("--dry-run reports the plan and writes nothing", async () => {
    const ask = await scenario({ dryRun: true });
    expect(ask.io.out()).toBe(
      "Would ask before overwriting src/lib/b.ts (differs from the registry)\nWould create src/lib/deep/c.ts\n",
    );
    expect(await pathExists(join(ask.dir, "src/lib/deep"))).toBe(false);
    expect(ask.calls).toEqual([]);
    expect((await scenario({ dryRun: true, interactive: false })).io.out()).toContain("Would skip src/lib/b.ts");
    const overwrite = await scenario({ dryRun: true, overwrite: true });
    expect(overwrite.io.out()).toContain("Would overwrite src/lib/b.ts");
    expect(await overwrite.read("src/lib/b.ts")).toBe("old\n");
  });
});
