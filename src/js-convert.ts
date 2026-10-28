import { extname } from "node:path";
import { CliError, errorMessage } from "./errors";
import { JSX_FACTORY, JSX_FRAGMENT, restoreJsx } from "./jsx-restore";
import { mapSpecifiers } from "./rewrite-imports";

/** TypeScript extension → JavaScript extension for `"tsx": false` projects. */
const JS_EXTENSIONS: Readonly<Record<string, string>> = { ".ts": ".js", ".tsx": ".jsx", ".mts": ".mjs", ".cts": ".cjs" };
const DECLARATION_FILE = /\.d\.[cm]?ts$/;
const TS_SPECIFIER = /\.(?:[cm]?ts|tsx)$/;
const COMMENT_START = /^(?:\/\/|\/\*)/;
const DECLARATION =
  /^(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\b\s*\*?\s*|(?:class|const|let|var|enum|interface|type)\s+)([A-Za-z_$][\w$]*)?/;
/** Comments the Sinwan compiler reads; losing them would change behaviour, so a conversion that drops one fails. */
const BEHAVIOUR_COMMENT = /@sinwan-|sinwan-snapshot/;

const tsxToCalls = new Bun.Transpiler({
  loader: "tsx",
  tsconfig: { compilerOptions: { jsx: "react", jsxFactory: JSX_FACTORY, jsxFragmentFactory: JSX_FRAGMENT } },
});
const jsxToCalls = new Bun.Transpiler({
  loader: "jsx",
  tsconfig: { compilerOptions: { jsx: "react", jsxFactory: JSX_FACTORY, jsxFragmentFactory: JSX_FRAGMENT } },
});

export function isDeclarationFile(path: string): boolean {
  return DECLARATION_FILE.test(path);
}

/** Whether `path` is TypeScript source that `"tsx": false` converts (declaration files are not). */
export function isTypeScriptFile(path: string): boolean {
  return extname(path) in JS_EXTENSIONS && !isDeclarationFile(path);
}

/** `button.tsx` → `button.jsx`, `utils.ts` → `utils.js`; other paths are unchanged. */
export function jsPath(path: string): string {
  if (!isTypeScriptFile(path)) return path;
  const extension = extname(path);
  return `${path.slice(0, -extension.length)}${JS_EXTENSIONS[extension]}`;
}

/** Explicit `.ts`/`.tsx`/`.mts`/`.cts` extensions in import specifiers become their JavaScript equivalents. */
export function rewriteTsExtensions(content: string): string {
  return mapSpecifiers(content, (specifier) => (TS_SPECIFIER.test(specifier) && !isDeclarationFile(specifier) ? jsPath(specifier) : specifier));
}

interface KeptComment {
  text: string;
  /** Name of the top-level declaration it documents (`default` for `export default`), or `null` for the file header. */
  declaration: string | null;
}

/** Name of the declaration starting `line`; `default` for `export default` (Bun names anonymous ones). */
function declarationName(line: string): string | null {
  const match = DECLARATION.exec(line);
  if (!match) return null;
  return line.startsWith("export default") ? "default" : (match[1] ?? null);
}

/**
 * Column-0 comment groups that sit directly above a top-level declaration, plus the comment
 * block that opens the file. Bun drops comments, so these are re-attached after conversion.
 */
function keptComments(source: string): KeptComment[] {
  const lines = source.split("\n");
  const kept: KeptComment[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!COMMENT_START.test(lines[index] ?? "")) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < lines.length && COMMENT_START.test(lines[index] ?? "")) {
      if ((lines[index] ?? "").startsWith("/*")) {
        while (index < lines.length && !(lines[index] ?? "").includes("*/")) index += 1;
      }
      index += 1;
    }
    const text = lines.slice(start, index).join("\n");
    const declaration = declarationName(lines[index] ?? "");
    const atFileStart = lines.slice(0, start).every((line) => line.trim() === "");
    if (declaration !== null) kept.push({ text, declaration });
    else if (atFileStart) kept.push({ text, declaration: null });
  }
  return kept;
}

function reattachComments(source: string, output: string, path: string): string {
  const lines = output.split("\n");
  const used = new Set<number>();
  let header = "";
  for (const comment of keptComments(source)) {
    if (comment.declaration === null) {
      header += `${comment.text}\n`;
      continue;
    }
    const line = lines.findIndex(
      (candidate, index) => !used.has(index) && declarationName(candidate) === comment.declaration,
    );
    if (line < 0) {
      if (BEHAVIOUR_COMMENT.test(comment.text)) {
        throw new CliError(`Cannot keep the comment above "${comment.declaration}" in ${path} while converting it to JavaScript.`);
      }
      continue;
    }
    used.add(line);
    lines[line] = `${comment.text}\n${lines[line]}`;
  }
  return `${header}${lines.join("\n")}`;
}

/**
 * Converts TypeScript source to JavaScript with the JSX kept as JSX (the Sinwan compiler needs it):
 * Bun strips the types with JSX compiled to calls of a private factory, the calls are turned back
 * into JSX, and the top-level comments are re-attached. The result is accepted only if Bun compiles
 * it to exactly the same code as the original; otherwise the conversion fails instead of writing
 * something different.
 */
export function toJavaScript(source: string, path: string): string {
  if (source.includes(JSX_FACTORY) || source.includes(JSX_FRAGMENT)) {
    throw new CliError(`Cannot convert ${path} to JavaScript: it uses the reserved name ${JSX_FACTORY}.`);
  }
  const prepared = rewriteTsExtensions(source);
  let converted: string;
  let expected: string;
  try {
    expected = tsxToCalls.transformSync(prepared);
    converted = reattachComments(prepared, restoreJsx(expected), path);
    const actual = jsxToCalls.transformSync(converted);
    if (actual !== expected) throw new Error("the converted file does not compile to the same code");
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(
      `Cannot convert ${path} to JavaScript (${errorMessage(error)}). Set "tsx": true in sinwan-ui.json to copy TypeScript instead.`,
    );
  }
  return converted;
}
