import type { SpecifierOccurrence } from "./scan-module";

const IMPORT_RULE = /^@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1/;
const SOURCE_LINE = /^\s*@source\b[^\n;]*;\s*$/;

function isBlank(line: string | undefined): boolean {
  return line === undefined || line.trim() === "";
}

/** `@import "x"`, `@import 'x'`, `@import url(x)` and `@import url("x")` outside comments and strings. */
export function findCssImports(css: string): SpecifierOccurrence[] {
  const occurrences: SpecifierOccurrence[] = [];
  let index = 0;
  while (index < css.length) {
    const char = css.charAt(index);
    if (char === "/" && css.charAt(index + 1) === "*") {
      const close = css.indexOf("*/", index + 2);
      index = close === -1 ? css.length : close + 2;
    } else if (char === '"' || char === "'") {
      const close = css.indexOf(char, index + 1);
      index = close === -1 ? css.length : close + 1;
    } else {
      const match = char === "@" ? IMPORT_RULE.exec(css.slice(index)) : null;
      if (match) {
        const specifier = match[2] ?? "";
        const start = index + match[0].length - (match[1] ?? "").length - specifier.length;
        occurrences.push({ specifier, start, end: start + specifier.length });
        index += match[0].length;
      } else {
        index += 1;
      }
    }
  }
  return occurrences;
}

/** Index in `lines` where a block comment ending on the last line starts, or -1. */
function trailingCommentStart(lines: readonly string[]): number {
  const last = lines.length - 1;
  if (last < 0 || !(lines[last] ?? "").trimEnd().endsWith("*/")) return -1;
  for (let at = last; at >= 0; at -= 1) {
    const line = (lines[at] ?? "").trim();
    if (line.startsWith("/*")) return at === last || !line.includes("*/") ? at : -1;
    if (at < last && line.includes("*/")) return -1;
  }
  return -1;
}

/**
 * Removes Tailwind `@source …;` lines: copied stylesheets live in the consumer's `src/`,
 * which Tailwind scans already. A comment block directly above a run of `@source` lines is
 * removed too when blank lines (or the file edges) delimit both, so it only described them.
 */
export function stripTailwindSources(css: string): string {
  const lines = css.split("\n");
  const kept: string[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!SOURCE_LINE.test(lines[index] ?? "")) {
      kept.push(lines[index] ?? "");
      index += 1;
      continue;
    }
    let end = index;
    while (end < lines.length && SOURCE_LINE.test(lines[end] ?? "")) end += 1;
    const comment = trailingCommentStart(kept);
    if (comment !== -1 && isBlank(kept[comment - 1]) && isBlank(lines[end])) kept.length = comment;
    if (end < lines.length && isBlank(lines[end]) && isBlank(kept.at(-1))) end += 1;
    index = end;
  }
  return kept.join("\n");
}
