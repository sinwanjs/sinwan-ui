import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(path: string): Promise<string | null> {
  return (await pathExists(path)) ? readFile(path, "utf8") : null;
}

/**
 * Resolves `relativePath` against `root` and returns the absolute path, or `null`
 * when it is absolute or escapes `root`. `root` itself is accepted only with `allowRoot`.
 */
export function resolveInside(root: string, relativePath: string, allowRoot: boolean): string | null {
  if (isAbsolute(relativePath)) return null;
  const target = resolve(root, relativePath);
  const fromRoot = relative(root, target);
  if (fromRoot === "") return allowRoot ? target : null;
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) return null;
  return target;
}
