import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_FILE, CONFIG_SCHEMA_URL, DEFAULT_ALIASES, MIGRATE_HINT } from "../src/config";
import { CORE_PACKAGE } from "../src/commands/init";
import { VITE_ALIAS_SNIPPET } from "../src/commands/path-alias";
import { VITE_AT_ALIAS_ENTRY } from "../src/vite-config-edit";
import { pathExists } from "../src/fs-utils";
import { type CliDeps, type Colors, helpText, run } from "../src/index";
import type { RegistryItem } from "../src/registry/schema";
import { CLI_VERSION, defaultRegistryUrl } from "../src/version";
import {
  ACME_URL,
  AT_TSCONFIG,
  BUTTON_SOURCE,
  captureIo,
  CANCEL,
  CONFIG,
  item,
  LEGACY_CONFIG,
  mockFetch,
  PLAIN_COLORS,
  type Project,
  recordInstalls,
  recordSpinner,
  REGISTRY_URL,
  registryFiles,
  sampleItems,
  type ScriptedAnswer,
  scriptedPrompts,
  TAGGED_COLORS,
  tempProject,
  writeLocalRegistry,
} from "./fixtures/cli/helpers";

const projects: Project[] = [];
async function project(packageJson?: unknown, tsconfig?: string | null): Promise<Project> {
  const created = await tempProject(packageJson, tsconfig);
  projects.push(created);
  return created;
}
afterEach(async () => {
  await Promise.all(projects.splice(0).map((entry) => entry.cleanup()));
});

const ALL_DEPS = { sinwan: "1", tailwindcss: "4", clsx: "2", "tailwind-merge": "3", "tw-animate-css": "1", "sinwan-ui-core": "1" };

/** A namespaced registry: `card` depends on its own `acme-utils` (bare name) and on default-registry `button` (URL). */
function acmeItems(): RegistryItem[] {
  return [
    item("acme-utils", { type: "registry:lib", files: [{ path: "acme.ts", content: "export const acme = 1;\n" }] }),
    item("card", {
      registryDependencies: ["acme-utils", `${REGISTRY_URL}/button.json`],
      devDependencies: ["@types/acme@^1.0.0"],
      files: [{ path: "card.tsx", content: 'import { button } from "@/components/ui/button";\nexport const card = button;\n' }],
    }),
  ];
}

interface Harness {
  project: Project;
  installs: ReturnType<typeof recordInstalls>;
  prompts: ReturnType<typeof scriptedPrompts>;
  spinner: ReturnType<typeof recordSpinner>;
  urls: string[];
  cli: (...argv: string[]) => Promise<{ code: number; out: string; err: string }>;
}

async function harness(
  options: {
    items?: RegistryItem[];
    packageJson?: unknown;
    tsconfig?: string | null;
    /** Answers for an interactive terminal; setting them makes the harness a TTY. */
    answers?: ScriptedAnswer[];
    tty?: boolean;
    colors?: Colors;
    installExitCode?: number;
    installOutput?: string;
    install?: CliDeps["install"];
    config?: unknown;
  } = {},
): Promise<Harness> {
  const created = await project(options.packageJson, options.tsconfig);
  if (options.config !== undefined) await created.write(CONFIG_FILE, JSON.stringify(options.config));
  const installs = recordInstalls(options.installExitCode, options.installOutput);
  const prompts = scriptedPrompts(options.answers ?? []);
  const spinner = recordSpinner();
  const mock = mockFetch(
    registryFiles(options.items ?? sampleItems()),
    REGISTRY_URL,
    new Map([[ACME_URL, registryFiles(acmeItems())]]),
  );
  return {
    project: created,
    installs,
    prompts,
    spinner,
    urls: mock.urls,
    cli: async (...argv) => {
      const io = captureIo();
      const code = await run([...argv, "--registry", REGISTRY_URL], io, {
        fetch: mock.fetch,
        prompts: prompts.prompts,
        spinner: spinner.spinner,
        colors: options.colors ?? PLAIN_COLORS,
        isTTY: options.tty ?? options.answers !== undefined,
        install: options.install ?? installs.install,
        cwd: created.dir,
      });
      return { code, out: io.out(), err: io.err() };
    },
  };
}

describe("sinwan-ui help, version and argument errors", () => {
  test("help and version use the default dependencies", async () => {
    for (const argv of [["--help"], ["help"], [], ["add", "-h"]]) {
      const io = captureIo();
      expect(await run(argv, io)).toBe(0);
      expect(io.out()).toBe(helpText(PLAIN_COLORS));
    }
    const help = helpText(PLAIN_COLORS);
    expect(help).toContain(`sinwan-ui ${CLI_VERSION}`);
    for (const command of ["init", "add [items...]", "list", "search <query>", "view <items...>", "diff [item]", "build [registry.json]"]) {
      expect(help).toContain(`sinwan-ui ${command}`);
    }
    for (const flag of ["--defaults", "--all", "--path <dir>", "--output <dir>"]) expect(help).toContain(flag);
    expect(help).toContain(`(default: v${CLI_VERSION})`);
    expect(help).toContain("/public/r");
    expect(helpText(TAGGED_COLORS)).toContain("<heading>Usage:</heading>");

    const io = captureIo();
    expect(await run(["--version"], io)).toBe(0);
    expect(io.out()).toBe(`${CLI_VERSION}\n`);
  });

  test("colours are applied through the injected palette", async () => {
    const { cli, project: app } = await harness({ colors: TAGGED_COLORS, packageJson: null });
    const result = await cli("init", "--yes");
    expect(result.out).toContain("<success>Created</success> sinwan-ui.json.");
    expect(result.out).toContain("<heading>Items:</heading> utils, style");
    expect(result.out).toContain("<warn>Next:</warn>");
    expect(result.out).toContain("<success>Done.</success>");
    expect(result.err).toContain("<warn>warning:</warn> no package.json");
    await app.write("src/lib/utils.ts", "// edited\n");
    expect((await cli("add", "utils", "--yes")).out).toContain("<warn>Skipped</warn> src/lib/utils.ts");
    expect((await cli("add", "utils", "--overwrite")).out).toContain("<success>Overwrote</success> src/lib/utils.ts");
    expect((await cli("init", "--yes", "--bogus")).err).toStartWith("<error>sinwan-ui:</error> ");
  });

  test("unknown commands and flags exit with 1", async () => {
    const io = captureIo();
    expect(await run(["ad"], io)).toBe(1);
    expect(io.err()).toBe('sinwan-ui: Unknown command "ad". Did you mean: add? Run "sinwan-ui --help" for usage.\n');

    const none = captureIo();
    expect(await run(["zzzzzzzz"], none)).toBe(1);
    expect(none.err()).toBe('sinwan-ui: Unknown command "zzzzzzzz". Run "sinwan-ui --help" for usage.\n');

    const flag = captureIo();
    expect(await run(["list", "--bogus"], flag)).toBe(1);
    expect(flag.err()).toContain("--bogus");
  });

  test("--ref cannot be combined with --registry", async () => {
    const { cli } = await harness();
    const result = await cli("list", "--ref", "main");
    expect(result.code).toBe(1);
    expect(result.err).toContain("--ref only applies to the default registry");
  });

  test("commands reject unexpected arguments", async () => {
    const { cli } = await harness({ config: CONFIG });
    expect((await cli("init", "extra")).err).toContain('"sinwan-ui init" takes no arguments (got: extra).');
    expect((await cli("list", "x")).err).toContain('"sinwan-ui list" takes no arguments');
    expect((await cli("diff", "a", "b")).err).toContain("Usage: sinwan-ui diff [item]");
    expect((await cli("search")).err).toContain("Usage: sinwan-ui search <query>");
    expect((await cli("search", " ")).code).toBe(1);
    expect((await cli("view")).err).toContain("Usage: sinwan-ui view <items...>");
  });
});

describe("sinwan-ui init", () => {
  test("--yes writes the v2 config, utils and style, and installs sinwan-ui-core with their packages", async () => {
    const { cli, project: app, installs } = await harness();
    await app.write("pnpm-lock.yaml", "");
    const result = await cli("init", "--yes");
    expect(result.code).toBe(0);
    expect(result.err).toBe("");
    expect(JSON.parse(await app.read(CONFIG_FILE))).toEqual({
      $schema: CONFIG_SCHEMA_URL,
      tsx: true,
      tailwind: { css: "src/styles/global.css" },
      aliases: DEFAULT_ALIASES,
      registries: {},
      packageManager: "pnpm",
    });
    expect(await app.read("src/lib/utils.ts")).toBe("export const cn = () => '';\n");
    expect(await app.read("src/styles/global.css")).toBe('@import "tailwindcss";\n');
    expect(await app.read("tsconfig.json")).toBe(AT_TSCONFIG);
    expect(installs.calls).toEqual([
      {
        command: ["pnpm", "add", CORE_PACKAGE, "clsx@^2.1.1", "tailwind-merge@^3.7.0", "tw-animate-css@^1.4.0"],
        cwd: app.dir,
      },
    ]);
    expect(result.out).toBe(
      [
        "Created sinwan-ui.json.",
        "Items: utils, style",
        "Created src/lib/utils.ts",
        "Created src/styles/global.css",
        'Next: in your main stylesheet, replace @import "tailwindcss"; with @import "./styles/global.css"; (path relative to src/index.css). src/styles/global.css already loads Tailwind.',
        `Running: pnpm add ${CORE_PACKAGE} clsx@^2.1.1 tailwind-merge@^3.7.0 tw-animate-css@^1.4.0`,
        'Done. Add components with "sinwan-ui add <items...>".',
        "",
      ].join("\n"),
    );
  });

  test("prompts for the stylesheet and aliases in a terminal, with spinners", async () => {
    const { cli, project: app, prompts, spinner, installs } = await harness({
      answers: [" app/theme.css ", true, true, "", "@/ui", "", "@/use"],
      tsconfig: '{ "compilerOptions": { "paths": { "@/*": ["./src/*"], "@/ui/*": ["./src/ui/*"] } } }',
    });
    const result = await cli("init");
    expect(result.code).toBe(0);
    expect(prompts.calls.map(({ kind, message }) => [kind, message])).toEqual([
      ["text", "Path of the global stylesheet (the theme)?"],
      ["confirm", "Use TypeScript (copy .tsx/.ts files instead of .jsx/.js)?"],
      ["confirm", "Customize import aliases (@/components, @/components/ui, @/lib, @/lib/utils, @/hooks)?"],
      ["text", "Import alias for components?"],
      ["text", "Import alias for UI components?"],
      ["text", "Import alias for lib?"],
      ["text", "Import alias for hooks?"],
    ]);
    expect(JSON.parse(await app.read(CONFIG_FILE))).toMatchObject({
      tailwind: { css: "app/theme.css" },
      aliases: { components: "@/components", ui: "@/ui", lib: "@/lib", utils: "@/lib/utils", hooks: "@/use" },
    });
    expect(await app.read("app/theme.css")).toContain("tailwindcss");
    expect(spinner.events).toEqual([
      { event: "start", message: "Fetching utils, style and dependencies" },
      { event: "stop", message: "Fetched 2 items" },
      { event: "start", message: `Running bun add ${CORE_PACKAGE} clsx@^2.1.1 tailwind-merge@^3.7.0 tw-animate-css@^1.4.0` },
      { event: "stop", message: "Installed 4 packages" },
    ]);
    expect(installs.quiet).toEqual([true]);
    expect(result.out).not.toContain("Running:");
  });

  test("--defaults skips the config prompts but still asks before editing files", async () => {
    const { cli, prompts, project: app } = await harness({ answers: [true], tsconfig: "{}\n" });
    const result = await cli("init", "--defaults");
    expect(result.code).toBe(0);
    expect(prompts.calls).toEqual([{ kind: "confirm", message: "Add the @/* path alias to tsconfig.json?" }]);
    expect(JSON.parse(await app.read("tsconfig.json"))).toEqual({ compilerOptions: { paths: { "@/*": ["./src/*"] } } });
    expect(result.out).toContain('Updated tsconfig.json: added "@/*": ["./src/*"] to compilerOptions.paths.\n');
  });

  test("cancelling a prompt exits with 1 and writes nothing", async () => {
    const { cli, project: app } = await harness({ answers: [CANCEL] });
    const result = await cli("init");
    expect(result).toEqual({ code: 1, out: "", err: "Cancelled.\n" });
    expect(await pathExists(join(app.dir, CONFIG_FILE))).toBe(false);
  });

  test("a failed install stops the spinner and shows the captured output", async () => {
    const { cli, spinner } = await harness({
      answers: [],
      config: CONFIG,
      installExitCode: 1,
      installOutput: "  error: registry unreachable\n",
    });
    const result = await cli("add", "utils");
    expect(result.code).toBe(1);
    expect(result.err).toBe(
      'sinwan-ui: "bun add clsx@^2.1.1 tailwind-merge@^3.7.0" exited with code 1; install the packages manually.\nerror: registry unreachable\n',
    );
    expect(spinner.events.at(-1)).toEqual({ event: "fail", message: "Running bun add clsx@^2.1.1 tailwind-merge@^3.7.0" });
  });

  test("--dry-run in a terminal stays plain", async () => {
    const { cli, spinner } = await harness({ tty: true, config: CONFIG });
    expect((await cli("add", "utils", "--dry-run", "--yes")).code).toBe(0);
    expect(spinner.events).toEqual([]);
  });

  test("warns when sinwan or tailwindcss are missing", async () => {
    const noManifest = await harness({ packageJson: null });
    const result = await noManifest.cli("init", "--yes");
    expect(result.code).toBe(0);
    expect(result.err).toBe(`warning: no package.json in ${noManifest.project.dir}; sinwan-ui needs sinwan and tailwindcss.\n`);

    const bare = await harness({ packageJson: { dependencies: {} } });
    expect((await bare.cli("init", "--yes")).err).toBe(
      'warning: "sinwan" is not in package.json; sinwan-ui components need it.\n' +
        'warning: "tailwindcss" is not in package.json; sinwan-ui components need it.\n',
    );
  });

  test("reuses an existing config", async () => {
    const { cli, project: app } = await harness({
      config: { ...CONFIG, tailwind: { css: "src/app.css" }, packageManager: "yarn" },
      packageJson: { dependencies: ALL_DEPS },
    });
    const result = await cli("init");
    expect(result.code).toBe(0);
    expect(result.out).toContain("Using existing sinwan-ui.json.\n");
    expect(result.out).toContain("No new npm packages to install.\n");
    expect(await app.read("src/app.css")).toContain("tailwindcss");
  });

  test("--dry-run changes nothing", async () => {
    const { cli, project: app, installs } = await harness({ tsconfig: null });
    const result = await cli("init", "--yes", "--dry-run");
    expect(result.code).toBe(0);
    expect(result.out).toContain(`Would create sinwan-ui.json:\n{\n  "$schema": "${CONFIG_SCHEMA_URL}",`);
    expect(result.out).toContain('Would add "@/*": ["./src/*"] to compilerOptions.paths in jsconfig.json.\n');
    expect(result.out).toContain("Would create src/lib/utils.js\n");
    expect(result.out).toContain(`Would run: bun add ${CORE_PACKAGE} clsx@^2.1.1 tailwind-merge@^3.7.0 tw-animate-css@^1.4.0\n`);
    expect(await pathExists(join(app.dir, CONFIG_FILE))).toBe(false);
    expect(await pathExists(join(app.dir, "jsconfig.json"))).toBe(false);
    expect(await pathExists(join(app.dir, "src"))).toBe(false);
    expect(installs.calls).toEqual([]);
  });

  test("writes nothing when the registry is invalid", async () => {
    const missingStyle = await harness({ items: sampleItems().filter((entry) => entry.name !== "style"), tsconfig: null });
    const result = await missingStyle.cli("init", "--yes");
    expect(result.code).toBe(1);
    expect(result.err).toContain('Unknown item "style"');
    expect(await pathExists(join(missingStyle.project.dir, CONFIG_FILE))).toBe(false);
    expect(await pathExists(join(missingStyle.project.dir, "jsconfig.json"))).toBe(false);
  });

  test("unexpected file-system errors are reported", async () => {
    const { cli, project: app } = await harness();
    await app.write("not-a-dir", "");
    const result = await cli("init", "--yes", "--cwd", "not-a-dir");
    expect(result.code).toBe(1);
    expect(result.err).toStartWith("sinwan-ui: unexpected error: ");
  });
});

describe("sinwan-ui init: path alias and Vite", () => {
  test("creates jsconfig.json (JS) or tsconfig.json when the project has neither", async () => {
    const js = await harness({ tsconfig: null });
    const result = await js.cli("init", "--yes");
    expect(result.code).toBe(0);
    expect(result.out).toContain("Created jsconfig.json with the @/* path alias.\n");
    expect(JSON.parse(await js.project.read(CONFIG_FILE)).tsx).toBe(false);
    expect(JSON.parse(await js.project.read("jsconfig.json"))).toEqual({ compilerOptions: { paths: { "@/*": ["./src/*"] } } });
    expect(await js.project.read("src/lib/utils.js")).toBe("export const cn = () => \"\";\n");
  });

  test("edits a commented tsconfig in place; a referenced tsconfig.app.json is the target", async () => {
    const vite = await harness({ tsconfig: '{ "files": [], "references": [{ "path": "./tsconfig.app.json" }] }' });
    await vite.project.write(
      "tsconfig.app.json",
      '{\n  "compilerOptions": {\n    /* Bundler mode */\n    "moduleResolution": "bundler",\n    "baseUrl": "."\n  },\n  "include": ["src"]\n}\n',
    );
    const result = await vite.cli("init", "--yes");
    expect(result.code).toBe(0);
    expect(await vite.project.read("tsconfig.app.json")).toBe(
      '{\n  "compilerOptions": {\n    "paths": { "@/*": ["./src/*"] },\n    /* Bundler mode */\n    "moduleResolution": "bundler",\n    "baseUrl": "."\n  },\n  "include": ["src"]\n}\n',
    );
    expect(result.out).toContain('Updated tsconfig.app.json: added "@/*": ["./src/*"] to compilerOptions.paths.\n');
    expect(await vite.project.read("src/lib/utils.ts")).toContain("cn");

    const again = await vite.cli("init", "--yes");
    expect(again.out).not.toContain("tsconfig.app.json");
  });

  test("prints the snippet when the file cannot be edited safely or paths are inherited", async () => {
    const unsafe = await harness({ tsconfig: '// header\n{ "compilerOptions": { "paths": [] } }' });
    const result = await unsafe.cli("init", "--yes");
    expect(result.code).toBe(0);
    expect(result.err).toContain(
      'warning: cannot edit tsconfig.json safely; add "@/*": ["./src/*"] to compilerOptions.paths in tsconfig.json:\n  "paths": { "@/*": ["./src/*"] }\n',
    );

    const inherited = await harness({ tsconfig: '{ "extends": "./base.json" }' });
    await inherited.project.write("base.json", '{ "compilerOptions": { "paths": { "#x/*": ["./x/*"] } } }');
    const inheritedResult = await inherited.cli("init", "--yes");
    expect(inheritedResult.err).toContain('warning: tsconfig.json inherits compilerOptions.paths through "extends"');
    expect(await inherited.project.read("tsconfig.json")).toBe('{ "extends": "./base.json" }');
  });

  test("a declined edit leaves the file and explains the alias", async () => {
    const { cli, project: app } = await harness({ answers: ["", true, false, false], tsconfig: "{}" });
    const result = await cli("init");
    expect(result.code).toBe(0);
    expect(await app.read("tsconfig.json")).toBe("{}");
    expect(result.out).toContain('Next: add "@/*": ["./src/*"] to compilerOptions.paths in tsconfig.json; copied files import through it.\n');
  });

  test("custom aliases that do not resolve are an error", async () => {
    const { cli, project: app } = await harness({
      config: { ...CONFIG, aliases: { ...DEFAULT_ALIASES, ui: "~/ui", hooks: "~/hooks" } },
    });
    const result = await cli("init", "--yes");
    expect(result.code).toBe(1);
    expect(result.err).toBe(
      'sinwan-ui: These sinwan-ui.json aliases are not mapped by compilerOptions.paths in tsconfig.json: ui "~/ui", hooks "~/hooks". Add matching paths, then re-run "sinwan-ui init".\n',
    );
    expect(await pathExists(join(app.dir, "src"))).toBe(false);

    const noConfig = await harness({ config: { ...CONFIG, aliases: { ...DEFAULT_ALIASES, ui: "~/ui" } }, tsconfig: null });
    expect((await noConfig.cli("init", "--yes")).err).toContain("not mapped by a tsconfig.json or jsconfig.json: ui");
  });

  test("adds the @ alias to a Vite config without one", async () => {
    const { cli, project: app } = await harness({ packageJson: { dependencies: ALL_DEPS } });
    const original = 'import { defineConfig } from "vite";\n\nexport default defineConfig({\n  plugins: [],\n});\n';
    await app.write("vite.config.mts", original);
    await app.write("vite.config.mjs", "ignored, the first config wins");

    const dryRun = await cli("init", "--yes", "--dry-run");
    expect(dryRun.out).toContain('Would add the "@" alias to resolve.alias in vite.config.mts.\n');
    expect(await app.read("vite.config.mts")).toBe(original);

    const result = await cli("init", "--yes");
    expect(result.err).toBe("");
    expect(result.out).toContain('Updated vite.config.mts: added the "@" alias to resolve.alias.\n');
    expect(await app.read("vite.config.mts")).toBe(
      'import { fileURLToPath } from "node:url";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({\n' +
        `  resolve: { alias: { ${VITE_AT_ALIAS_ENTRY} } },\n  plugins: [],\n});\n`,
    );
    expect(await app.read("vite.config.mjs")).toBe("ignored, the first config wins");

    const again = await cli("init", "--yes");
    expect(again.out).not.toContain("vite.config.mts");
    for (const aliased of ['resolve: { alias: { "@": src } }', "alias: [{ find: '@', replacement: src }]", "alias: { '@/': src }"]) {
      await app.write("vite.config.mts", `export default defineConfig({ ${aliased} });\n`);
      const kept = await cli("init", "--yes");
      expect(kept.err).toBe("");
      expect(kept.out).not.toContain("vite.config.mts");
    }
  });

  test("prints the Vite snippet when the config cannot be edited safely", async () => {
    const { cli, project: app } = await harness({ packageJson: { dependencies: ALL_DEPS } });
    const unsafe = "export default defineConfig({ resolve: { dedupe: [] } });\n";
    await app.write("vite.config.ts", unsafe);
    const result = await cli("init", "--yes");
    expect(result.err).toBe(
      `warning: vite.config.ts has no "@" entry in resolve.alias, so Vite cannot resolve "@/…" imports. Add:\n${VITE_ALIAS_SNIPPET}\n`,
    );
    expect(await app.read("vite.config.ts")).toBe(unsafe);
  });

  test("asks before editing the Vite config in a terminal", async () => {
    const original = "export default defineConfig({ plugins: [] });\n";
    const declined = await harness({ answers: [false], packageJson: { dependencies: ALL_DEPS } });
    await declined.project.write("vite.config.js", original);
    const result = await declined.cli("init", "--defaults");
    expect(result.code).toBe(0);
    expect(declined.prompts.calls).toEqual([{ kind: "confirm", message: 'Add the "@" alias to resolve.alias in vite.config.js?' }]);
    expect(result.out).toContain(
      `Next: add the "@" alias to resolve.alias in vite.config.js; Vite ignores tsconfig paths:\n${VITE_ALIAS_SNIPPET}\n`,
    );
    expect(await declined.project.read("vite.config.js")).toBe(original);

    const accepted = await harness({ answers: [true], packageJson: { dependencies: ALL_DEPS } });
    await accepted.project.write("vite.config.js", original);
    expect((await accepted.cli("init", "--defaults")).code).toBe(0);
    expect(await accepted.project.read("vite.config.js")).toBe(
      `import { fileURLToPath } from "node:url";\nexport default defineConfig({ resolve: { alias: { ${VITE_AT_ALIAS_ENTRY} } }, plugins: [] });\n`,
    );
  });
});

describe('sinwan-ui with "tsx": false (JavaScript projects)', () => {
  const JS_CONFIG = { ...CONFIG, tsx: false };
  const JSCONFIG = AT_TSCONFIG;
  const jsItems = (): RegistryItem[] => [
    ...sampleItems(),
    item("chart", {
      files: [
        { path: "chart/index.ts", content: 'export * from "./chart.tsx";\n' },
        {
          path: "chart/chart.tsx",
          content:
            'import { cn } from "@/lib/utils";\nexport interface ChartProps { title: string }\n/** @sinwan-pure */\nexport function label(p: ChartProps): string {\n  return p.title;\n}\nexport const Chart = (p: ChartProps) => <figure class={cn("chart")}>{label(p)}</figure>;\n',
        },
        { path: "chart/echarts-gl.d.ts", content: 'declare module "echarts-gl";\n' },
        { path: "chart/chart.css", content: ".chart {}\n" },
      ],
    }),
    item("server-util", { type: "registry:file", files: [{ path: "x", target: "server/util.ts", content: "export const n: number = 1;\n" }] }),
  ];

  test("init sets tsx: false for a jsconfig-only project without asking, and asks otherwise", async () => {
    const js = await harness({ tsconfig: null, answers: ["", false] });
    await js.project.write("jsconfig.json", JSCONFIG);
    expect((await js.cli("init")).code).toBe(0);
    expect(js.prompts.calls.map(({ message }) => message)).toEqual([
      "Path of the global stylesheet (the theme)?",
      "Customize import aliases (@/components, @/components/ui, @/lib, @/lib/utils, @/hooks)?",
    ]);
    expect(JSON.parse(await js.project.read(CONFIG_FILE)).tsx).toBe(false);
    expect(await pathExists(join(js.project.dir, "src/lib/utils.js"))).toBe(true);
    expect(await pathExists(join(js.project.dir, "src/lib/utils.ts"))).toBe(false);

    const neither = await harness({ tsconfig: null, answers: ["", true, false, true] });
    expect((await neither.cli("init")).code).toBe(0);
    expect(neither.prompts.calls[1]?.message).toBe("Use TypeScript (copy .tsx/.ts files instead of .jsx/.js)?");
    expect(JSON.parse(await neither.project.read(CONFIG_FILE)).tsx).toBe(true);
    expect(await pathExists(join(neither.project.dir, "tsconfig.json"))).toBe(true);
  });

  test("add converts .tsx/.ts to .jsx/.js with JSX and behaviour comments kept, and skips .d.ts files", async () => {
    const { cli, project: app } = await harness({ config: JS_CONFIG, tsconfig: null, items: jsItems() });
    await app.write("jsconfig.json", JSCONFIG);
    const result = await cli("add", "chart", "server-util", "button", "--yes");
    expect(result.code).toBe(0);
    expect(result.out).toContain("Created src/components/ui/chart/index.js\nCreated src/components/ui/chart/chart.jsx\nCreated src/components/ui/chart/chart.css\n");
    expect(result.out).not.toContain("echarts-gl");
    expect(await app.read("src/components/ui/chart/index.js")).toBe('export * from "./chart.jsx";\n');
    expect(await app.read("src/components/ui/chart/chart.jsx")).toBe(
      'import { cn } from "@/lib/utils";\n/** @sinwan-pure */\nexport function label(p) {\n  return p.title;\n}\nexport const Chart = (p) => <figure class={cn("chart")}>\n  {label(p)}\n</figure>;\n',
    );
    expect(await app.read("src/lib/utils.js")).toBe('export const cn = () => "";\n');
    expect(await app.read("server/util.js")).toBe("export const n = 1;\n");
    expect(await app.read("src/components/ui/button.jsx")).toContain('import { Spinner } from "@/components/ui/spinner";');
    expect(await pathExists(join(app.dir, "src/components/ui/chart/echarts-gl.d.ts"))).toBe(false);

    expect((await cli("diff", "chart")).out).toBe("chart matches the registry.\n");
    expect((await cli("diff")).out).toBe("6 installed items match the registry.\n");
    expect((await cli("list")).out).toContain("  ✓ chart ");
    await app.write("src/components/ui/chart/chart.jsx", "changed\n");
    const changed = await cli("diff");
    expect(changed.code).toBe(1);
    expect(changed.out).toContain("  chart: src/components/ui/chart/chart.jsx\n");
  });

  test("a file that cannot be converted stops add before writing", async () => {
    const broken = [item("broken", { files: [{ path: "broken.tsx", content: "export const = ;\n" }] })];
    const { cli, project: app } = await harness({ config: JS_CONFIG, items: broken });
    const result = await cli("add", "broken", "--yes");
    expect(result.code).toBe(1);
    expect(result.err).toContain('sinwan-ui: Cannot convert broken.tsx to JavaScript (');
    expect(result.err).toContain('Set "tsx": true in sinwan-ui.json to copy TypeScript instead.');
    expect(await pathExists(join(app.dir, "src"))).toBe(false);
  });
});

describe("sinwan-ui init: migrating a v1 config", () => {
  test("--yes migrates, keeping the stylesheet and package manager", async () => {
    const { cli, project: app } = await harness({ config: LEGACY_CONFIG });
    const result = await cli("init", "--yes");
    expect(result.code).toBe(0);
    expect(result.out).toStartWith("Migrated sinwan-ui.json to the new format.\n");
    expect(JSON.parse(await app.read(CONFIG_FILE))).toMatchObject({
      tailwind: { css: "src/app.css" },
      aliases: DEFAULT_ALIASES,
      packageManager: "pnpm",
    });
  });

  test("asks in a terminal; declining leaves the file", async () => {
    const declined = await harness({ config: { baseDir: "src" }, answers: [false] });
    const result = await declined.cli("init");
    expect(result.code).toBe(1);
    expect(result.err).toBe("sinwan-ui: sinwan-ui.json was left unchanged; the CLI needs the new format to continue.\n");
    expect(JSON.parse(await declined.project.read(CONFIG_FILE))).toEqual({ baseDir: "src" });

    const accepted = await harness({ config: { baseDir: "src" }, answers: [true] });
    await accepted.project.write("yarn.lock", "");
    const dryRun = await accepted.cli("init", "--dry-run");
    expect(dryRun.out).toContain("Would migrate sinwan-ui.json:\n");
    expect(dryRun.out).toContain('"packageManager": "yarn"');
    expect(dryRun.out).toContain('"css": "src/styles/global.css"');
  });

  test("other commands ask for init", async () => {
    const { cli } = await harness({ config: LEGACY_CONFIG });
    expect((await cli("add", "button")).err).toBe(`sinwan-ui: ${MIGRATE_HINT}\n`);
    expect((await cli("list")).err).toBe(`sinwan-ui: ${MIGRATE_HINT}\n`);
    expect((await cli("view", "slot")).code).toBe(0);
  });
});

describe("sinwan-ui init links the theme from the entry stylesheet", () => {
  const ENTRY = '@import "tailwindcss";\r\n\r\n@layer base {\r\n  :root { color: red; }\r\n}\r\n';
  const LINKED = '@import "./styles/global.css";\r\n\r\n@layer base {\r\n  :root { color: red; }\r\n}\r\n';
  const REPLACED =
    'Replaced @import "tailwindcss" in src/index.css with @import "./styles/global.css"; (the theme loads Tailwind).\n';

  test("--yes replaces the Tailwind import and a second init changes nothing", async () => {
    const { cli, project: app } = await harness();
    await app.write("src/index.css", ENTRY);
    const first = await cli("init", "--yes");
    expect(first.code).toBe(0);
    expect(first.out).toContain(`Created src/styles/global.css\n${REPLACED}Running: bun add`);
    expect(await app.read("src/index.css")).toBe(LINKED);

    const configBefore = await app.read(CONFIG_FILE);
    const second = await cli("init", "--yes");
    expect(second.code).toBe(0);
    expect(second.out).toContain("src/index.css already imports src/styles/global.css.\n");
    expect(second.out).not.toContain("Created");
    expect(await app.read("src/index.css")).toBe(LINKED);
    expect(await app.read(CONFIG_FILE)).toBe(configBefore);
  });

  test("asks for confirmation without --yes", async () => {
    const accepted = await harness({ answers: ["", true, false, true] });
    await accepted.project.write("src/app.css", "@import 'tailwindcss'\n.app {}\n");
    expect((await accepted.cli("init")).code).toBe(0);
    expect(accepted.prompts.calls[3]).toEqual({
      kind: "confirm",
      message: 'Replace @import "tailwindcss" in src/app.css with @import "./styles/global.css";?',
    });
    expect(await accepted.project.read("src/app.css")).toBe('@import "./styles/global.css";\n.app {}\n');

    const declined = await harness({ answers: ["", true, false, false] });
    await declined.project.write("src/index.css", ENTRY);
    const result = await declined.cli("init");
    expect(result.code).toBe(0);
    expect(await declined.project.read("src/index.css")).toBe(ENTRY);
    expect(result.out).toContain('Next: in your main stylesheet, replace @import "tailwindcss"; with @import "./styles/global.css";');
  });

  test("--dry-run prints the planned edit and changes nothing", async () => {
    const { cli, project: app, prompts } = await harness({ answers: ["", true, false] });
    await app.write("src/index.css", ENTRY);
    const result = await cli("init", "--dry-run");
    expect(result.out).toContain('Would replace @import "tailwindcss" in src/index.css with @import "./styles/global.css";\n');
    expect(await app.read("src/index.css")).toBe(ENTRY);
    expect(prompts.calls.map((call) => call.kind)).toEqual(["text", "confirm", "confirm"]);
  });

  test("never rewrites the theme file itself", async () => {
    const { cli, project: app } = await harness({
      config: { ...CONFIG, tailwind: { css: "src/index.css" } },
      packageJson: { dependencies: ALL_DEPS },
    });
    const result = await cli("init", "--yes");
    expect(result.code).toBe(0);
    expect(await app.read("src/index.css")).toBe('@import "tailwindcss";\n');
    expect(result.out).toContain('with @import "./index.css"; (path relative to src/index.css)');
  });
});

describe("sinwan-ui add", () => {
  test("requires a valid config and resolvable aliases", async () => {
    const { cli } = await harness();
    const result = await cli("add", "button");
    expect(result.code).toBe(1);
    expect(result.err).toContain("No sinwan-ui.json found");
    expect(result.err).toContain('Run "sinwan-ui init" first.');

    const invalid = await harness({ config: { ...CONFIG, tsx: "yes" } });
    expect((await invalid.cli("add", "button")).err).toContain('Invalid sinwan-ui.json:\n  - "tsx" must be true or false');

    const unmapped = await harness({ config: CONFIG, tsconfig: "{}" });
    expect((await unmapped.cli("add", "button")).err).toContain(
      'Cannot resolve the "components" alias "@/components" from sinwan-ui.json: no compilerOptions.paths entry in tsconfig.json matches it.',
    );
  });

  test("resolves dependencies, writes files and installs missing packages", async () => {
    const { cli, project: app, installs, urls } = await harness({
      config: CONFIG,
      packageJson: { dependencies: { sinwan: "1", clsx: "2" } },
    });
    const result = await cli("add", "dialog", "--cwd", ".");
    expect(result.code).toBe(0);
    expect(result.out).toContain("Items: utils, spinner, slot, button, dialog\n");
    for (const path of [
      "src/lib/utils.ts",
      "src/lib/slot.ts",
      "src/components/ui/spinner.tsx",
      "src/components/ui/button.tsx",
      "src/components/ui/dialog/index.ts",
      "src/components/ui/dialog/dialog.tsx",
    ]) {
      expect(await pathExists(join(app.dir, path))).toBe(true);
    }
    expect(await app.read("src/components/ui/button.tsx")).toBe(BUTTON_SOURCE);
    expect(installs.calls).toEqual([
      {
        command: ["bun", "add", "tailwind-merge@^3.7.0", "class-variance-authority@^0.7.1", "@floating-ui/dom@^1.8.0"],
        cwd: app.dir,
      },
    ]);
    expect(urls[0]).toBe(`${REGISTRY_URL}/index.json`);
    expect(urls.filter((url) => url.endsWith("/utils.json"))).toHaveLength(1);

    const again = await cli("add", "button");
    expect(again.out).toBe(
      "Items: utils, spinner, slot, button\nRunning: bun add tailwind-merge@^3.7.0 class-variance-authority@^0.7.1\n",
    );
  });

  test("rewrites canonical imports to customised aliases and --path moves ui files", async () => {
    const { cli, project: app } = await harness({
      config: { ...CONFIG, aliases: { ...DEFAULT_ALIASES, ui: "@/ui", utils: "@/lib/cn" } },
    });
    expect((await cli("add", "button", "--yes")).code).toBe(0);
    expect(await app.read("src/ui/button.tsx")).toBe(
      'import { cn } from "@/lib/cn";\nimport { Spinner } from "@/ui/spinner";\nimport { Slot } from "@/lib/slot";\nexport const button = cn(Spinner, Slot);\n',
    );
    expect(await app.read("src/lib/cn.ts")).toContain("cn");

    expect((await cli("add", "spinner", "--path", "src/widgets", "--yes")).code).toBe(0);
    expect(await pathExists(join(app.dir, "src/widgets/spinner.tsx"))).toBe(true);
    expect((await cli("add", "spinner", "--path", "../x")).err).toContain(
      '--path must be a relative directory inside the project (got "../x").',
    );
  });

  test("--all adds every index item; names and --all are exclusive", async () => {
    const { cli, project: app } = await harness({ config: CONFIG });
    const result = await cli("add", "--all", "--yes");
    expect(result.code).toBe(0);
    expect(result.out).toContain("Items: utils, style, slot, spinner, button, dialog\n");
    expect(await pathExists(join(app.dir, "src/components/ui/dialog/dialog.tsx"))).toBe(true);
    expect((await cli("add", "button", "--all")).err).toBe("sinwan-ui: Pass item names or --all, not both.\n");
  });

  test("namespaced items keep bare dependencies in their registry and install devDependencies with -D", async () => {
    const { cli, project: app, installs } = await harness({ config: CONFIG, packageJson: { dependencies: ALL_DEPS } });
    const result = await cli("add", "@acme/card", "--yes");
    expect(result.code).toBe(0);
    expect(result.out).toContain("Items: acme-utils, utils, spinner, slot, button, card\n");
    expect(await app.read("src/lib/acme.ts")).toBe("export const acme = 1;\n");
    expect(await app.read("src/components/ui/card.tsx")).toContain('from "@/components/ui/button"');
    expect(installs.calls.map((call) => call.command)).toEqual([
      ["bun", "add", "class-variance-authority@^0.7.1"],
      ["bun", "add", "-D", "@types/acme@^1.0.0"],
    ]);

    const unknown = await cli("add", "@nope/card");
    expect(unknown.err).toBe('sinwan-ui: Unknown registry "@nope" in "@nope/card". Configured registries: @acme.\n');
  });

  test("accepts item URLs and local item JSON paths", async () => {
    const { cli, project: app } = await harness({ config: CONFIG });
    expect((await cli("add", `${ACME_URL}/acme-utils.json`, "--yes")).out).toContain("Items: acme-utils\n");
    await app.write("items/local.json", JSON.stringify(item("local", { registryDependencies: ["./helper.json"] })));
    await app.write("items/helper.json", JSON.stringify(item("helper", { type: "registry:hook", files: [{ path: "use-helper.ts", content: "" }] })));
    const result = await cli("add", "./items/local.json", "--yes");
    expect(result.out).toContain("Items: helper, local\n");
    expect(await pathExists(join(app.dir, "src/hooks/use-helper.ts"))).toBe(true);
    expect(await pathExists(join(app.dir, "src/components/ui/local.tsx"))).toBe(true);
  });

  test("merges cssVars into the stylesheet idempotently", async () => {
    const themed = [
      ...sampleItems(),
      item("theme-blue", {
        type: "registry:style",
        files: [],
        cssVars: { light: { primary: "blue" }, dark: { primary: "navy" } },
      }),
    ];
    const { cli, project: app } = await harness({ config: CONFIG, items: themed, packageJson: { dependencies: ALL_DEPS } });
    await app.write("src/styles/global.css", ":root {\n  --primary: red;\n}\n");
    const first = await cli("add", "theme-blue", "--yes");
    expect(first.out).toContain("Updated CSS variables in src/styles/global.css (1 added, 0 updated)\n");
    expect(await app.read("src/styles/global.css")).toBe(":root {\n  --primary: red;\n}\n\n.dark {\n  --primary: navy;\n}\n");
    expect((await cli("add", "theme-blue", "--yes")).out).toContain("CSS variables already in src/styles/global.css.\n");
    expect((await cli("add", "theme-blue", "--overwrite", "--dry-run")).out).toContain(
      "Would update CSS variables in src/styles/global.css (0 added, 1 updated)\n",
    );
    expect((await cli("add", "theme-blue", "--overwrite")).code).toBe(0);
    expect(await app.read("src/styles/global.css")).toContain("--primary: blue;");
  });

  test("cssVars in a dry run start from the planned stylesheet", async () => {
    const themed = [
      item("style", {
        type: "registry:style",
        files: [{ path: "global.css", content: ":root {\n  --a: 1;\n}\n" }],
        cssVars: { light: { a: "1", b: "2" } },
      }),
    ];
    const { cli } = await harness({ config: CONFIG, items: themed });
    const result = await cli("add", "style", "--dry-run");
    expect(result.out).toContain("Would create src/styles/global.css\nWould update CSS variables in src/styles/global.css (1 added, 0 updated)\n");
    const empty = await harness({ config: CONFIG, items: [item("vars", { files: [], cssVars: { light: { a: "1" } } })] });
    expect((await empty.cli("add", "vars", "--dry-run")).out).toContain("(1 added, 0 updated)");
  });

  test("conflicting local files follow --overwrite, --yes and the prompt", async () => {
    const { cli, project: app, prompts } = await harness({ config: CONFIG, answers: ["skip"] });
    await app.write("src/lib/slot.ts", "// my edits\n");
    expect((await cli("add", "slot", "--yes")).out).toContain("Skipped src/lib/slot.ts");
    expect(await app.read("src/lib/slot.ts")).toBe("// my edits\n");

    expect((await cli("add", "slot")).out).toContain("Skipped src/lib/slot.ts");
    expect(prompts.calls).toHaveLength(1);

    expect((await cli("add", "slot", "--overwrite")).out).toContain("Overwrote src/lib/slot.ts");
    expect(await app.read("src/lib/slot.ts")).toBe("export const Slot = 1;\n");
  });

  test("without items, a terminal shows a multiselect marking installed items", async () => {
    const { cli, project: app, prompts, installs } = await harness({ config: CONFIG, answers: [["slot", "spinner"]] });
    await app.write("src/lib/utils.ts", "export const cn = () => '';\n");
    const result = await cli("add");
    expect(result.code).toBe(0);
    const [question] = prompts.calls;
    expect(question?.kind).toBe("multiselect");
    expect(question?.message).toBe("Which items do you want to add?");
    expect(question?.options?.slice(0, 2)).toEqual([
      { value: "utils", label: "utils", hint: "installed · The utils item" },
      { value: "style", label: "style", hint: "The style item" },
    ]);
    expect(question?.options?.[4]).toEqual({ value: "button", label: "Button", hint: "The button item" });
    expect(question?.options).toHaveLength(6);
    expect(result.out).toContain("Items: slot, utils, spinner\n");
    expect(await pathExists(join(app.dir, "src/components/ui/spinner.tsx"))).toBe(true);
    expect(installs.quiet).toEqual([true]);
  });

  test("without items and without a terminal (or with --yes), add fails instead of hanging", async () => {
    const { cli, prompts } = await harness({ config: CONFIG });
    const plain = await cli("add");
    expect(plain.code).toBe(1);
    expect(plain.err).toBe('sinwan-ui: add requires at least one item, or --all (run "sinwan-ui list" to see all items).\n');
    const tty = await harness({ config: CONFIG, tty: true });
    expect((await tty.cli("add", "--yes")).err).toContain("add requires at least one item");
    expect(prompts.calls).toEqual([]);
    expect(tty.prompts.calls).toEqual([]);
  });

  test("unknown items list close matches; unknown dependencies name their dependent", async () => {
    const { cli } = await harness({ config: CONFIG });
    const result = await cli("add", "buton");
    expect(result.code).toBe(1);
    expect(result.err).toBe('sinwan-ui: Unknown item "buton". Did you mean: button? Run "sinwan-ui list" to see all items.\n');
    expect((await cli("add", "Bad Name")).err).toContain('Invalid item "Bad Name"');

    const broken = await harness({ config: CONFIG, items: [item("a", { registryDependencies: ["ghost"] })] });
    expect((await broken.cli("add", "a")).err).toBe('sinwan-ui: Registry item "a" depends on unknown item "ghost".\n');
  });

  test("rejects registry paths that escape their directory before writing anything", async () => {
    const items = [
      item("safe", { type: "registry:lib", files: [{ path: "safe.ts", content: "ok" }] }),
      item("evil", { registryDependencies: ["safe"], files: [{ path: "../../../escape.ts", content: "pwned" }] }),
    ];
    const { cli, project: app } = await harness({ config: CONFIG, items });
    const result = await cli("add", "evil", "--yes");
    expect(result.code).toBe(1);
    expect(result.err).toContain('Registry item "evil" has an unsafe file path "../../../escape.ts"');
    expect(await pathExists(join(app.dir, "src"))).toBe(false);
  });

  test("fails without writing when an item is invalid or misnamed", async () => {
    const files = registryFiles(sampleItems());
    files.set("button.json", JSON.stringify({ name: "button" }));
    files.set("slot.json", JSON.stringify(item("not-slot")));
    const app = await project();
    await app.write(CONFIG_FILE, JSON.stringify(CONFIG));
    for (const [name, message] of [
      ["button", `sinwan-ui: Invalid registry item "button" at ${REGISTRY_URL}/button.json.\n`],
      ["slot", `sinwan-ui: Invalid registry item "slot" at ${REGISTRY_URL}/slot.json.\n`],
    ] as const) {
      const io = captureIo();
      const code = await run(["add", name, "--registry", REGISTRY_URL], io, { fetch: mockFetch(files).fetch, cwd: app.dir });
      expect(code).toBe(1);
      expect(io.err()).toBe(message);
    }
    expect(await pathExists(join(app.dir, "src"))).toBe(false);
  });

  test("--dry-run prints the plan and the install commands", async () => {
    const { cli, project: app, installs } = await harness({ config: { ...CONFIG, packageManager: "npm" } });
    const result = await cli("add", "button", "--dry-run");
    expect(result.code).toBe(0);
    expect(result.out).toContain("Would create src/components/ui/button.tsx\n");
    expect(result.out).toContain("Would run: npm install clsx@^2.1.1 tailwind-merge@^3.7.0 class-variance-authority@^0.7.1\n");
    expect(await pathExists(join(app.dir, "src"))).toBe(false);
    expect(installs.calls).toEqual([]);
  });

  test("install failures exit with 1", async () => {
    const failing = await harness({ config: CONFIG, installExitCode: 2 });
    const result = await failing.cli("add", "utils");
    expect(result.code).toBe(1);
    expect(result.err).toContain('"bun add clsx@^2.1.1 tailwind-merge@^3.7.0" exited with code 2');

    const missingBinary = await harness({
      config: CONFIG,
      install: async () => {
        throw new Error("spawn bun ENOENT");
      },
    });
    const thrown = await missingBinary.cli("add", "utils");
    expect(thrown.code).toBe(1);
    expect(thrown.err).toContain('Cannot run "bun add clsx@^2.1.1 tailwind-merge@^3.7.0": spawn bun ENOENT');
  });

  test("reads a local registry directory relative to the working directory", async () => {
    const app = await project();
    await app.write(CONFIG_FILE, JSON.stringify(CONFIG));
    await writeLocalRegistry(join(app.dir, "registry", "r"), registryFiles(sampleItems()));
    const installs = recordInstalls();
    const io = captureIo();
    const code = await run(["add", "utils", "--registry", "registry/r"], io, { cwd: app.dir, install: installs.install });
    expect(code).toBe(0);
    expect(await app.read("src/lib/utils.ts")).toContain("cn");
    expect(installs.calls).toHaveLength(1);
  });

  test("network errors name the URL and suggest --registry", async () => {
    const app = await project();
    await app.write(CONFIG_FILE, JSON.stringify(CONFIG));
    const urls: string[] = [];
    const io = captureIo();
    const code = await run(["add", "button", "--ref", "main"], io, {
      cwd: app.dir,
      fetch: async (url) => {
        urls.push(url);
        return new Response("not found", { status: 404 });
      },
    });
    expect(code).toBe(1);
    expect(urls).toEqual([`${defaultRegistryUrl("main")}/index.json`]);
    expect(io.err()).toContain(`Failed to fetch ${defaultRegistryUrl("main")}/index.json: HTTP 404`);
    expect(io.err()).toContain("--registry <url-or-local-dir>");
  });
});

describe("sinwan-ui list and search", () => {
  test("list without a config lists items and suggests init", async () => {
    const { cli } = await harness();
    const result = await cli("list");
    expect(result.code).toBe(0);
    expect(result.out).toContain(`sinwan-ui 0.1.0 (${REGISTRY_URL})\n\n`);
    expect(result.out).toContain("    button   The button item\n");
    expect(result.out).toContain('Run "sinwan-ui init" to set up this project.');
  });

  test("list marks installed items", async () => {
    const { cli, project: app } = await harness({ config: CONFIG });
    await app.write("src/lib/utils.ts", "local edits still count");
    await app.write("src/components/ui/dialog/index.ts", "only one of two files");
    const result = await cli("list");
    expect(result.out).toContain("  ✓ utils    The utils item\n");
    expect(result.out).toContain("    dialog   The dialog item\n");
    expect(result.out).toContain("1 of 6 installed (✓).");
  });

  test("search ranks name matches before title and description matches", async () => {
    const items = [
      ...sampleItems(),
      item("alert-dialog", { title: "Alert" }),
      item("modal", { title: "Dialog-like modal" }),
      item("sheet", { files: [] }),
    ];
    const { cli } = await harness({ items });
    const result = await cli("search", "DIALOG");
    expect(result.code).toBe(0);
    expect(result.out).toBe(
      [
        '3 items match "DIALOG"',
        "",
        "    dialog        The dialog item",
        "    alert-dialog  The alert-dialog item",
        "    modal         The modal item",
        "",
      ].join("\n"),
    );
    expect((await cli("search", "the", "sheet")).out).toStartWith('1 item matches "the sheet"');
    expect((await cli("search", "butt")).out).toContain("    button  The button item\n");
    expect((await cli("search", "zzz")).out).toBe('No items match "zzz". Run "sinwan-ui list" to see all items.\n');
  });
});

describe("sinwan-ui view", () => {
  test("prints one item as an object and several as an array", async () => {
    const { cli } = await harness();
    const one = await cli("view", "slot");
    expect(one.code).toBe(0);
    expect(JSON.parse(one.out)).toEqual(sampleItems()[2]);
    expect(one.out).toBe(`${JSON.stringify(sampleItems()[2], null, 2)}\n`);
    const several = await cli("view", "slot", `${ACME_URL}/card.json`);
    expect(JSON.parse(several.out).map((entry: { name: string }) => entry.name)).toEqual(["slot", "card"]);
  });

  test("namespaces need a config; unknown names suggest matches", async () => {
    const { cli } = await harness({ config: CONFIG });
    expect(JSON.parse((await cli("view", "@acme/card")).out).name).toBe("card");
    expect((await cli("view", "dialg")).err).toContain("Did you mean: dialog?");
    const noConfig = await harness();
    expect((await noConfig.cli("view", "@acme/card")).err).toContain('Unknown registry "@acme"');
  });
});

describe("sinwan-ui diff", () => {
  test("exit code 0 when identical, 1 with a unified diff when not", async () => {
    const { cli, project: app } = await harness({ config: CONFIG });
    await app.write("src/lib/slot.ts", "export const Slot = 1;\n");
    const same = await cli("diff", "slot");
    expect(same).toEqual({ code: 0, out: "slot matches the registry.\n", err: "" });

    await app.write("src/lib/slot.ts", "export const Slot = 2;\n");
    const changed = await cli("diff", "slot");
    expect(changed.code).toBe(1);
    expect(changed.out).toBe(
      "--- src/lib/slot.ts (local)\n+++ src/lib/slot.ts (registry)\n@@ -1,2 +1,2 @@\n-export const Slot = 2;\n+export const Slot = 1;\n \n",
    );
  });

  test("compares after rewriting imports to the project's aliases", async () => {
    const { cli, project: app } = await harness({ config: { ...CONFIG, aliases: { ...DEFAULT_ALIASES, ui: "@/ui" } } });
    expect((await cli("add", "button", "--yes")).code).toBe(0);
    expect((await cli("diff", "button")).code).toBe(0);
    await app.write("src/ui/button.tsx", BUTTON_SOURCE);
    expect((await cli("diff", "button")).out).toContain('-import { Spinner } from "@/components/ui/spinner";\n+import { Spinner } from "@/ui/spinner";');
  });

  test("reports files missing locally and unknown items", async () => {
    const { cli, project: app } = await harness({ config: CONFIG });
    await app.write("src/components/ui/dialog/index.ts", "export * from './dialog';\n");
    const missing = await cli("diff", "dialog");
    expect(missing.code).toBe(1);
    expect(missing.out).toBe('src/components/ui/dialog/dialog.tsx: missing locally (run "sinwan-ui add dialog")\n');

    const unknown = await cli("diff", "dialg");
    expect(unknown.code).toBe(1);
    expect(unknown.err).toContain("Did you mean: dialog?");
  });

  test("without an item, lists installed items that differ", async () => {
    const { cli, project: app } = await harness({ config: CONFIG });
    expect(await cli("diff")).toEqual({
      code: 0,
      out: 'No registry items are installed. Add some with "sinwan-ui add <items...>".\n',
      err: "",
    });
    expect((await cli("add", "button", "--yes")).code).toBe(0);
    expect((await cli("diff")).out).toBe("4 installed items match the registry.\n");
    await app.write("src/lib/slot.ts", "changed\n");
    await app.write("src/components/ui/button.tsx", "changed\n");
    const changed = await cli("diff");
    expect(changed.code).toBe(1);
    expect(changed.out).toBe(
      [
        "Installed items that differ from the registry:",
        "  slot: src/lib/slot.ts",
        "  button: src/components/ui/button.tsx",
        'Run "sinwan-ui diff <item>" to see the changes.',
        "",
      ].join("\n"),
    );
  });

  test("CSS variables merged by add do not count as stylesheet changes", async () => {
    const items = [...sampleItems(), item("themed", { cssVars: { light: { accent: "red" } } })];
    const { cli, project: app } = await harness({ config: CONFIG, items, packageJson: { dependencies: ALL_DEPS } });
    expect((await cli("add", "style", "themed", "--yes")).code).toBe(0);
    expect(await app.read("src/styles/global.css")).toBe('@import "tailwindcss";\n\n:root {\n  --accent: red;\n}\n');
    expect(await cli("diff")).toEqual({ code: 0, out: "2 installed items match the registry.\n", err: "" });
    expect((await cli("diff", "style")).out).toBe("style matches the registry.\n");

    await app.write("src/styles/global.css", '@import "tailwindcss";\n\n:root {\n  --accent: blue;\n}\n');
    const changed = await cli("diff", "style");
    expect(changed.code).toBe(1);
    expect(changed.out).toContain("-  --accent: blue;\n+  --accent: red;\n");
    expect((await cli("diff")).out).toContain("  style: src/styles/global.css\n");

    await rm(join(app.dir, "src/styles/global.css"));
    expect((await cli("diff", "style")).out).toBe('src/styles/global.css: missing locally (run "sinwan-ui add style")\n');
  });

  test("requires a config", async () => {
    const { cli } = await harness();
    expect((await cli("diff", "slot")).err).toContain("No sinwan-ui.json found");
  });

  test("uses spinners for fetching in a terminal", async () => {
    const { cli, project: app, spinner } = await harness({ config: CONFIG, tty: true });
    await app.write("src/lib/slot.ts", "export const Slot = 1;\n");
    expect((await cli("diff", "slot")).code).toBe(0);
    expect(spinner.events).toEqual([
      { event: "start", message: "Fetching slot" },
      { event: "stop", message: "Fetched slot" },
    ]);
    expect((await cli("diff")).code).toBe(0);
    expect(spinner.events.slice(2)).toEqual([
      { event: "start", message: `Fetching registry index from ${REGISTRY_URL}` },
      { event: "stop", message: "Registry sinwan-ui 0.1.0: 6 items" },
      { event: "start", message: "Fetching 6 items" },
      { event: "stop", message: "Fetched 6 items" },
    ]);
  });
});
