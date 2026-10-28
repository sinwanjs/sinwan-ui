import type {
  RegistryFile,
  RegistryIndex,
  RegistryIndexEntry,
  RegistryItem,
} from "../registry/schema";
import { compareStrings, RegistryBuildError } from "./errors";
import type { ManifestFile, ManifestItem, PackageInfo, RegistryManifest } from "./manifest";
import { classifyImport, emittedPath, type ImportScope, rootForType } from "./resolve";
import { findCssImports, stripTailwindSources } from "./scan-css";
import { type ModuleLoader, scanModule, type SpecifierOccurrence } from "./scan-module";

export const REGISTRY_ITEM_SCHEMA_URL =
  "https://raw.githubusercontent.com/sinwanjs/sinwan-ui-registry/main/registry-item.schema.json";

/** Item names, which are also output file names (`<name>.json`). */
export const ITEM_NAME_PATTERN = /^[a-z0-9-]+$/;

const RESERVED_NAMES: ReadonlySet<string> = new Set(["index"]);

/** Read access to the files next to the manifest, by manifest-relative path. */
export interface RegistryFiles {
  /** File contents, or `undefined` when no readable file exists at `path`. */
  read(path: string): Promise<string | undefined>;
  exists(path: string): Promise<boolean>;
}

export interface RegistryBuildInput {
  manifest: RegistryManifest;
  packageInfo: PackageInfo;
  files: RegistryFiles;
  /** Manifest label used in error messages. */
  source: string;
}

export interface RegistryBuild {
  index: RegistryIndex;
  /** Sorted by name. */
  items: RegistryItem[];
}

interface ItemDraft {
  manifest: ManifestItem;
  files: RegistryFile[];
  dependencies: Set<string>;
  registryDependencies: Set<string>;
}

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function moduleLoader(path: string): ModuleLoader | undefined {
  if (/\.[cm]?ts$/.test(path)) return "ts";
  return /\.(?:tsx|jsx|[cm]?js)$/.test(path) ? "tsx" : undefined;
}

function scanSpecifiers(path: string, content: string, problems: string[]): SpecifierOccurrence[] {
  if (path.endsWith(".css")) return findCssImports(content);
  const loader = moduleLoader(path);
  if (loader === undefined) return [];
  try {
    const scan = scanModule(content, loader);
    for (const specifier of scan.unlocated) {
      problems.push(`${path}: Bun reports an import of "${specifier}" that the specifier scanner could not locate`);
    }
    return scan.occurrences;
  } catch (error) {
    problems.push(`${path} could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/** Replaces each occurrence's specifier text; every other byte is preserved. */
function rewriteSpecifiers(content: string, edits: readonly { at: SpecifierOccurrence; text: string }[]): string {
  let result = content;
  for (const { at, text } of [...edits].sort((a, b) => b.at.start - a.at.start)) {
    result = `${result.slice(0, at.start)}${text}${result.slice(at.end)}`;
  }
  return result;
}

function validateNames(items: readonly ManifestItem[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const { name } of items) {
    if (!ITEM_NAME_PATTERN.test(name)) problems.push(`item name "${name}" must match ${ITEM_NAME_PATTERN.source}`);
    else if (RESERVED_NAMES.has(name)) problems.push(`item name "${name}" is reserved for the registry index`);
    if (seen.has(name)) problems.push(`item name "${name}" is used by more than one item`);
    seen.add(name);
  }
  return problems;
}

/** Each file belongs to the first item listing it; later claims are problems. */
function mapOwners(items: readonly ManifestItem[], problems: string[]): Map<string, string> {
  const owners = new Map<string, string>();
  for (const item of items) {
    for (const file of item.files) {
      const owner = owners.get(file.path);
      if (owner === undefined) owners.set(file.path, item.name);
      else if (owner === item.name) problems.push(`${file.path} is listed twice by "${item.name}"`);
      else problems.push(`${file.path} is listed by both "${owner}" and "${item.name}"`);
    }
  }
  return owners;
}

async function buildFile(
  draft: ItemDraft,
  file: ManifestFile,
  content: string,
  input: RegistryBuildInput,
  owners: ReadonlyMap<string, string>,
  problems: string[],
): Promise<void> {
  const { aliasRoots } = input.manifest;
  const path = emittedPath(file, aliasRoots);
  if (path === undefined) {
    const root = rootForType(file.type) ?? "components";
    problems.push(`${file.path} (${file.type}) must lie under the "${root}" alias root ${aliasRoots[root]}`);
    return;
  }
  const scope: ImportScope = {
    file: file.path,
    item: draft.manifest.name,
    owners,
    ranges: input.packageInfo.ranges,
    aliasRoots,
    exists: (candidate) => input.files.exists(candidate),
  };
  const edits: { at: SpecifierOccurrence; text: string }[] = [];
  for (const occurrence of scanSpecifiers(file.path, content, problems)) {
    const result = await classifyImport(occurrence.specifier, scope);
    if (result.kind === "error") problems.push(result.message);
    else if (result.kind === "npm") draft.dependencies.add(result.dependency);
    else if (result.kind === "registry") {
      draft.registryDependencies.add(result.item);
      edits.push({ at: occurrence, text: result.alias });
    }
  }
  let emitted = rewriteSpecifiers(content, edits);
  if (file.type === "registry:style" && file.path.endsWith(".css")) emitted = stripTailwindSources(emitted);
  const entry: RegistryFile = { path, type: file.type, content: emitted };
  if (file.target !== undefined) entry.target = file.target;
  draft.files.push(entry);
}

function isLocalName(dependency: string): boolean {
  return !dependency.includes("/") && !dependency.includes(":");
}

/** Each cycle is reported as a closed path, e.g. `["a", "b", "a"]`. */
export function findDependencyCycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  const visited = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const visit = (name: string): void => {
    visited.add(name);
    stack.push(name);
    for (const dependency of graph.get(name) ?? []) {
      const onStack = stack.indexOf(dependency);
      if (onStack !== -1) cycles.push([...stack.slice(onStack), dependency]);
      else if (!visited.has(dependency) && graph.has(dependency)) visit(dependency);
    }
    stack.pop();
  };
  for (const name of [...graph.keys()].sort(compareStrings)) {
    if (!visited.has(name)) visit(name);
  }
  return cycles;
}

function validateGraph(items: readonly RegistryItem[]): string[] {
  const graph = new Map(items.map((item) => [item.name, item.registryDependencies.filter(isLocalName)]));
  const problems: string[] = [];
  for (const [name, dependencies] of graph) {
    for (const dependency of dependencies) {
      if (!graph.has(dependency)) problems.push(`item "${name}" depends on "${dependency}", which is not an item`);
    }
  }
  for (const cycle of findDependencyCycles(graph)) problems.push(`dependency cycle: ${cycle.join(" -> ")}`);
  return problems;
}

function toRegistryItem(draft: ItemDraft): RegistryItem {
  const { manifest } = draft;
  return {
    $schema: REGISTRY_ITEM_SCHEMA_URL,
    name: manifest.name,
    type: manifest.type,
    ...(manifest.title === undefined ? {} : { title: manifest.title }),
    description: manifest.description,
    dependencies: sorted([...draft.dependencies, ...manifest.dependencies]),
    devDependencies: sorted(manifest.devDependencies),
    registryDependencies: sorted([...draft.registryDependencies, ...manifest.registryDependencies]),
    files: draft.files,
    ...(manifest.cssVars === undefined ? {} : { cssVars: manifest.cssVars }),
    ...(manifest.docs === undefined ? {} : { docs: manifest.docs }),
  };
}

function toIndexEntry(item: RegistryItem): RegistryIndexEntry {
  return {
    name: item.name,
    type: item.type,
    ...(item.title === undefined ? {} : { title: item.title }),
    description: item.description,
    registryDependencies: item.registryDependencies,
  };
}

/**
 * Builds every item of a manifest: reads its files, records npm and registry dependencies
 * from their imports, rewrites cross-item imports to canonical aliases and validates the
 * result. Throws one `RegistryBuildError` listing every problem.
 */
export async function buildRegistry(input: RegistryBuildInput): Promise<RegistryBuild> {
  const { manifest } = input;
  const problems = validateNames(manifest.items);
  const owners = mapOwners(manifest.items, problems);
  const drafts: ItemDraft[] = [];
  for (const item of manifest.items) {
    const draft: ItemDraft = { manifest: item, files: [], dependencies: new Set(), registryDependencies: new Set() };
    const built = new Set<string>();
    for (const file of item.files) {
      if (owners.get(file.path) !== item.name || built.has(file.path)) continue;
      built.add(file.path);
      const content = await input.files.read(file.path);
      if (content === undefined) problems.push(`item "${item.name}" lists ${file.path}, which does not exist`);
      else await buildFile(draft, file, content, input, owners, problems);
    }
    drafts.push(draft);
  }
  const items = drafts.map(toRegistryItem).sort((a, b) => compareStrings(a.name, b.name));
  problems.push(...validateGraph(items));
  if (problems.length > 0) throw new RegistryBuildError(input.source, problems);
  const index: RegistryIndex = {
    name: manifest.name,
    ...(manifest.homepage === undefined ? {} : { homepage: manifest.homepage }),
    version: input.packageInfo.version,
    items: items.map(toIndexEntry),
  };
  return { index, items };
}
