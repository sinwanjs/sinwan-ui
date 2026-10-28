import type { RegistryCssVars } from "./registry/schema";

export interface CssVarsResult {
  content: string;
  added: number;
  updated: number;
}

interface Declaration {
  name: string;
  valueStart: number;
  valueEnd: number;
}

interface Block {
  selector: string;
  /** Index right after the last non-whitespace character of the body (where new declarations go). */
  insertAt: number;
  /** The body's last statement lacks a terminating `;`. */
  needsSemicolon: boolean;
  indent: string;
  declarations: Map<string, Declaration>;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

const COMMENT = /\/\*[\s\S]*?\*\//g;
const STRING = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g;
const DECLARATION = /^\s*(--[A-Za-z0-9_-]+)\s*:\s*([\s\S]*?)\s*$/d;
const DEFAULT_INDENT = "  ";

/** `light` → `:root`, `dark` → `.dark`, `theme` → `@theme inline`; any other scope is used as the selector itself. */
export function scopeSelector(scope: string): string {
  if (scope === "light") return ":root";
  if (scope === "dark") return ".dark";
  return scope === "theme" ? "@theme inline" : scope;
}

function variableName(name: string): string {
  return name.startsWith("--") ? name : `--${name}`;
}

/** Same-length copy with comments blanked and strings replaced by `_`, so braces and semicolons inside them are ignored. */
function mask(css: string): string {
  return css
    .replace(COMMENT, (match) => " ".repeat(match.length))
    .replace(STRING, (match) => "_".repeat(match.length));
}

/** `--name: value` declarations directly inside the block body (not inside nested rules). */
function parseDeclarations(masked: string, open: number, close: number): Block["declarations"] {
  const declarations = new Map<string, Declaration>();
  let depth = 0;
  let start = open + 1;
  const take = (end: number): void => {
    const match = DECLARATION.exec(masked.slice(start, end));
    const name = match?.[1];
    const range = match?.indices?.[2];
    if (name !== undefined && range !== undefined && !declarations.has(name)) {
      declarations.set(name, { name, valueStart: start + range[0], valueEnd: start + range[1] });
    }
    start = end + 1;
  };
  for (let index = open + 1; index < close; index += 1) {
    const char = masked[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) start = index + 1;
    } else if (char === ";" && depth === 0) take(index);
  }
  take(close);
  return declarations;
}

function blockIndent(masked: string, open: number, close: number): string {
  const line = /\n([ \t]+)\S/.exec(masked.slice(open + 1, close));
  return line?.[1] ?? DEFAULT_INDENT;
}

/** Top-level `selector { … }` blocks (nested rules are skipped). */
function topLevelBlocks(css: string): Block[] {
  const masked = mask(css);
  const blocks: Block[] = [];
  let depth = 0;
  let statementStart = 0;
  let open = -1;
  for (let index = 0; index < masked.length; index += 1) {
    const char = masked[index];
    if (char === "{") {
      if (depth === 0) open = index;
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth > 0) continue;
      const trimmed = masked.slice(open + 1, index).trimEnd();
      blocks.push({
        selector: css.slice(statementStart, open).replace(COMMENT, "").trim(),
        insertAt: open + 1 + trimmed.length,
        needsSemicolon: trimmed.trim() !== "" && !/[;{}]$/.test(trimmed),
        indent: blockIndent(masked, open, index),
        declarations: parseDeclarations(masked, open, index),
      });
      statementStart = index + 1;
    } else if (char === ";" && depth === 0) {
      statementStart = index + 1;
    }
  }
  return blocks;
}

/**
 * Merges registry `cssVars` into `css`: missing variables are added to the matching top-level block
 * (or a new block appended at the end); existing values are replaced only with `overwrite`.
 * Applying the same variables twice changes nothing.
 */
export function mergeCssVars(css: string, cssVars: RegistryCssVars, overwrite: boolean): CssVarsResult {
  const blocks = topLevelBlocks(css);
  const edits: Edit[] = [];
  const appended: string[] = [];
  let added = 0;
  let updated = 0;
  for (const [scope, variables] of Object.entries(cssVars)) {
    const selector = scopeSelector(scope);
    const block = blocks.find((candidate) => candidate.selector === selector);
    const missing: string[] = [];
    for (const [rawName, value] of Object.entries(variables)) {
      const name = variableName(rawName);
      const existing = block?.declarations.get(name);
      if (!existing) {
        missing.push(`${name}: ${value};`);
        continue;
      }
      if (overwrite && css.slice(existing.valueStart, existing.valueEnd) !== value) {
        edits.push({ start: existing.valueStart, end: existing.valueEnd, text: value });
        updated += 1;
      }
    }
    added += missing.length;
    if (missing.length === 0) continue;
    if (block) {
      const lines = missing.map((line) => `\n${block.indent}${line}`).join("");
      edits.push({ start: block.insertAt, end: block.insertAt, text: `${block.needsSemicolon ? ";" : ""}${lines}` });
    } else {
      appended.push(`${selector} {\n${missing.map((line) => `${DEFAULT_INDENT}${line}\n`).join("")}}\n`);
    }
  }
  let content = css;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    content = `${content.slice(0, edit.start)}${edit.text}${content.slice(edit.end)}`;
  }
  if (appended.length > 0) {
    const separator = content === "" ? "" : content.endsWith("\n") ? "\n" : "\n\n";
    content = `${content}${separator}${appended.join("\n")}`;
  }
  return { content, added, updated };
}
