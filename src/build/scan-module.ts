import { errorMessage } from "../errors";

/** A module specifier found in source text. */
export interface SpecifierOccurrence {
  specifier: string;
  /** Offsets of the specifier text, quotes excluded; `source.slice(start, end) === specifier`. */
  start: number;
  end: number;
}

export type ModuleLoader = "ts" | "tsx";

export interface ModuleScan {
  occurrences: SpecifierOccurrence[];
  /** Runtime imports Bun's parser reports that the text scanner did not locate. */
  unlocated: string[];
}

type TokenKind = "word" | "string" | "punct" | "other";

interface Token {
  kind: TokenKind;
  value: string;
  start: number;
  end: number;
}

const WORD_CHAR = /[\w$\u0080-\uffff]/;
const WHITESPACE = /\s/;
const REGEX_AFTER_WORDS: ReadonlySet<string> = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await",
]);
const EXPRESSION_CLOSERS: ReadonlySet<string> = new Set([")", "]", "}"]);
/** Tokens an import/export clause may contain between the keyword and `from`. */
const CLAUSE_PUNCTUATION: ReadonlySet<string> = new Set([",", "{", "}", "*"]);
const RUNTIME_IMPORT_KINDS: ReadonlySet<string> = new Set(["import-statement", "dynamic-import"]);

const transpilers: Record<ModuleLoader, Bun.Transpiler> = {
  ts: new Bun.Transpiler({ loader: "ts" }),
  tsx: new Bun.Transpiler({ loader: "tsx" }),
};

/** `/` starts a regular expression unless it follows an operand; `</` closes a JSX tag. */
function regexAllowed(previous: Token | undefined): boolean {
  if (previous === undefined) return true;
  if (previous.kind === "word") return REGEX_AFTER_WORDS.has(previous.value);
  if (previous.kind === "punct") return !EXPRESSION_CLOSERS.has(previous.value) && previous.value !== "<";
  return false;
}

/**
 * Lexes just enough JavaScript to tell code from comments, strings, template text and
 * regular expressions. Quoted strings and regexes cannot span lines, so text the lexer
 * misreads (an apostrophe in JSX text) only affects the rest of that line.
 */
class Lexer {
  readonly tokens: Token[] = [];
  /** One entry per open `{`; `true` marks a template `${`. */
  private readonly braces: boolean[] = [];
  private index = 0;

  constructor(private readonly source: string) {}

  run(): Token[] {
    const { source } = this;
    while (this.index < source.length) {
      const char = source.charAt(this.index);
      const next = source.charAt(this.index + 1);
      if (WHITESPACE.test(char)) this.index += 1;
      else if (char === "/" && next === "/") this.skipTo("\n", 0);
      else if (char === "/" && next === "*") this.skipTo("*/", 2);
      else if (char === '"' || char === "'") this.readQuoted(char, "string");
      else if (char === "`") this.readTemplate(this.index + 1, true);
      else if (char === "}" && this.braces.at(-1) === true) {
        this.braces.pop();
        this.readTemplate(this.index + 1, false);
      } else if (char === "/" && regexAllowed(this.tokens.at(-1))) this.readQuoted("/", "other");
      else if (WORD_CHAR.test(char)) this.readWord();
      else this.readPunctuation(char);
    }
    return this.tokens;
  }

  private push(kind: TokenKind, start: number, end: number): void {
    this.tokens.push({ kind, value: this.source.slice(start, end), start, end });
  }

  private skipTo(terminator: string, searchOffset: number): void {
    const found = this.source.indexOf(terminator, this.index + searchOffset);
    this.index = found === -1 ? this.source.length : found + terminator.length;
  }

  /** A `'`/`"` string or a regex body; an unescaped newline ends it as unreadable. */
  private readQuoted(quote: string, kind: TokenKind): void {
    const { source } = this;
    const start = this.index + 1;
    let inClass = false;
    let at = start;
    while (at < source.length && source.charAt(at) !== "\n") {
      const char = source.charAt(at);
      if (char === "\\") {
        at += 2;
        continue;
      }
      if (quote === "/" && (char === "[" || char === "]")) inClass = char === "[";
      else if (char === quote && !inClass) {
        this.push(kind, start, at);
        this.index = at + 1;
        while (quote === "/" && WORD_CHAR.test(source.charAt(this.index))) this.index += 1;
        return;
      }
      at += 1;
    }
    this.index = Math.min(at, source.length);
    this.push("other", start, this.index);
  }

  /** Template text up to the closing backtick or the next `${`. */
  private readTemplate(start: number, opensTemplate: boolean): void {
    const { source } = this;
    for (let at = start; at < source.length; at += 1) {
      const char = source.charAt(at);
      if (char === "\\") at += 1;
      else if (char === "`") {
        this.push(opensTemplate ? "string" : "other", start, at);
        this.index = at + 1;
        return;
      } else if (char === "$" && source.charAt(at + 1) === "{") {
        this.push("other", start, at);
        this.braces.push(true);
        this.index = at + 2;
        return;
      }
    }
    this.push("other", start, source.length);
    this.index = source.length;
  }

  private readWord(): void {
    const start = this.index;
    while (this.index < this.source.length && WORD_CHAR.test(this.source.charAt(this.index))) this.index += 1;
    this.push("word", start, this.index);
  }

  private readPunctuation(char: string): void {
    if (char === "{") this.braces.push(false);
    else if (char === "}") this.braces.pop();
    this.push("punct", this.index, this.index + 1);
    this.index += 1;
  }
}

function isPunct(token: Token | undefined, value: string): boolean {
  return token?.kind === "punct" && token.value === value;
}

function startsLine(source: string, token: Token): boolean {
  const lineStart = source.lastIndexOf("\n", token.start - 1) + 1;
  return source.slice(lineStart, token.start).trim() === "";
}

/** `from` closes an import/export clause: only clause tokens lie between it and the keyword. */
function closesClause(tokens: readonly Token[], fromIndex: number): boolean {
  for (let at = fromIndex - 1; at >= 0; at -= 1) {
    const token = tokens[at];
    if (token?.kind === "word" && (token.value === "import" || token.value === "export")) return true;
    if (token?.kind !== "word" && !(token?.kind === "punct" && CLAUSE_PUNCTUATION.has(token.value))) return false;
  }
  return false;
}

function specifierAt(tokens: readonly Token[], index: number, source: string): Token | undefined {
  const token = tokens[index];
  const previous = tokens[index - 1];
  if (token?.kind !== "word" || isPunct(previous, ".")) return undefined;
  const next = tokens[index + 1];
  if (token.value === "from") return next?.kind === "string" && closesClause(tokens, index) ? next : undefined;
  if (token.value !== "import") return undefined;
  if (next?.kind === "string") {
    return previous === undefined || isPunct(previous, ";") || startsLine(source, token) ? next : undefined;
  }
  const argument = tokens[index + 2];
  const after = tokens[index + 3];
  const isCall = isPunct(next, "(") && (isPunct(after, ")") || isPunct(after, ","));
  return isCall && argument?.kind === "string" ? argument : undefined;
}

/**
 * Every static module specifier in TS/TSX text, with its position: value and type-only
 * imports and re-exports, side-effect imports, `import("…")` calls and `import("…")` types.
 */
export function findModuleSpecifiers(source: string): SpecifierOccurrence[] {
  const tokens = new Lexer(source).run();
  const occurrences: SpecifierOccurrence[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = specifierAt(tokens, index, source);
    if (token) occurrences.push({ specifier: token.value, start: token.start, end: token.end });
  }
  return occurrences;
}

function describeParseError(error: unknown): string {
  if (!(error instanceof AggregateError)) return errorMessage(error);
  const lines: string[] = [];
  for (const entry of error.errors) {
    const message = errorMessage(entry);
    const position: unknown = typeof entry === "object" && entry !== null ? Reflect.get(entry, "position") : null;
    const line: unknown = typeof position === "object" && position !== null ? Reflect.get(position, "line") : null;
    lines.push(typeof line === "number" ? `line ${line}: ${message}` : message);
  }
  return lines.join("; ");
}

/**
 * Bun's parser validates the syntax and lists runtime imports (it drops type-only ones and
 * adds synthetic JSX requires); the text scanner supplies positions and type-only imports.
 * Throws an `Error` describing the syntax error when Bun cannot parse the source.
 */
export function scanModule(source: string, loader: ModuleLoader): ModuleScan {
  let runtime: string[];
  try {
    runtime = transpilers[loader]
      .scanImports(source)
      .filter((entry) => RUNTIME_IMPORT_KINDS.has(entry.kind))
      .map((entry) => entry.path);
  } catch (error) {
    throw new Error(describeParseError(error));
  }
  const occurrences = findModuleSpecifiers(source);
  const located = new Set(occurrences.map((occurrence) => occurrence.specifier));
  return { occurrences, unlocated: [...new Set(runtime.filter((path) => !located.has(path)))] };
}
