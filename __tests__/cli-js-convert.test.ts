import { describe, expect, test } from "bun:test";
import {
  isDeclarationFile,
  isTypeScriptFile,
  jsPath,
  rewriteTsExtensions,
  toJavaScript,
} from "../src/js-convert";
import { JSX_FACTORY, JSX_FRAGMENT, JsxRestoreError, restoreJsx } from "../src/jsx-restore";

const J = JSX_FACTORY;
const F = JSX_FRAGMENT;

describe("cli jsx-restore", () => {
  test("elements, attributes and children", () => {
    expect(restoreJsx(`${J}("div", null)`)).toBe("<div />");
    expect(restoreJsx(`${J}(${F}, null)`)).toBe("<></>");
    expect(restoreJsx(`${J}(Foo.Bar, { x: 1 })`)).toBe("<Foo.Bar x={1} />");
    expect(
      restoreJsx(
        `${J}("a", { ...rest, href, "aria-label": "it's", "data-x": "a & b", title: 'q"', disabled: true, onClick: (e) => go(e) }, "text")`,
      ),
    ).toBe(`<a {...rest} href={href} aria-label="it's" data-x={"a & b"} title={'q"'} disabled onClick={(e) => go(e)}>\n  text\n</a>`);
  });

  test("children are laid out on lines unless whitespace at a text edge would change", () => {
    expect(restoreJsx(`${J}("p", null, "Hello", ${J}("b", null, "x"), name)`)).toBe(
      "<p>\n  Hello\n  <b>\n    x\n  </b>\n  {name}\n</p>",
    );
    expect(restoreJsx(`${J}("p", null, "Hello ", ${J}("b", null, "x"))`)).toBe("<p>Hello <b>\n    x\n  </b></p>");
    expect(restoreJsx(`${J}("p", null, " ", "a{b}", "a\\nb", "<", 'single')`)).toBe(
      `<p>\n  {" "}\n  {"a{b}"}\n  {"a\\nb"}\n  {"<"}\n  single\n</p>`,
    );
    expect(restoreJsx(`  return ${J}(${F}, null, ok ? ${J}("i", null) : null);`)).toBe(
      "  return <>\n    {ok ? <i /> : null}\n  </>;",
    );
  });

  test("calls inside templates, strings, regexes and comments", () => {
    expect(restoreJsx(`const t = \`a \${${J}("b", null)} \\\` \${{ x: 1 }.x}\`;`)).toBe("const t = `a ${<b />} \\` ${{ x: 1 }.x}`;");
    expect(restoreJsx(`const s = "${J}(";`)).toBe(`const s = "${J}(";`);
    expect(restoreJsx(`x.${J}(1); my${J}(2);`)).toBe(`x.${J}(1); my${J}(2);`);
    expect(restoreJsx(`const r = /[/)]\\/${J}(/gi; // ${J}(\n/* ${J}( */ f(${J}("a", null))`)).toBe(
      `const r = /[/)]\\/${J}(/gi; // ${J}(\n/* ${J}( */ f(<a />)`,
    );
    expect(restoreJsx(`a = b / 2 / ${J}("i", null); c = (d) / 1; return /x/.test(y); e = f[0] / 2; g = "\\"" / 1`)).toBe(
      `a = b / 2 / <i />; c = (d) / 1; return /x/.test(y); e = f[0] / 2; g = "\\"" / 1`,
    );
    expect(restoreJsx(`/re/.test(a); x = typeof /y/;`)).toBe(`/re/.test(a); x = typeof /y/;`);
    expect(restoreJsx(`${J}("a", { x: [1, (2)], y: { z: 3 } }, ${J}("b", null),)`)).toBe(
      "<a x={[1, (2)]} y={{ z: 3 }}>\n  <b />\n</a>",
    );
    expect(restoreJsx("// end")).toBe("// end");
  });

  test("adjacent text children stay separate", () => {
    expect(restoreJsx(`${J}("p", null, " · ", "Open:", " ", ${J}("b", null))`)).toBe(
      `<p> · {"Open:"}{" "}<b /></p>`,
    );
    const source = `export const P = () => (\n  <p>\n    Value: <b>{x}</b>\n    {" · "}\n    Open:{" "}\n    <i>{y}</i>\n  </p>\n);\n`;
    expect(toJavaScript(source, "p.tsx")).toContain(`{"Open:"}`);
  });

  test("malformed input throws JsxRestoreError", () => {
    const cases: Array<[string, string]> = [
      [`${J}("a", { "x`, "unterminated string literal"],
      [`${J}(a, /x`, "unterminated regular expression"],
      [`${J}(a, \`x`, "unterminated template literal"],
      [`${J}(a, /* x`, "unterminated comment"],
      [`${J}(a, ]`, 'unbalanced "]"'],
      [`${J}(a, (b`, "unbalanced brackets"],
      [`${J}("a", { [k]: 1 })`, 'unexpected JSX attribute "[k]: 1"'],
      [`${J}(${F}, { key: 1 })`, 'unexpected JSX props "{ key: 1 }"'],
      [`${J}("a", props)`, 'unexpected JSX props "props"'],
    ];
    for (const [input, message] of cases) {
      expect(() => restoreJsx(input)).toThrow(new JsxRestoreError(message));
    }
    expect(new JsxRestoreError("x").name).toBe("JsxRestoreError");
  });
});

describe("cli js-convert paths and specifiers", () => {
  test("file names", () => {
    expect(isDeclarationFile("echarts-gl.d.ts")).toBe(true);
    expect(isDeclarationFile("a.d.mts")).toBe(true);
    expect(isTypeScriptFile("a.d.ts")).toBe(false);
    expect(isTypeScriptFile("global.css")).toBe(false);
    expect(jsPath("select/select.tsx")).toBe("select/select.jsx");
    expect(jsPath("utils.ts")).toBe("utils.js");
    expect(jsPath("a.mts")).toBe("a.mjs");
    expect(jsPath("a.cts")).toBe("a.cjs");
    expect(jsPath("a.d.ts")).toBe("a.d.ts");
    expect(jsPath("theme.css")).toBe("theme.css");
  });

  test("explicit TypeScript extensions in specifiers", () => {
    expect(
      rewriteTsExtensions(
        'import a from "./a.tsx";\nimport b from "@/lib/b.ts";\nexport * from "./c.mts";\nimport "./types.d.ts";\nimport d from "./d";\nconst s = "./e.ts";',
      ),
    ).toBe(
      'import a from "./a.jsx";\nimport b from "@/lib/b.js";\nexport * from "./c.mjs";\nimport "./types.d.ts";\nimport d from "./d";\nconst s = "./e.ts";',
    );
  });
});

describe("cli js-convert toJavaScript", () => {
  const SOURCE = [
    "// Header comment",
    "/** @jsxImportSource sinwan */",
    "",
    'import type { Props } from "./types";',
    'import { cn } from "@/lib/utils";',
    'import { Bar } from "./bar.tsx";',
    "",
    "/** Documented helper. */",
    "export interface Options { a: number }",
    "",
    "/** @sinwan-pure */",
    "export function size(value: number): string {",
    "  return `${value}px`;",
    "}",
    "",
    "/*",
    " * The component.",
    " */",
    "export const Box = (props: Props & { tone?: string }) => {",
    "  const tone = props.tone as string;",
    "  // nested comments are dropped by Bun",
    "  return (",
    '    <div class={cn("box", tone)} data-tone={tone!}>',
    "      {props.children}",
    "      <Bar />",
    "    </div>",
    "  );",
    "};",
    "",
    "// default export",
    "export default function (): JSX.Element {",
    "  return <></>;",
    "}",
    "",
  ].join("\n");

  test("strips types, keeps JSX and the comments the compiler reads", () => {
    expect(toJavaScript(SOURCE, "box.tsx")).toBe(
      [
        "// Header comment",
        "/** @jsxImportSource sinwan */",
        'import { cn } from "@/lib/utils";',
        'import { Bar } from "./bar.jsx";',
        "/** @sinwan-pure */",
        "export function size(value) {",
        "  return `${value}px`;",
        "}",
        "/*",
        " * The component.",
        " */",
        "export const Box = (props) => {",
        "  const tone = props.tone;",
        '  return <div class={cn("box", tone)} data-tone={tone}>',
        "    {props.children}",
        "    <Bar />",
        "  </div>;",
        "};",
        "// default export",
        "export default function input_default() {",
        "  return <></>;",
        "}",
        "",
      ].join("\n"),
    );
  });

  test("plain TypeScript and enums", () => {
    expect(toJavaScript("export enum Side { Left }\nexport const x: number = 1;\n", "a.ts")).toBe(
      'export var Side;\n((Side) => {\n  Side[Side["Left"] = 0] = "Left";\n})(Side ||= {});\nexport const x = 1;\n',
    );
  });

  test("refuses conversions it cannot prove", () => {
    expect(() => toJavaScript(`const ${J} = 1;`, "a.tsx")).toThrow(
      `Cannot convert a.tsx to JavaScript: it uses the reserved name ${J}.`,
    );
    expect(() => toJavaScript("const = ;", "a.ts")).toThrow(
      /^Cannot convert a\.ts to JavaScript \(.+\)\. Set "tsx": true in sinwan-ui\.json to copy TypeScript instead\.$/,
    );
    expect(() => toJavaScript("const t = `\n// looks like a comment\nconst y = 1\n`;\n", "t.ts")).toThrow(
      "Cannot convert t.ts to JavaScript (the converted file does not compile to the same code).",
    );
    expect(() => toJavaScript("/** @sinwan-pure */\nexport declare function f(): void;\n", "d.ts.tsx")).toThrow(
      'Cannot keep the comment above "f" in d.ts.tsx while converting it to JavaScript.',
    );
    expect(toJavaScript("const a = 1;\n/** docs */\nexport type T = string;\nexport default a;\n", "t.ts")).toBe(
      "const a = 1;\nexport default a;\n",
    );
  });
});
