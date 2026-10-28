/**
 * Turns Bun's classic-runtime JSX output (`FACTORY(tag, props, ...children)`) back into JSX syntax.
 * The input is JavaScript printed by `Bun.Transpiler`, so a small scanner (strings, template
 * literals, regular expressions, comments, brackets) is enough; anything unexpected throws
 * `JsxRestoreError` and the caller refuses the conversion.
 */

export const JSX_FACTORY = "__sinwanUiJsx";
export const JSX_FRAGMENT = "__sinwanUiFragment";

export class JsxRestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsxRestoreError";
  }
}

const OPENERS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const REGEX_KEYWORDS = new Set([
  "return", "typeof", "case", "in", "of", "new", "delete", "void", "throw", "instanceof", "yield", "await", "do", "else",
]);
const IDENTIFIER_CHAR = /[\w$]/;
const STRING_LITERAL = /^(["'])((?:(?!\1)[^\\\r\n])*)\1$/;
const PROP = /^("(?:[^"\\]*)"|[A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/;
const SHORTHAND = /^[A-Za-z_$][\w$]*$/;
const UNSAFE_TEXT = /[{}<>&]/;
const INDENT = "  ";

function isIdentifierChar(char: string | undefined): boolean {
  return char !== undefined && IDENTIFIER_CHAR.test(char);
}

/** Whether a `/` at `index` starts a regular expression (rather than a division). */
function startsRegex(code: string, index: number): boolean {
  let end = index - 1;
  while (end >= 0 && /\s/.test(code.charAt(end))) end -= 1;
  if (end < 0) return true;
  const previous = code.charAt(end);
  if (!isIdentifierChar(previous)) return !")]}\"'`".includes(previous);
  let start = end;
  while (start > 0 && isIdentifierChar(code.charAt(start - 1))) start -= 1;
  return REGEX_KEYWORDS.has(code.slice(start, end + 1));
}

function skipQuoted(code: string, start: number, quote: string): number {
  for (let index = start + 1; index < code.length; index += 1) {
    const char = code.charAt(index);
    if (char === "\\") index += 1;
    else if (char === quote) return index + 1;
  }
  throw new JsxRestoreError("unterminated string literal");
}

function skipRegex(code: string, start: number): number {
  let inClass = false;
  for (let index = start + 1; index < code.length; index += 1) {
    const char = code.charAt(index);
    if (char === "\\") index += 1;
    else if (char === "[") inClass = true;
    else if (char === "]") inClass = false;
    else if (char === "/" && !inClass) {
      let end = index + 1;
      while (/[a-z]/i.test(code.charAt(end))) end += 1;
      return end;
    }
  }
  throw new JsxRestoreError("unterminated regular expression");
}

/** Index after the template literal starting at `start` (nested `${…}` included). */
function skipTemplate(code: string, start: number): number {
  for (let index = start + 1; index < code.length; index += 1) {
    const char = code.charAt(index);
    if (char === "\\") index += 1;
    else if (char === "`") return index + 1;
    else if (char === "$" && code.charAt(index + 1) === "{") index = findClosing(code, index + 1);
  }
  throw new JsxRestoreError("unterminated template literal");
}

/** Index after the string, template, regex or comment starting at `index`, or `-1` when none starts there. */
function skipLiteral(code: string, index: number): number {
  const char = code.charAt(index);
  if (char === '"' || char === "'") return skipQuoted(code, index, char);
  if (char === "`") return skipTemplate(code, index);
  if (char !== "/") return -1;
  const next = code.charAt(index + 1);
  if (next === "/") {
    const end = code.indexOf("\n", index);
    return end < 0 ? code.length : end;
  }
  if (next === "*") {
    const end = code.indexOf("*/", index + 2);
    if (end < 0) throw new JsxRestoreError("unterminated comment");
    return end + 2;
  }
  return startsRegex(code, index) ? skipRegex(code, index) : -1;
}

/** Index of the bracket closing the one at `open`. */
function findClosing(code: string, open: number): number {
  const stack: string[] = [];
  for (let index = open; index < code.length; index += 1) {
    const skipped = skipLiteral(code, index);
    if (skipped >= 0) {
      index = skipped - 1;
      continue;
    }
    const char = code.charAt(index);
    const closer = OPENERS[char];
    if (closer) stack.push(closer);
    else if (")]}".includes(char)) {
      if (stack.pop() !== char) throw new JsxRestoreError(`unbalanced "${char}"`);
      if (stack.length === 0) return index;
    }
  }
  throw new JsxRestoreError("unbalanced brackets");
}

/** Comma-separated parts of `code` at bracket depth 0, trimmed; a trailing empty part is dropped. */
function splitTopLevel(code: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < code.length; index += 1) {
    const skipped = skipLiteral(code, index);
    if (skipped >= 0) {
      index = skipped - 1;
    } else if (OPENERS[code.charAt(index)]) {
      index = findClosing(code, index);
    } else if (code.charAt(index) === ",") {
      parts.push(code.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = code.slice(start).trim();
  if (last !== "") parts.push(last);
  return parts;
}

function lastLineIndent(text: string): string {
  return /(?:^|\n)([ \t]*)[^\n]*$/.exec(text)?.[1] ?? "";
}

/** The value of a quoted literal without escapes, or `null`. */
function plainString(code: string): string | null {
  const match = STRING_LITERAL.exec(code);
  return match ? (match[2] ?? "") : null;
}

/** Index of the `)` closing a factory call that spans all of `code`, or `-1`. */
function wholeCall(code: string): number {
  if (!code.startsWith(`${JSX_FACTORY}(`)) return -1;
  const close = findClosing(code, JSX_FACTORY.length);
  return close === code.length - 1 ? close : -1;
}

function attribute(entry: string, indent: string): string {
  if (entry.startsWith("...")) return `{...${restoreJsx(entry.slice(3), indent)}}`;
  if (SHORTHAND.test(entry)) return `${entry}={${entry}}`;
  const match = PROP.exec(entry);
  if (!match) throw new JsxRestoreError(`unexpected JSX attribute "${entry}"`);
  const [, rawKey = "", value = ""] = match;
  const key = plainString(rawKey) ?? rawKey;
  if (value === "true") return key;
  const text = plainString(value);
  if (text !== null && value.startsWith('"') && !text.includes("&")) return `${key}=${value}`;
  return `${key}={${restoreJsx(value, indent)}}`;
}

interface Child {
  code: string;
  /** Written as bare JSX text. */
  text: boolean;
  /** Whitespace at the start/end of a text child: a line break there would change the text. */
  leadingSpace: boolean;
  trailingSpace: boolean;
}

/** The text of a string child that can be written as bare JSX text, or `null`. */
function jsxText(arg: string): string | null {
  const text = plainString(arg);
  return text !== null && text.trim() !== "" && !UNSAFE_TEXT.test(text) ? text : null;
}

/** `afterText`: the previous child is bare text, so JSX would merge this text into it. */
function child(arg: string, indent: string, afterText: boolean): Child {
  const text = jsxText(arg);
  if (text !== null && !afterText) {
    return { code: text, text: true, leadingSpace: /^\s/.test(text), trailingSpace: /\s$/.test(text) };
  }
  const code = wholeCall(arg) >= 0 ? restoreJsx(arg, indent) : `{${restoreJsx(arg, indent)}}`;
  return { code, text: false, leadingSpace: false, trailingSpace: false };
}

function element(args: readonly string[], indent: string): string {
  const [tagArg = "", propsArg = "null", ...childArgs] = args;
  const fragment = tagArg === JSX_FRAGMENT;
  const tag = fragment ? "" : (plainString(tagArg) ?? tagArg);
  const inner = `${indent}${INDENT}`;
  let attributes: string[] = [];
  if (propsArg !== "null") {
    if (fragment || !propsArg.startsWith("{")) throw new JsxRestoreError(`unexpected JSX props "${propsArg}"`);
    attributes = splitTopLevel(propsArg.slice(1, -1)).map((entry) => attribute(entry, inner));
  }
  const open = `<${tag}${attributes.map((entry) => ` ${entry}`).join("")}`;
  if (childArgs.length === 0) return fragment ? "<></>" : `${open} />`;
  const children: Child[] = [];
  for (const arg of childArgs) children.push(child(arg, inner, children.at(-1)?.text ?? false));
  const multiline = children.every((entry) => !entry.leadingSpace && !entry.trailingSpace);
  const body = multiline
    ? `\n${children.map((entry) => `${inner}${entry.code}`).join("\n")}\n${indent}`
    : children.map((entry) => entry.code).join("");
  return `${open}>${body}</${tag}>`;
}

/** Replaces every factory call in `code` (including inside template literals) with JSX. */
export function restoreJsx(code: string, indent = ""): string {
  let output = "";
  let index = 0;
  while (index < code.length) {
    const char = code.charAt(index);
    if (
      code.startsWith(`${JSX_FACTORY}(`, index) &&
      !isIdentifierChar(code.charAt(index - 1)) &&
      code.charAt(index - 1) !== "."
    ) {
      const open = index + JSX_FACTORY.length;
      const close = findClosing(code, open);
      const lineIndent = output.includes("\n") ? lastLineIndent(output) : `${indent}${lastLineIndent(output)}`;
      output += element(splitTopLevel(code.slice(open + 1, close)), lineIndent);
      index = close + 1;
    } else if (char === "`") {
      const end = skipTemplate(code, index);
      output += restoreTemplate(code.slice(index, end));
      index = end;
    } else {
      const end = skipLiteral(code, index);
      output += end >= 0 ? code.slice(index, end) : char;
      index = end >= 0 ? end : index + 1;
    }
  }
  return output;
}

function restoreTemplate(template: string): string {
  let output = "";
  let index = 0;
  while (index < template.length) {
    const char = template.charAt(index);
    if (char === "\\") {
      output += template.slice(index, index + 2);
      index += 2;
    } else if (char === "$" && template.charAt(index + 1) === "{") {
      const close = findClosing(template, index + 1);
      output += `\${${restoreJsx(template.slice(index + 2, close))}}`;
      index = close + 1;
    } else {
      output += char;
      index += 1;
    }
  }
  return output;
}
