import { extname } from "node:path";
import type { Aliases } from "./config";

/** Canonical alias prefixes used in registry JSON, longest (most specific) first. */
export const CANONICAL_PREFIXES: ReadonlyArray<readonly [string, keyof Aliases]> = [
  ["@/components/ui", "ui"],
  ["@/components", "components"],
  ["@/lib/utils", "utils"],
  ["@/lib", "lib"],
  ["@/hooks", "hooks"],
];

const SCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

/** String literal after `from`, `import` (side-effect) or `import(`; `export … from` is covered by `from`. */
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"'\r\n]+)\2/g;

/** Maps one specifier whose prefix (on a path-segment boundary) is canonical to the configured alias. */
export function rewriteSpecifier(specifier: string, aliases: Aliases): string {
  for (const [prefix, key] of CANONICAL_PREFIXES) {
    if (specifier === prefix || specifier.startsWith(`${prefix}/`)) {
      return `${aliases[key]}${specifier.slice(prefix.length)}`;
    }
  }
  return specifier;
}

/** Applies `map` to every import/export specifier string in `content`. */
export function mapSpecifiers(content: string, map: (specifier: string) => string): string {
  return content.replace(
    SPECIFIER,
    (_match, keyword: string, quote: string, specifier: string) => `${keyword}${quote}${map(specifier)}${quote}`,
  );
}

/** Rewrites canonical import/export specifiers in script files; other files are returned unchanged. */
export function rewriteImports(content: string, filePath: string, aliases: Aliases): string {
  if (!SCRIPT_EXTENSIONS.has(extname(filePath))) return content;
  return mapSpecifiers(content, (specifier) => rewriteSpecifier(specifier, aliases));
}
