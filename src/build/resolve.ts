import { posix } from "node:path";
import type { RegistryItemType } from "../registry/schema";
import { ALIAS_ROOT_NAMES, type AliasRootName, type AliasRoots, type ManifestFile } from "./manifest";

/** Import prefixes consumers map to their own directories (`sinwan-ui.json` aliases). */
export const CANONICAL_ALIASES: Readonly<Record<AliasRootName, string>> = {
  components: "@/components",
  ui: "@/components/ui",
  lib: "@/lib",
  hooks: "@/hooks",
};

/** Packages the consumer app provides itself; never recorded as item dependencies. */
const HOST_PACKAGES: ReadonlySet<string> = new Set(["sinwan", "tailwindcss"]);

const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx", ".css", ".d.ts"] as const;

const TYPE_ROOTS: Readonly<Partial<Record<RegistryItemType, AliasRootName>>> = {
  "registry:ui": "ui",
  "registry:lib": "lib",
  "registry:hook": "hooks",
  "registry:block": "components",
};

export type ImportClass =
  | { kind: "ignored" }
  | { kind: "internal" }
  | { kind: "registry"; item: string; alias: string }
  | { kind: "npm"; dependency: string }
  | { kind: "error"; message: string };

export interface ImportScope {
  /** Manifest-relative path of the importing file. */
  file: string;
  /** Item that owns `file`. */
  item: string;
  /** Manifest-relative file → owning item. */
  owners: ReadonlyMap<string, string>;
  /** npm package → version range. */
  ranges: ReadonlyMap<string, string>;
  aliasRoots: AliasRoots;
  exists: (path: string) => Promise<boolean>;
}

/** `@scope/name/sub` → `@scope/name`; `name/sub` → `name`. */
export function packageName(specifier: string): string {
  const [first = "", second] = specifier.split("/");
  return first.startsWith("@") && second !== undefined ? `${first}/${second}` : first;
}

function longestRoot(path: string, roots: AliasRoots): AliasRootName | undefined {
  let best: AliasRootName | undefined;
  for (const name of ALIAS_ROOT_NAMES) {
    const root = roots[name];
    if (path.startsWith(`${root}/`) && (best === undefined || root.length > roots[best].length)) best = name;
  }
  return best;
}

/** `src/components/ui/select/index.ts` → `@/components/ui/select`; `undefined` outside every alias root. */
export function canonicalAlias(path: string, roots: AliasRoots): string | undefined {
  const name = longestRoot(path, roots);
  if (name === undefined) return undefined;
  const rest = path
    .slice(roots[name].length + 1)
    .replace(/(?:\.d)?\.tsx?$/, "")
    .replace(/(?:^|\/)index$/, "");
  return rest === "" ? CANONICAL_ALIASES[name] : `${CANONICAL_ALIASES[name]}/${rest}`;
}

/**
 * The emitted `path`: relative to the alias root of the file's type, the basename for
 * `registry:style`, the `target` for `registry:file`; `undefined` when outside that root.
 */
export function emittedPath(file: ManifestFile, roots: AliasRoots): string | undefined {
  if (file.type === "registry:file") return file.target ?? file.path;
  if (file.type === "registry:style") return posix.basename(file.path);
  const root = roots[TYPE_ROOTS[file.type] ?? "components"];
  return file.path.startsWith(`${root}/`) ? file.path.slice(root.length + 1) : undefined;
}

export function rootForType(type: RegistryItemType): AliasRootName | undefined {
  return TYPE_ROOTS[type];
}

function isRelative(specifier: string): boolean {
  return specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../");
}

async function classifyRelative(specifier: string, scope: ImportScope, where: string): Promise<ImportClass> {
  const base = posix.normalize(posix.join(posix.dirname(scope.file), specifier)).replace(/\/+$/, "");
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    const owner = scope.owners.get(candidate);
    if (owner === scope.item) return { kind: "internal" };
    if (owner !== undefined) {
      const alias = canonicalAlias(candidate, scope.aliasRoots);
      return alias === undefined
        ? { kind: "error", message: `${where}: ${candidate} (item "${owner}") lies outside every alias root` }
        : { kind: "registry", item: owner, alias };
    }
    if (await scope.exists(candidate)) {
      return { kind: "error", message: `${where}: ${candidate} belongs to no registry item` };
    }
  }
  return { kind: "error", message: `${where}: no file matches ${base}` };
}

/** Decides what a module specifier found in `scope.file` contributes to its item. */
export async function classifyImport(specifier: string, scope: ImportScope): Promise<ImportClass> {
  const where = `${scope.file} imports "${specifier}"`;
  if (specifier.startsWith("@/")) {
    return { kind: "error", message: `${where}: registry source must import other items by relative path` };
  }
  if (isRelative(specifier)) return classifyRelative(specifier, scope, where);
  if (specifier.startsWith("/")) return { kind: "error", message: `${where}: absolute paths are not portable` };
  const name = packageName(specifier);
  if (HOST_PACKAGES.has(name)) return { kind: "ignored" };
  const range = scope.ranges.get(name);
  return range === undefined
    ? { kind: "error", message: `${where}: package "${name}" is not declared in package.json` }
    : { kind: "npm", dependency: `${name}@${range}` };
}
