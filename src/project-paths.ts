import { relative } from "node:path";
import { type AliasKey, CONFIG_FILE, type SinwanUiConfig } from "./config";
import { CliError } from "./errors";
import { resolveInside } from "./fs-utils";
import { aliasDirectory, type AliasSource, loadAliasSource, resolveSpecifier } from "./tsconfig-paths";

export type AliasDirs = Record<Exclude<AliasKey, "utils">, string>;

/** Absolute destinations derived from `sinwan-ui.json` and the project's `paths`. */
export interface ProjectPaths {
  projectDir: string;
  /** `tailwind.css`. */
  css: string;
  dirs: AliasDirs;
  /** Module the `utils` alias points at, without extension (e.g. `/app/src/lib/utils`). */
  utils: string;
}

const DIR_KEYS = ["components", "ui", "lib", "hooks"] as const;

function insideProject(projectDir: string, path: string, allowRoot: boolean): boolean {
  return resolveInside(projectDir, relative(projectDir, path), allowRoot) !== null;
}

function unresolved(key: AliasKey, alias: string, source: AliasSource | null, projectDir: string): CliError {
  const where =
    source === null
      ? `there is no tsconfig.json or jsconfig.json in ${projectDir}`
      : `no compilerOptions.paths entry in ${relative(projectDir, source.file)} matches it`;
  return new CliError(
    `Cannot resolve the "${key}" alias "${alias}" from ${CONFIG_FILE}: ${where}. ` +
      `Add "@/*": ["./src/*"] to compilerOptions.paths, or run "sinwan-ui init".`,
  );
}

/** Resolves every alias to a directory inside the project; throws a `CliError` naming the first that fails. */
export function resolveProjectPaths(
  projectDir: string,
  config: SinwanUiConfig,
  source: AliasSource | null,
): ProjectPaths {
  const css = resolveInside(projectDir, config.tailwind.css, false);
  if (css === null) {
    throw new CliError(`${CONFIG_FILE}: "tailwind.css" must be a relative path inside the project directory.`);
  }
  const resolveDir = (key: (typeof DIR_KEYS)[number]): string => {
    const alias = config.aliases[key];
    const dir = source && aliasDirectory(source, alias);
    if (!dir) throw unresolved(key, alias, source, projectDir);
    if (!insideProject(projectDir, dir, true)) {
      throw new CliError(`The "${key}" alias "${alias}" resolves to ${dir}, outside the project directory.`);
    }
    return dir;
  };
  const dirs: AliasDirs = {
    components: resolveDir("components"),
    ui: resolveDir("ui"),
    lib: resolveDir("lib"),
    hooks: resolveDir("hooks"),
  };
  const utils = source && resolveSpecifier(source, config.aliases.utils);
  if (!utils) throw unresolved("utils", config.aliases.utils, source, projectDir);
  if (!insideProject(projectDir, utils, false)) {
    throw new CliError(`The "utils" alias "${config.aliases.utils}" resolves to ${utils}, outside the project directory.`);
  }
  return { projectDir, css, dirs, utils };
}

export async function loadProjectPaths(projectDir: string, config: SinwanUiConfig): Promise<ProjectPaths> {
  return resolveProjectPaths(projectDir, config, await loadAliasSource(projectDir));
}
