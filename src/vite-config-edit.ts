export const VITE_AT_ALIAS_ENTRY = '"@": fileURLToPath(new URL("./src", import.meta.url))';

const DEFINE_CONFIG_OPEN = /\bdefineConfig\(\s*\{/g;
const RESOLVE_KEY = /\bresolve\s*:/;
const FILE_URL_TO_PATH_IMPORT = /\bimport\s*\{[^}]*\bfileURLToPath\b[^}]*\}\s*from\s*["'](?:node:)?url["']/;

/**
 * Adds `resolve: { alias: { "@": … } }` as the first member of the only `defineConfig({ … })` object
 * and imports `fileURLToPath` from `node:url` when missing. Returns `null` when the edit is not safe:
 * no or several `defineConfig({`, or a `resolve` key that already exists.
 */
export function addViteAtAlias(text: string): string | null {
  const matches = [...text.matchAll(DEFINE_CONFIG_OPEN)];
  const [match] = matches;
  if (matches.length !== 1 || !match || RESOLVE_KEY.test(text)) return null;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const at = match.index + match[0].length;
  const rest = text.slice(at);
  const member = `resolve: { alias: { ${VITE_AT_ALIAS_ENTRY} } },`;
  const indent = /^[ \t]*\r?\n([ \t]*)/.exec(rest)?.[1];
  const inserted = indent === undefined ? ` ${member}` : `${eol}${indent}${member}`;
  const next = `${text.slice(0, at)}${inserted}${rest}`;
  return FILE_URL_TO_PATH_IMPORT.test(next) ? next : `import { fileURLToPath } from "node:url";${eol}${next}`;
}
