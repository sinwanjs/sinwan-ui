import { readFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { CliError, errorMessage } from "./errors";
import { isRecord, pathExists } from "./fs-utils";

export const PROJECT_CONFIG_FILES = ["tsconfig.json", "jsconfig.json"] as const;

const MAX_EXTENDS_DEPTH = 5;
const PROBE = "__sinwan_ui_probe__";

export type PathsMap = Record<string, string[]>;

/** Where the project's import aliases come from. */
export interface AliasSource {
  /** Root `tsconfig.json`/`jsconfig.json`. */
  rootFile: string;
  /** Config whose `compilerOptions.paths` apply: the root, or a referenced config (Vite's `tsconfig.app.json`). */
  file: string;
  /** Directory `paths` targets are relative to (`baseUrl`, else the directory of the config declaring `paths`). */
  baseDir: string;
  paths: PathsMap;
  /** `file` declares `paths` itself (adding an entry there does not hide paths inherited through `extends`). */
  ownPaths: boolean;
}

interface LoadedConfig {
  file: string;
  json: Record<string, unknown>;
  baseUrl: string | undefined;
  paths: PathsMap | undefined;
  /** Directory of the config that declares the effective `paths`. */
  pathsDir: string | undefined;
  ownPaths: boolean;
}

/** Parses JSON with comments and trailing commas (tsconfig/jsconfig syntax). */
export function parseJsonc(text: string, location: string): unknown {
  try {
    return Bun.JSONC.parse(text);
  } catch (error) {
    throw new CliError(`Cannot parse ${location}: ${errorMessage(error)}`);
  }
}

export async function readJsoncFile(file: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    throw new CliError(`Cannot read ${file}: ${errorMessage(error)}`);
  }
  return parseJsonc(text, file);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function pathsMap(value: unknown): PathsMap | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).flatMap(([pattern, targets]) =>
    Array.isArray(targets) ? [[pattern, targets.filter(isString)] as const] : [],
  );
  return Object.fromEntries(entries);
}

function relativeConfigFile(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".") && !isAbsolute(specifier)) return null;
  const file = resolve(dirname(fromFile), specifier);
  return extname(file) === ".json" ? file : `${file}.json`;
}

function extendsList(json: Record<string, unknown>): string[] {
  const value = json.extends;
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter(isString) : [];
}

async function loadConfig(file: string, depth: number): Promise<LoadedConfig> {
  const json = await readJsoncFile(file);
  if (!isRecord(json)) throw new CliError(`${file} must contain a JSON object.`);
  let baseUrl: string | undefined;
  let paths: PathsMap | undefined;
  let pathsDir: string | undefined;
  if (depth < MAX_EXTENDS_DEPTH) {
    for (const specifier of extendsList(json)) {
      const parentFile = relativeConfigFile(file, specifier);
      if (parentFile === null) continue;
      const parent = await loadConfig(parentFile, depth + 1);
      baseUrl = parent.baseUrl ?? baseUrl;
      if (parent.paths) {
        paths = parent.paths;
        pathsDir = parent.pathsDir;
      }
    }
  }
  const options = isRecord(json.compilerOptions) ? json.compilerOptions : {};
  if (typeof options.baseUrl === "string") baseUrl = resolve(dirname(file), options.baseUrl);
  const own = pathsMap(options.paths);
  if (own) {
    paths = own;
    pathsDir = dirname(file);
  }
  return { file, json, baseUrl, paths, pathsDir, ownPaths: own !== undefined };
}

function referencedFiles(config: LoadedConfig): string[] {
  const references = config.json.references;
  if (!Array.isArray(references)) return [];
  return references.flatMap((reference) => {
    if (!isRecord(reference) || typeof reference.path !== "string") return [];
    const target = resolve(dirname(config.file), reference.path);
    return [extname(target) === ".json" ? target : join(target, "tsconfig.json")];
  });
}

function aliasSource(rootFile: string, config: LoadedConfig): AliasSource {
  return {
    rootFile,
    file: config.file,
    baseDir: config.baseUrl ?? config.pathsDir ?? dirname(config.file),
    paths: config.paths ?? {},
    ownPaths: config.ownPaths,
  };
}

export async function findProjectConfig(projectDir: string): Promise<string | null> {
  for (const name of PROJECT_CONFIG_FILES) {
    const file = join(projectDir, name);
    if (await pathExists(file)) return file;
  }
  return null;
}

/**
 * Loads the alias mapping of `projectDir`: `tsconfig.json` (else `jsconfig.json`), following relative
 * `extends`. A root without `paths` defers to its first `references` entry that has them (or, when
 * none does, its first reference). `null` when the project has neither file.
 */
export async function loadAliasSource(projectDir: string): Promise<AliasSource | null> {
  const rootFile = await findProjectConfig(projectDir);
  if (rootFile === null) return null;
  const root = await loadConfig(rootFile, 0);
  if (root.paths) return aliasSource(rootFile, root);
  const references: LoadedConfig[] = [];
  for (const file of referencedFiles(root)) {
    if (await pathExists(file)) references.push(await loadConfig(file, 0));
  }
  const chosen = references.find((reference) => reference.paths) ?? references[0] ?? root;
  return aliasSource(rootFile, chosen);
}

/** Resolves an import specifier through `paths` the way TypeScript does (exact match, else longest prefix), using the first target. */
export function resolveSpecifier(source: AliasSource, specifier: string): string | null {
  let best: { prefix: string; suffix: string; target: string } | null = null;
  for (const [pattern, targets] of Object.entries(source.paths)) {
    const [target] = targets;
    if (target === undefined) continue;
    const star = pattern.indexOf("*");
    if (star < 0) {
      if (pattern === specifier) return resolve(source.baseDir, target);
      continue;
    }
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    const matches =
      specifier.length >= prefix.length + suffix.length &&
      specifier.startsWith(prefix) &&
      specifier.endsWith(suffix);
    if (matches && (best === null || prefix.length > best.prefix.length)) best = { prefix, suffix, target };
  }
  if (best === null) return null;
  const captured = specifier.slice(best.prefix.length, specifier.length - best.suffix.length);
  return resolve(source.baseDir, best.target.replace("*", captured));
}

/** Directory an alias such as `@/components/ui` points at, or `null` when `paths` do not map it. */
export function aliasDirectory(source: AliasSource, alias: string): string | null {
  const probe = resolveSpecifier(source, `${alias}/${PROBE}`);
  return probe !== null && basename(probe) === PROBE ? dirname(probe) : null;
}
