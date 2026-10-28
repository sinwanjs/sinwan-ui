import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, relative } from "node:path";
import type { SinwanUiConfig } from "./config";
import { colorizeDiff, unifiedDiff } from "./diff";
import { CliError } from "./errors";
import { readTextIfExists, resolveInside } from "./fs-utils";
import type { CliIo } from "./io";
import { isDeclarationFile, isTypeScriptFile, jsPath, toJavaScript } from "./js-convert";
import type { ProjectPaths } from "./project-paths";
import type { RegistryFile, RegistryItem } from "./registry/schema";
import { rewriteImports } from "./rewrite-imports";
import type { CliPrompts, Colors, PromptOption } from "./ui";

export type PlannedStatus = "create" | "identical" | "conflict";

export interface PlannedFile {
  item: string;
  /** Absolute destination path. */
  target: string;
  /** Destination relative to the project directory, for messages. */
  display: string;
  content: string;
  local: string | null;
  status: PlannedStatus;
}

export interface WriteOptions {
  overwrite: boolean;
  /** Ask about conflicting files; otherwise keep them unless `overwrite`. */
  interactive: boolean;
  dryRun: boolean;
  prompts: CliPrompts;
  colors: Colors;
  io: CliIo;
}

/** Where files are written: the project's resolved aliases, plus `--path` for `registry:ui` files. */
export interface InstallTargets {
  paths: ProjectPaths;
  /** `--path <dir>` (absolute) or `paths.dirs.ui`. */
  uiDir: string;
}

const UTILS_FILE = /^utils\.[cm]?[jt]sx?$/;

function baseDirectory(file: RegistryFile, targets: InstallTargets): string {
  const { dirs, projectDir } = targets.paths;
  switch (file.type) {
    case "registry:ui":
      return targets.uiDir;
    case "registry:lib":
      return dirs.lib;
    case "registry:hook":
      return dirs.hooks;
    case "registry:file":
      return projectDir;
    default:
      return dirs.components;
  }
}

/**
 * Destination of a registry file: `target` (project-relative) when set; the stylesheet for
 * `registry:style`; the `utils` alias for the `utils.<ext>` lib file; otherwise `path` inside the
 * alias directory of the file type. Every destination must stay inside its base directory, so a
 * broken or malicious registry cannot write elsewhere.
 */
export function targetPath(item: RegistryItem, file: RegistryFile, targets: InstallTargets): string {
  const { paths } = targets;
  if (file.target === undefined && file.type === "registry:style") {
    if (item.files.filter((entry) => entry.type === "registry:style").length !== 1) {
      throw new CliError(`Registry item "${item.name}" must contain exactly one stylesheet.`);
    }
    return paths.css;
  }
  if (file.target === undefined && file.type === "registry:lib" && UTILS_FILE.test(file.path)) {
    return `${paths.utils}${extname(file.path)}`;
  }
  const [base, path] =
    file.target === undefined ? [baseDirectory(file, targets), file.path] : [paths.projectDir, file.target];
  const target = resolveInside(base, path, false);
  if (!target) {
    throw new CliError(
      `Registry item "${item.name}" has an unsafe file path "${path}"; files must stay inside ${base}.`,
    );
  }
  return target;
}

/** What `planFiles` needs from `sinwan-ui.json`. */
export type FileOptions = Pick<SinwanUiConfig, "aliases" | "tsx">;

/**
 * The file as it is copied: imports rewritten to the project's aliases and, with `"tsx": false`,
 * TypeScript converted to JavaScript (`.tsx` → `.jsx`, `.ts` → `.js`). Declaration files are
 * dropped in JavaScript projects (`null`): nothing there reads them.
 */
export function prepareFile(file: RegistryFile, options: FileOptions): RegistryFile | null {
  const name = file.target ?? file.path;
  const content = rewriteImports(file.content, name, options.aliases);
  if (options.tsx) return { ...file, content };
  if (isDeclarationFile(name)) return null;
  if (!isTypeScriptFile(name)) return { ...file, content };
  return {
    ...file,
    path: jsPath(file.path),
    content: toJavaScript(content, name),
    ...(file.target === undefined ? {} : { target: jsPath(file.target) }),
  };
}

/** Prepares every file (see `prepareFile`), then resolves and compares them before anything is written. */
export async function planFiles(
  items: readonly RegistryItem[],
  targets: InstallTargets,
  options: FileOptions,
): Promise<PlannedFile[]> {
  const files = items.flatMap((item) =>
    item.files.flatMap((original) => {
      const file = prepareFile(original, options);
      return file ? [{ item: item.name, target: targetPath(item, file, targets), content: file.content }] : [];
    }),
  );
  return Promise.all(
    files.map(async ({ item, target, content }): Promise<PlannedFile> => {
      const local = await readTextIfExists(target);
      const status: PlannedStatus = local === null ? "create" : local === content ? "identical" : "conflict";
      return { item, target, display: relative(targets.paths.projectDir, target), content, local, status };
    }),
  );
}

type ConflictDecision = "overwrite" | "skip";

const CONFLICT_CHOICES: readonly PromptOption<ConflictDecision | "diff">[] = [
  { value: "skip", label: "Keep my file" },
  { value: "overwrite", label: "Overwrite with the registry version" },
  { value: "diff", label: "Show the diff" },
];

async function askAboutConflict(file: PlannedFile, options: WriteOptions): Promise<ConflictDecision> {
  const answer = await options.prompts.select(
    `${file.display} differs from the registry.`,
    CONFLICT_CHOICES,
    "skip",
  );
  if (answer !== "diff") return answer;
  options.io.stdout(
    colorizeDiff(
      unifiedDiff(file.local ?? "", file.content, `${file.display} (local)`, `${file.display} (registry)`),
      options.colors,
    ),
  );
  return askAboutConflict(file, options);
}

async function write(file: PlannedFile): Promise<void> {
  await mkdir(dirname(file.target), { recursive: true });
  await writeFile(file.target, file.content);
}

const SKIP_HINT = "differs from the registry; pass --overwrite to replace it";

export async function writePlannedFiles(
  files: readonly PlannedFile[],
  options: WriteOptions,
): Promise<void> {
  const { io, colors } = options;
  for (const file of files) {
    if (file.status === "identical") continue;
    if (file.status === "create") {
      if (options.dryRun) io.stdout(`Would create ${file.display}\n`);
      else {
        await write(file);
        io.stdout(`${colors.success("Created")} ${file.display}\n`);
      }
      continue;
    }
    if (options.dryRun) {
      const plan = options.overwrite
        ? "Would overwrite"
        : options.interactive
          ? "Would ask before overwriting"
          : "Would skip";
      io.stdout(`${plan} ${file.display} (differs from the registry)\n`);
      continue;
    }
    const decision: ConflictDecision = options.overwrite
      ? "overwrite"
      : options.interactive
        ? await askAboutConflict(file, options)
        : "skip";
    if (decision === "overwrite") {
      await write(file);
      io.stdout(`${colors.success("Overwrote")} ${file.display}\n`);
    } else {
      io.stdout(`${colors.warn("Skipped")} ${file.display} (${SKIP_HINT})\n`);
    }
  }
}
