import { dirname, join, relative, resolve, sep } from "node:path";
import { readTextIfExists } from "./fs-utils";

/** Project-relative stylesheets an app usually imports, checked in order. */
export const ENTRY_STYLESHEETS = [
  "src/index.css",
  "src/app.css",
  "src/main.css",
  "src/styles.css",
  "src/global.css",
] as const;

const TAILWIND_IMPORT = /^@import\s+(["'])tailwindcss\1\s*;?\s*$/;
const ANY_IMPORT = /^\s*@import\s+(["'])([^"']+)\1/;

export type ThemeLink =
  | { status: "linked" }
  | { status: "replace"; specifier: string; content: string };

export type EntryStylesheet = ThemeLink & { path: string };

/** POSIX import specifier from `fromFile` to `toFile`, e.g. `./styles/global.css`. */
export function importSpecifier(fromFile: string, toFile: string): string {
  const path = relative(dirname(fromFile), toFile).split(sep).join("/");
  return path.startsWith("../") ? path : `./${path}`;
}

/**
 * `linked` when `content` already imports `themePath`; `replace` with the first
 * top-level `@import "tailwindcss"` line swapped for an import of the theme
 * (every other byte, including that line's ending, is preserved); otherwise `null`.
 */
export function linkTheme(content: string, entryPath: string, themePath: string): ThemeLink | null {
  const segments = content.split(/(?<=\n)/);
  let tailwindLine = -1;
  for (const [index, segment] of segments.entries()) {
    const line = segment.replace(/\r?\n$/, "");
    if (TAILWIND_IMPORT.test(line)) {
      if (tailwindLine < 0) tailwindLine = index;
      continue;
    }
    const imported = ANY_IMPORT.exec(line)?.[2];
    if (imported?.startsWith(".") && resolve(dirname(entryPath), imported) === themePath) {
      return { status: "linked" };
    }
  }
  const segment = segments[tailwindLine];
  if (segment === undefined) return null;
  const specifier = importSpecifier(entryPath, themePath);
  const ending = segment.slice(segment.replace(/\r?\n$/, "").length);
  segments[tailwindLine] = `@import "${specifier}";${ending}`;
  return { status: "replace", specifier, content: segments.join("") };
}

/**
 * First entry stylesheet (other than the theme itself) that already imports the
 * theme or imports Tailwind directly. Candidates are fixed paths inside `projectDir`.
 */
export async function findEntryStylesheet(
  projectDir: string,
  themePath: string,
): Promise<EntryStylesheet | null> {
  for (const candidate of ENTRY_STYLESHEETS) {
    const path = join(projectDir, candidate);
    if (path === themePath) continue;
    const content = await readTextIfExists(path);
    const link = content === null ? null : linkTheme(content, path, themePath);
    if (link) return { ...link, path };
  }
  return null;
}
