import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isRegistryItem } from "../registry/schema";
import { ITEM_NAME_PATTERN, type RegistryBuild } from "./build";
import { compareStrings } from "./errors";

export const INDEX_FILE = "index.json";

export interface RegistryOutputResult {
  /** Absolute paths, `index.json` first. */
  written: string[];
  /** Absolute paths of stale item files. */
  removed: string[];
}

export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Output file name → content: `index.json`, then `<name>.json` per item. */
export function serializeRegistry(build: RegistryBuild): Map<string, string> {
  return new Map([
    [INDEX_FILE, serializeJson(build.index)],
    ...build.items.map((item): [string, string] => [`${item.name}.json`, serializeJson(item)]),
  ]);
}

async function isGeneratedItem(path: string): Promise<boolean> {
  try {
    return isRegistryItem(JSON.parse(await readFile(path, "utf8")));
  } catch {
    return false;
  }
}

/**
 * Item files of an earlier build that the new build no longer produces. Only `<name>.json`
 * files holding a registry item qualify, so unrelated JSON in the directory is never removed.
 */
export async function findStaleFiles(outDir: string, outputs: ReadonlyMap<string, string>): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(outDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const stale: string[] = [];
  for (const entry of entries) {
    const name = entry.name.endsWith(".json") ? entry.name.slice(0, -".json".length) : "";
    if (!entry.isFile() || !ITEM_NAME_PATTERN.test(name) || outputs.has(entry.name)) continue;
    if (await isGeneratedItem(join(outDir, entry.name))) stale.push(entry.name);
  }
  return stale.sort(compareStrings).map((file) => join(outDir, file));
}

/** Writes the outputs and removes stale item files; with `dryRun`, only reports them. */
export async function writeRegistryOutput(
  outDir: string,
  outputs: ReadonlyMap<string, string>,
  dryRun: boolean,
): Promise<RegistryOutputResult> {
  const removed = await findStaleFiles(outDir, outputs);
  const written = [...outputs.keys()].map((file) => join(outDir, file));
  if (dryRun) return { written, removed };
  await mkdir(outDir, { recursive: true });
  for (const [file, content] of outputs) await writeFile(join(outDir, file), content);
  await Promise.all(removed.map((path) => rm(path)));
  return { written, removed };
}
