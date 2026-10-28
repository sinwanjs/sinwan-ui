import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_ALIASES, type SinwanUiConfig } from "../../../src/config";
import { CancelledError } from "../../../src/errors";
import type { CliDeps, CliIo, CliPrompts, Colors, PromptOption, SpinnerFactory } from "../../../src/index";
import type { FetchLike } from "../../../src/registry-source";
import type {
  RegistryCssVars,
  RegistryFile,
  RegistryIndex,
  RegistryItem,
  RegistryItemType,
} from "../../../src/registry/schema";

export const REGISTRY_URL = "https://registry.test/r";
export const ACME_URL = "https://acme.test/r";

export interface CapturedIo extends CliIo {
  out: () => string;
  err: () => string;
}

const ANSI = /\u001b\[[0-9;]*m/g;

/** Captures output as plain text (ANSI colour codes stripped). */
export function captureIo(): CapturedIo {
  let out = "";
  let err = "";
  return {
    stdout: (text) => {
      out += text.replace(ANSI, "");
    },
    stderr: (text) => {
      err += text.replace(ANSI, "");
    },
    out: () => out,
    err: () => err,
  };
}

const plain = (text: string): string => text;
export const PLAIN_COLORS: Colors = {
  success: plain,
  warn: plain,
  error: plain,
  heading: plain,
  accent: plain,
  dim: plain,
};

/** Wraps each colour role in a visible tag, e.g. `<success>Created</success>`. */
export const TAGGED_COLORS: Colors = {
  success: (text) => `<success>${text}</success>`,
  warn: (text) => `<warn>${text}</warn>`,
  error: (text) => `<error>${text}</error>`,
  heading: (text) => `<heading>${text}</heading>`,
  accent: (text) => `<accent>${text}</accent>`,
  dim: (text) => `<dim>${text}</dim>`,
};

export const CANCEL = Symbol("cancel");
export type ScriptedAnswer = boolean | string | string[] | typeof CANCEL;

export interface PromptCall {
  kind: "confirm" | "text" | "select" | "multiselect";
  message: string;
  options?: ReadonlyArray<PromptOption<string>>;
}

/** `CliPrompts` that replays `answers` in order and records every question. */
export function scriptedPrompts(answers: readonly ScriptedAnswer[]): { prompts: CliPrompts; calls: PromptCall[] } {
  const calls: PromptCall[] = [];
  const queue = [...answers];
  const next = (): ScriptedAnswer => {
    const answer = queue.shift();
    if (answer === undefined) throw new Error("no scripted answer left");
    if (answer === CANCEL) throw new CancelledError();
    return answer;
  };
  return {
    calls,
    prompts: {
      async confirm(message) {
        calls.push({ kind: "confirm", message });
        const answer = next();
        if (typeof answer !== "boolean") throw new Error(`confirm expected a boolean, got ${String(answer)}`);
        return answer;
      },
      async text(message, defaultValue) {
        calls.push({ kind: "text", message });
        const answer = next();
        if (typeof answer !== "string") throw new Error("text expected a string");
        return answer === "" ? defaultValue : answer;
      },
      async select(message, options, initialValue) {
        calls.push({ kind: "select", message, options });
        const answer = next();
        return options.find((option) => option.value === answer)?.value ?? initialValue;
      },
      async multiselect(message, options) {
        calls.push({ kind: "multiselect", message, options });
        const answer = next();
        const picked = Array.isArray(answer) ? answer : [];
        return options.filter((option) => picked.includes(option.value)).map((option) => option.value);
      },
    },
  };
}

export interface SpinnerEvent {
  event: "start" | "stop" | "fail";
  message: string;
}

export function recordSpinner(): { spinner: SpinnerFactory; events: SpinnerEvent[] } {
  const events: SpinnerEvent[] = [];
  return {
    events,
    spinner: () => ({
      start: (message) => events.push({ event: "start", message }),
      stop: (message) => events.push({ event: "stop", message }),
      fail: (message) => events.push({ event: "fail", message }),
    }),
  };
}

export function item(
  name: string,
  options: {
    type?: RegistryItemType;
    title?: string;
    dependencies?: string[];
    devDependencies?: string[];
    registryDependencies?: string[];
    files?: Array<Omit<RegistryFile, "type"> & { type?: RegistryItemType }>;
    cssVars?: RegistryCssVars;
  } = {},
): RegistryItem {
  const type = options.type ?? "registry:ui";
  const files = options.files ?? [{ path: `${name}.tsx`, content: `export const ${name} = 1;\n` }];
  return {
    name,
    type,
    ...(options.title === undefined ? {} : { title: options.title }),
    description: `The ${name} item`,
    dependencies: options.dependencies ?? [],
    devDependencies: options.devDependencies ?? [],
    registryDependencies: options.registryDependencies ?? [],
    files: files.map((file) => ({ ...file, type: file.type ?? type })),
    ...(options.cssVars === undefined ? {} : { cssVars: options.cssVars }),
  };
}

export function indexOf(items: readonly RegistryItem[], version = "0.1.0"): RegistryIndex {
  return {
    name: "sinwan-ui",
    version,
    items: items.map(({ name, type, title, description, registryDependencies }) => ({
      name,
      type,
      ...(title === undefined ? {} : { title }),
      description,
      registryDependencies,
    })),
  };
}

export const BUTTON_SOURCE = [
  'import { cn } from "@/lib/utils";',
  'import { Spinner } from "@/components/ui/spinner";',
  'import { Slot } from "@/lib/slot";',
  "export const button = cn(Spinner, Slot);",
  "",
].join("\n");

/** A small registry shaped like the real one: utils, style, slot, spinner, button, dialog. */
export function sampleItems(): RegistryItem[] {
  return [
    item("utils", {
      type: "registry:lib",
      dependencies: ["clsx@^2.1.1", "tailwind-merge@^3.7.0"],
      files: [{ path: "utils.ts", content: "export const cn = () => '';\n" }],
    }),
    item("style", {
      type: "registry:style",
      dependencies: ["tw-animate-css@^1.4.0"],
      files: [{ path: "global.css", content: '@import "tailwindcss";\n' }],
    }),
    item("slot", {
      type: "registry:lib",
      files: [{ path: "slot.ts", content: "export const Slot = 1;\n" }],
    }),
    item("spinner", { registryDependencies: ["utils"] }),
    item("button", {
      title: "Button",
      dependencies: ["class-variance-authority@^0.7.1", "clsx@^2.1.1"],
      registryDependencies: ["spinner", "slot", "utils"],
      files: [{ path: "button.tsx", content: BUTTON_SOURCE }],
    }),
    item("dialog", {
      title: "Dialog",
      dependencies: ["@floating-ui/dom@^1.8.0"],
      registryDependencies: ["button", "utils"],
      files: [
        { path: "dialog/index.ts", content: "export * from './dialog';\n" },
        { path: "dialog/dialog.tsx", content: 'import { button } from "@/components/ui/button";\nexport const Dialog = button;\n' },
      ],
    }),
  ];
}

export function registryFiles(items: readonly RegistryItem[]): Map<string, string> {
  const files = new Map<string, string>([["index.json", JSON.stringify(indexOf(items))]]);
  for (const entry of items) files.set(`${entry.name}.json`, JSON.stringify(entry));
  return files;
}

export async function writeLocalRegistry(dir: string, files: ReadonlyMap<string, string>): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const [name, content] of files) await writeFile(join(dir, name), content);
}

export interface MockFetch {
  fetch: FetchLike;
  urls: string[];
}

/** Serves `files` under `baseUrl` and, optionally, more registries under other base URLs. */
export function mockFetch(
  files: ReadonlyMap<string, string>,
  baseUrl = REGISTRY_URL,
  others: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map(),
): MockFetch {
  const urls: string[] = [];
  const registries = new Map([[baseUrl, files], ...others]);
  return {
    urls,
    fetch: async (url) => {
      urls.push(url);
      for (const [base, served] of registries) {
        const body = url.startsWith(`${base}/`) ? served.get(url.slice(base.length + 1)) : undefined;
        if (body !== undefined) return new Response(body);
      }
      return new Response("missing", { status: 404 });
    },
  };
}

export interface Project {
  dir: string;
  cleanup: () => Promise<void>;
  write: (path: string, content: string) => Promise<void>;
  read: (path: string) => Promise<string>;
}

export const AT_TSCONFIG = `${JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }, null, 2)}\n`;

export async function tempProject(
  packageJson: unknown = { dependencies: { sinwan: "1.0.0" }, devDependencies: { tailwindcss: "4.0.0" } },
  tsconfig: string | null = AT_TSCONFIG,
): Promise<Project> {
  const dir = await mkdtemp(join(tmpdir(), "sinwan-ui-cli-"));
  const project: Project = {
    dir,
    cleanup: () => rm(dir, { recursive: true, force: true }),
    write: async (path, content) => {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), content);
    },
    read: (path) => readFile(join(dir, path), "utf8"),
  };
  if (packageJson !== null) await project.write("package.json", JSON.stringify(packageJson));
  if (tsconfig !== null) await project.write("tsconfig.json", tsconfig);
  return project;
}

export interface Installs {
  install: CliDeps["install"];
  calls: Array<{ command: readonly string[]; cwd: string }>;
  /** The `quiet` flag of each call. */
  quiet: boolean[];
}

export function recordInstalls(exitCode = 0, output = ""): Installs {
  const calls: Installs["calls"] = [];
  const quiet: boolean[] = [];
  return {
    calls,
    quiet,
    install: async (command, cwd, isQuiet) => {
      calls.push({ command, cwd });
      quiet.push(isQuiet);
      return { exitCode, output };
    },
  };
}

export const CONFIG: SinwanUiConfig = {
  $schema: "https://raw.githubusercontent.com/sinwanjs/sinwan-ui-registry/main/schema.json",
  tsx: true,
  tailwind: { css: "src/styles/global.css" },
  aliases: DEFAULT_ALIASES,
  registries: { "@acme": `${ACME_URL}/{name}.json` },
  packageManager: "bun",
};

export const LEGACY_CONFIG = { baseDir: "src", css: "src/app.css", packageManager: "pnpm" } as const;
