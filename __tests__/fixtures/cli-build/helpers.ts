import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { RegistryFiles } from "../../../src/build/build";
import type { Colors } from "../../../src/ui";

export const PACKAGE_JSON = {
  name: "fixture-registry",
  version: "1.2.3",
  dependencies: { "sinwan-ui-core": "^1.0.0", "class-variance-authority": "^0.7.1" },
  peerDependencies: { sinwan: "^1.0.0", "@tanstack/table-core": "^9.2.4", echarts: "^6.1.0" },
  devDependencies: { echarts: "^5.0.0", "tw-animate-css": "^1.4.0", tailwindcss: "^4.3.3" },
};

export const ALIAS_ROOTS = {
  components: "src/components",
  ui: "src/components/ui",
  lib: "src/lib",
  hooks: "src/hooks",
};

export interface FixtureItem {
  name: string;
  type?: string;
  title?: string;
  description?: string;
  files: (string | { path: string; type?: string; target?: string })[];
  [key: string]: unknown;
}

function fileType(path: string): string {
  if (path.startsWith("src/lib/")) return "registry:lib";
  if (path.startsWith("src/hooks/")) return "registry:hook";
  if (path.startsWith("src/styles/")) return "registry:style";
  return "registry:ui";
}

/** A `registry.json` object; string files get their type from their directory. */
export function manifest(items: readonly FixtureItem[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    $schema: "https://raw.githubusercontent.com/sinwanjs/sinwan-ui-registry/main/registry.schema.json",
    name: "fixture",
    homepage: "https://sinwanjs.com",
    aliasRoots: ALIAS_ROOTS,
    items: items.map(({ files, ...item }) => ({
      type: fileType(typeof files[0] === "string" ? files[0] : (files[0]?.path ?? "")),
      description: `${item.name} description`,
      ...item,
      files: files.map((file) =>
        typeof file === "string" ? { path: file, type: fileType(file) } : { type: fileType(file.path), ...file },
      ),
    })),
    ...extra,
  };
}

/** In-memory `RegistryFiles` for library tests. */
export function memoryFiles(files: Readonly<Record<string, string>>): RegistryFiles {
  return {
    read: async (path) => files[path],
    exists: async (path) => path in files,
  };
}

export interface TempDir {
  dir: string;
  write(path: string, content: string): Promise<void>;
  read(path: string): Promise<string>;
  list(path: string): Promise<string[]>;
  cleanup(): Promise<void>;
}

export async function tempDir(files: Readonly<Record<string, string>> = {}): Promise<TempDir> {
  const dir = await mkdtemp(join(tmpdir(), "sinwan-ui-build-"));
  const temp: TempDir = {
    dir,
    async write(path, content) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), content);
    },
    read: (path) => readFile(join(dir, path), "utf8"),
    list: async (path) => (await readdir(join(dir, path))).sort(),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
  for (const [path, content] of Object.entries(files)) await temp.write(path, content);
  return temp;
}

/** A registry directory with `registry.json`, `package.json` and the given sources. */
export async function tempRegistry(
  items: readonly FixtureItem[],
  sources: Readonly<Record<string, string>>,
  extra: Record<string, unknown> = {},
): Promise<TempDir> {
  return tempDir({
    "registry.json": JSON.stringify(manifest(items, extra), null, 2),
    "package.json": JSON.stringify(PACKAGE_JSON, null, 2),
    ...sources,
  });
}

export const PLAIN_COLORS: Colors = {
  success: (text) => text,
  warn: (text) => text,
  error: (text) => text,
  heading: (text) => text,
  accent: (text) => text,
  dim: (text) => text,
};

export const TAGGED_COLORS: Colors = {
  success: (text) => `<success>${text}</success>`,
  warn: (text) => `<warn>${text}</warn>`,
  error: (text) => `<error>${text}</error>`,
  heading: (text) => `<heading>${text}</heading>`,
  accent: (text) => `<accent>${text}</accent>`,
  dim: (text) => `<dim>${text}</dim>`,
};

/** Sources of a small registry exercising every import kind. */
export const SAMPLE_SOURCES: Readonly<Record<string, string>> = {
  "src/lib/utils.ts": `export function cn(...values: string[]): string {\n  return values.join(" ");\n}\n`,
  "src/components/ui/spinner.tsx": `import { cn } from "../../lib/utils";\n\nexport const Spinner = () => <span class={cn("spin")} />;\n`,
  "src/components/ui/button.tsx": [
    `import { cva, type VariantProps } from "class-variance-authority";`,
    `import { cc } from "sinwan/component";`,
    `import { Slot } from "sinwan-ui-core/slot";`,
    `import { cn } from "../../lib/utils";`,
    ``,
    `import { Spinner } from './spinner';`,
    ``,
    `export const Button = cc(() => <Slot class={cn("btn")}><Spinner /></Slot>);`,
    ``,
  ].join("\n"),
  "src/components/ui/select/index.ts": `export * from "./select";\nexport type { SelectProps } from "./use-select";\n`,
  "src/components/ui/select/select.tsx": `import { Button } from "../button";\nimport { useSelect } from "./use-select";\n\nexport const Select = () => <Button>{useSelect()}</Button>;\n`,
  "src/components/ui/select/use-select.ts": `import type { ColumnDef } from "@tanstack/table-core";\n\nexport interface SelectProps { columns: ColumnDef[] }\nexport const useSelect = () => import("echarts/core");\n`,
  "src/hooks/use-mobile.ts": `export const useMobile = () => matchMedia("(max-width: 768px)").matches;\n`,
  "src/lib/echarts-gl.d.ts": `declare module "echarts-gl" {\n  const echartsGl: Record<string, unknown>;\n  export = echartsGl;\n}\n`,
  "src/styles/global.css": [
    `@import "tailwindcss";`,
    `@import "tw-animate-css";`,
    ``,
    `/* ------------------`,
    ` * Tailwind content sources`,
    ` * ---------------- */`,
    `@source "../";`,
    ``,
    `:root { --radius: 0.5rem; }`,
    ``,
  ].join("\n"),
  "templates/env.d.ts": `/// <reference types="vite/client" />\n`,
};

export const SAMPLE_ITEMS: readonly FixtureItem[] = [
  { name: "utils", title: "Utils", files: ["src/lib/utils.ts"] },
  { name: "spinner", title: "Spinner", files: ["src/components/ui/spinner.tsx"] },
  { name: "button", title: "Button", files: ["src/components/ui/button.tsx"] },
  {
    name: "select",
    files: [
      "src/components/ui/select/index.ts",
      "src/components/ui/select/select.tsx",
      "src/components/ui/select/use-select.ts",
      "src/lib/echarts-gl.d.ts",
    ],
    docs: "https://sinwanjs.com/docs/select",
  },
  { name: "use-mobile", type: "registry:hook", files: ["src/hooks/use-mobile.ts"] },
  {
    name: "style",
    type: "registry:style",
    files: ["src/styles/global.css"],
    cssVars: { light: { radius: "0.5rem" } },
  },
  {
    name: "env",
    type: "registry:file",
    files: [{ path: "templates/env.d.ts", type: "registry:file", target: "src/env.d.ts" }],
    devDependencies: ["vite@^7.0.0"],
  },
];
