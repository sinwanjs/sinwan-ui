import type { Colors } from "./ui";

export type DiffKind = " " | "-" | "+";

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

/** Line diff from the longest common subsequence of `before` and `after`. */
export function diffLines(before: readonly string[], after: readonly string[]): DiffLine[] {
  const rows = before.length;
  const cols = after.length;
  const width = cols + 1;
  const lcs = new Uint32Array((rows + 1) * width);
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        before[i] === after[j]
          ? (lcs[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(lcs[(i + 1) * width + j] ?? 0, lcs[i * width + j + 1] ?? 0);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      lines.push({ kind: " ", text: before[i] ?? "" });
      i += 1;
      j += 1;
    } else if ((lcs[(i + 1) * width + j] ?? 0) >= (lcs[i * width + j + 1] ?? 0)) {
      lines.push({ kind: "-", text: before[i] ?? "" });
      i += 1;
    } else {
      lines.push({ kind: "+", text: after[j] ?? "" });
      j += 1;
    }
  }
  for (; i < rows; i += 1) lines.push({ kind: "-", text: before[i] ?? "" });
  for (; j < cols; j += 1) lines.push({ kind: "+", text: after[j] ?? "" });
  return lines;
}

/** Colours a `unifiedDiff` patch: file headers, hunk headers, additions and removals. */
export function colorizeDiff(patch: string, colors: Colors): string {
  return patch
    .split("\n")
    .map((line, index) => {
      if (index < 2) return colors.heading(line);
      if (line.startsWith("@@")) return colors.accent(line);
      if (line.startsWith("+")) return colors.success(line);
      return line.startsWith("-") ? colors.error(line) : line;
    })
    .join("\n");
}

function hunkRange(start: number, count: number): string {
  return `${count === 0 ? start - 1 : start},${count}`;
}

/** Unified diff of two texts; empty string when they are identical. */
export function unifiedDiff(
  before: string,
  after: string,
  beforeLabel: string,
  afterLabel: string,
  context = 3,
): string {
  if (before === after) return "";
  const lines = diffLines(before.split("\n"), after.split("\n"));
  const changes = lines.flatMap((line, index) => (line.kind === " " ? [] : [index]));

  const groups: Array<[number, number]> = [];
  for (const index of changes) {
    const last = groups.at(-1);
    if (last && index - last[1] <= context * 2 + 1) last[1] = index;
    else groups.push([index, index]);
  }

  const output = [`--- ${beforeLabel}`, `+++ ${afterLabel}`];
  let cursor = 0;
  let beforeLine = 1;
  let afterLine = 1;
  for (const [firstChange, lastChange] of groups) {
    const start = Math.max(0, firstChange - context);
    const end = Math.min(lines.length, lastChange + context + 1);
    for (; cursor < start; cursor += 1) {
      beforeLine += 1;
      afterLine += 1;
    }
    const hunk = lines.slice(start, end);
    const beforeCount = hunk.filter((line) => line.kind !== "+").length;
    const afterCount = hunk.filter((line) => line.kind !== "-").length;
    output.push(`@@ -${hunkRange(beforeLine, beforeCount)} +${hunkRange(afterLine, afterCount)} @@`);
    for (const line of hunk) output.push(`${line.kind}${line.text}`);
    cursor = end;
    beforeLine += beforeCount;
    afterLine += afterCount;
  }
  return `${output.join("\n")}\n`;
}
