import { posix } from "node:path";
import {
  isRegistryCssVars,
  isRegistryItemType,
  REGISTRY_ITEM_TYPES,
  type RegistryCssVars,
  type RegistryItemType,
} from "../registry/schema";
import { RegistryBuildError } from "./errors";

export const ALIAS_ROOT_NAMES = ["components", "ui", "lib", "hooks"] as const;

export type AliasRootName = (typeof ALIAS_ROOT_NAMES)[number];

/** Manifest-relative directory behind each canonical alias (`ui` → `src/components/ui`). */
export type AliasRoots = Record<AliasRootName, string>;

export interface ManifestFile {
  /** Normalized path relative to the manifest directory. */
  path: string;
  type: RegistryItemType;
  target?: string;
}

export interface ManifestItem {
  name: string;
  type: RegistryItemType;
  title?: string;
  description: string;
  files: ManifestFile[];
  /** Declared in addition to the ones detected from imports. */
  dependencies: string[];
  devDependencies: string[];
  registryDependencies: string[];
  cssVars?: RegistryCssVars;
  docs?: string;
}

/** A `registry.json` manifest: the authored input of `sinwan-ui build`. */
export interface RegistryManifest {
  name: string;
  homepage?: string;
  aliasRoots: AliasRoots;
  items: ManifestItem[];
}

/** The `package.json` next to the manifest. */
export interface PackageInfo {
  version: string;
  /** npm package → range; first match in `dependencies`, `peerDependencies`, `devDependencies`. */
  ranges: ReadonlyMap<string, string>;
}

const DEPENDENCY_FIELDS = ["dependencies", "peerDependencies", "devDependencies"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/** A normalized path inside the manifest directory, or `undefined` after recording a problem. */
function readRelativePath(value: unknown, where: string, problems: string[]): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    problems.push(`${where} must be a non-empty string`);
    return undefined;
  }
  const normalized = posix.normalize(value).replace(/\/+$/, "");
  if (value.includes("\\") || posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    problems.push(`${where} "${value}" must be a relative path inside the registry directory`);
    return undefined;
  }
  return normalized;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  where: string,
  problems: string[],
): string | undefined {
  const value = record[key];
  if (value === undefined || typeof value === "string") return value;
  problems.push(`${where}.${key} must be a string`);
  return undefined;
}

function readStringList(
  record: Record<string, unknown>,
  key: string,
  where: string,
  problems: string[],
): string[] {
  const value = record[key];
  if (value === undefined) return [];
  if (isStringArray(value)) return [...value];
  problems.push(`${where}.${key} must be an array of strings`);
  return [];
}

function readItemType(value: unknown, where: string, problems: string[]): RegistryItemType | undefined {
  if (isRegistryItemType(value)) return value;
  problems.push(`${where}.type must be one of ${REGISTRY_ITEM_TYPES.join(", ")}`);
  return undefined;
}

function readAliasRoots(value: unknown, problems: string[]): AliasRoots | undefined {
  if (!isRecord(value)) {
    problems.push(`aliasRoots must be an object with ${ALIAS_ROOT_NAMES.join(", ")}`);
    return undefined;
  }
  const roots: Partial<AliasRoots> = {};
  for (const name of ALIAS_ROOT_NAMES) {
    roots[name] = readRelativePath(value[name], `aliasRoots.${name}`, problems);
  }
  const { components, ui, lib, hooks } = roots;
  return components && ui && lib && hooks ? { components, ui, lib, hooks } : undefined;
}

function readFile(value: unknown, where: string, problems: string[]): ManifestFile | undefined {
  if (!isRecord(value)) {
    problems.push(`${where} must be an object`);
    return undefined;
  }
  const path = readRelativePath(value.path, `${where}.path`, problems);
  const type = readItemType(value.type, where, problems);
  const target = readOptionalString(value, "target", where, problems);
  if (type === "registry:file" && target === undefined) {
    problems.push(`${where} has type registry:file and needs a "target"`);
    return undefined;
  }
  if (path === undefined || type === undefined) return undefined;
  return target === undefined ? { path, type } : { path, type, target };
}

function readFiles(value: unknown, where: string, problems: string[]): ManifestFile[] {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push(`${where}.files must be a non-empty array`);
    return [];
  }
  const files: ManifestFile[] = [];
  value.forEach((entry, index) => {
    const file = readFile(entry, `${where}.files[${index}]`, problems);
    if (file) files.push(file);
  });
  return files;
}

function readItem(value: unknown, index: number, problems: string[]): ManifestItem | undefined {
  if (!isRecord(value)) {
    problems.push(`items[${index}] must be an object`);
    return undefined;
  }
  const { name, description, cssVars } = value;
  const where = typeof name === "string" ? `items[${index}] "${name}"` : `items[${index}]`;
  const before = problems.length;
  if (typeof name !== "string" || name.length === 0) problems.push(`${where}.name must be a non-empty string`);
  if (typeof description !== "string") problems.push(`${where}.description must be a string`);
  if (cssVars !== undefined && !isRegistryCssVars(cssVars)) {
    problems.push(`${where}.cssVars must map scopes to objects of string values`);
  }
  const type = readItemType(value.type, where, problems);
  const title = readOptionalString(value, "title", where, problems);
  const docs = readOptionalString(value, "docs", where, problems);
  const files = readFiles(value.files, where, problems);
  const dependencies = readStringList(value, "dependencies", where, problems);
  const devDependencies = readStringList(value, "devDependencies", where, problems);
  const registryDependencies = readStringList(value, "registryDependencies", where, problems);
  if (
    problems.length !== before ||
    typeof name !== "string" ||
    typeof description !== "string" ||
    type === undefined
  ) {
    return undefined;
  }
  const item: ManifestItem = {
    name,
    type,
    description,
    files,
    dependencies,
    devDependencies,
    registryDependencies,
  };
  if (title !== undefined) item.title = title;
  if (isRegistryCssVars(cssVars)) item.cssVars = cssVars;
  if (docs !== undefined) item.docs = docs;
  return item;
}

/** Validates an untrusted `registry.json`; throws one error listing every structural problem. */
export function parseRegistryManifest(value: unknown, source: string): RegistryManifest {
  const problems: string[] = [];
  if (!isRecord(value)) throw new RegistryBuildError(source, ["the manifest must be a JSON object"]);
  const { name } = value;
  if (typeof name !== "string" || name.length === 0) problems.push("name must be a non-empty string");
  const homepage = readOptionalString(value, "homepage", "manifest", problems);
  const aliasRoots = readAliasRoots(value.aliasRoots, problems);
  const items: ManifestItem[] = [];
  if (Array.isArray(value.items)) {
    value.items.forEach((entry, index) => {
      const item = readItem(entry, index, problems);
      if (item) items.push(item);
    });
  } else {
    problems.push("items must be an array");
  }
  if (problems.length > 0 || aliasRoots === undefined || typeof name !== "string") {
    throw new RegistryBuildError(source, problems);
  }
  const manifest: RegistryManifest = { name, aliasRoots, items };
  if (homepage !== undefined) manifest.homepage = homepage;
  return manifest;
}

/** Reads the registry version and the npm ranges imports are resolved against. */
export function parsePackageInfo(value: unknown, source: string): PackageInfo {
  const problems: string[] = [];
  if (!isRecord(value)) throw new RegistryBuildError(source, ["package.json must be a JSON object"]);
  const { version } = value;
  if (typeof version !== "string" || version.length === 0) {
    problems.push('"version" must be a non-empty string; it becomes the registry version');
  }
  const ranges = new Map<string, string>();
  for (const field of DEPENDENCY_FIELDS) {
    const map = value[field];
    if (map === undefined) continue;
    if (!isRecord(map)) {
      problems.push(`"${field}" must be an object`);
      continue;
    }
    for (const [name, range] of Object.entries(map)) {
      if (typeof range !== "string") problems.push(`"${field}.${name}" must be a version range string`);
      else if (!ranges.has(name)) ranges.set(name, range);
    }
  }
  if (problems.length > 0 || typeof version !== "string") throw new RegistryBuildError(source, problems);
  return { version, ranges };
}
