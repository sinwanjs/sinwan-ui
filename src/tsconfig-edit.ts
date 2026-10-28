import { isRecord } from "./fs-utils";

export const AT_ALIAS = "@/*";

function tryParse(text: string): unknown {
  try {
    return Bun.JSONC.parse(text);
  } catch {
    return undefined;
  }
}

/** `compilerOptions.paths["@/*"]` of a parsed config, if it is a string array. */
function atAliasTargets(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.compilerOptions) || !isRecord(value.compilerOptions.paths)) return undefined;
  return value.compilerOptions.paths[AT_ALIAS];
}

function indentUnit(text: string): string {
  return /\n([ \t]+)\S/.exec(text)?.[1] ?? "  ";
}

/** Inserts `member` as the first member of the object whose `{` is at `open`, matching the file's indentation. */
function insertMember(text: string, open: number, member: string, empty: boolean): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lineStart = text.lastIndexOf("\n", open) + 1;
  const outer = /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? "";
  const inner = `${outer}${indentUnit(text)}`;
  const inserted = empty ? `${eol}${inner}${member}${eol}${outer}` : `${eol}${inner}${member},`;
  return `${text.slice(0, open + 1)}${inserted}${text.slice(open + 1)}`;
}

/** Index of the `{` opening the value of the only `"key": {` in `text`, or `-1` when absent or ambiguous. */
function objectOpening(text: string, key: string): number {
  const matches = [...text.matchAll(new RegExp(`"${key}"\\s*:\\s*\\{`, "g"))];
  const [match] = matches;
  return matches.length === 1 && match ? match.index + match[0].length - 1 : -1;
}

/**
 * Adds `"@/*": [target]` to `compilerOptions.paths` with a minimal text insertion that keeps comments
 * and formatting. Returns `null` when the file cannot be edited safely (ambiguous structure, comments
 * before the root object, non-object values); the caller then prints the snippet instead.
 */
export function addAtAlias(text: string, target: string): string | null {
  const parsed = tryParse(text);
  if (!isRecord(parsed)) return null;
  const member = `"${AT_ALIAS}": ["${target}"]`;
  const options = parsed.compilerOptions;
  let next: string | null = null;
  if (options === undefined) {
    const open = text.trimStart().startsWith("{") ? text.indexOf("{") : -1;
    const empty = Object.keys(parsed).length === 0;
    if (open >= 0) next = insertMember(text, open, `"compilerOptions": { "paths": { ${member} } }`, empty);
  } else if (isRecord(options) && options.paths === undefined) {
    const open = objectOpening(text, "compilerOptions");
    if (open >= 0) next = insertMember(text, open, `"paths": { ${member} }`, Object.keys(options).length === 0);
  } else if (isRecord(options) && isRecord(options.paths)) {
    const open = objectOpening(text, "paths");
    if (open >= 0) next = insertMember(text, open, member, Object.keys(options.paths).length === 0);
  }
  if (next === null) return null;
  const targets = atAliasTargets(tryParse(next));
  return Array.isArray(targets) && targets[0] === target ? next : null;
}

/** Contents of a new config file that only declares the `@/*` alias. */
export function newConfigWithAtAlias(target: string): string {
  return `${JSON.stringify({ compilerOptions: { paths: { [AT_ALIAS]: [target] } } }, null, 2)}\n`;
}
