import { writeFile } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";
import { ALIAS_KEYS, type AliasKey, CONFIG_FILE, type SinwanUiConfig } from "../config";
import { CliError } from "../errors";
import { readTextIfExists } from "../fs-utils";
import { addAtAlias, AT_ALIAS, newConfigWithAtAlias } from "../tsconfig-edit";
import { aliasDirectory, type AliasSource, loadAliasSource, resolveSpecifier } from "../tsconfig-paths";
import { addViteAtAlias } from "../vite-config-edit";
import type { CommandContext } from "./context";

export const VITE_CONFIGS = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"] as const;

const VITE_AT_ALIAS = /\balias\b[\s\S]*?(["'`])@\/?\1/;

export const VITE_ALIAS_SNIPPET = [
  '  import { fileURLToPath, URL } from "node:url";',
  "  export default defineConfig({",
  '    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },',
  "  });",
].join("\n");

export interface AliasPlan {
  /** Mapping used to place files: the project's own, or the planned `@/*` alias. */
  source: AliasSource;
  /** Writes the planned tsconfig/jsconfig change (call only after the registry plan succeeded). */
  apply(): Promise<void>;
}

function unresolvedAliases(source: AliasSource | null, config: SinwanUiConfig): AliasKey[] {
  return ALIAS_KEYS.filter((key) => {
    const alias = config.aliases[key];
    if (source === null) return true;
    return key === "utils" ? resolveSpecifier(source, alias) === null : aliasDirectory(source, alias) === null;
  });
}

/** `./src/*` relative to `baseDir`, POSIX-style. */
function srcTarget(projectDir: string, baseDir: string): string {
  const path = relative(baseDir, join(projectDir, "src")).split(sep).join(posix.sep);
  if (path === "") return "./*";
  return path.startsWith("..") ? `${path}/*` : `./${path}/*`;
}

async function applyAtAlias(
  context: CommandContext,
  source: AliasSource | null,
  file: string,
  target: string,
): Promise<void> {
  const { io, options, projectDir } = context;
  const { colors } = context.deps;
  const display = relative(projectDir, file);
  const member = `"${AT_ALIAS}": ["${target}"]`;
  const manual = `add ${member} to compilerOptions.paths in ${display}`;
  if (source && !source.ownPaths && Object.keys(source.paths).length > 0) {
    io.stderr(
      `${colors.warn("warning:")} ${display} inherits compilerOptions.paths through "extends"; ${manual} ` +
        `(copy the inherited entries too, because "paths" replaces them).\n`,
    );
    return;
  }
  if (options.dryRun) {
    io.stdout(`Would ${manual}.\n`);
    return;
  }
  if (context.interactive && !(await context.deps.prompts.confirm(`Add the ${AT_ALIAS} path alias to ${display}?`, true))) {
    io.stdout(`${colors.warn("Next:")} ${manual}; copied files import through it.\n`);
    return;
  }
  const text = await readTextIfExists(file);
  if (text === null) {
    await writeFile(file, newConfigWithAtAlias(target));
    io.stdout(`${colors.success("Created")} ${display} with the ${AT_ALIAS} path alias.\n`);
    return;
  }
  const next = addAtAlias(text, target);
  if (next === null) {
    io.stderr(`${colors.warn("warning:")} cannot edit ${display} safely; ${manual}:\n  "paths": { ${member} }\n`);
    return;
  }
  await writeFile(file, next);
  io.stdout(`${colors.success("Updated")} ${display}: added ${member} to compilerOptions.paths.\n`);
}

/**
 * Checks that every alias in `config` resolves through tsconfig/jsconfig `paths`. When the default
 * `@/…` aliases are not mapped, plans adding `"@/*": ["./src/*"]` (asking first); custom aliases
 * that do not resolve are an error, since their directory cannot be guessed.
 */
export async function planPathAlias(context: CommandContext, config: SinwanUiConfig): Promise<AliasPlan> {
  const { projectDir } = context;
  const source = await loadAliasSource(projectDir);
  const unresolved = unresolvedAliases(source, config);
  if (unresolved.length === 0 && source) return { source, apply: async () => {} };

  const custom = unresolved.filter((key) => !config.aliases[key].startsWith("@/"));
  if (custom.length > 0) {
    const where = source ? `compilerOptions.paths in ${relative(projectDir, source.file)}` : "a tsconfig.json or jsconfig.json";
    const list = custom.map((key) => `${key} "${config.aliases[key]}"`).join(", ");
    throw new CliError(`These ${CONFIG_FILE} aliases are not mapped by ${where}: ${list}. Add matching paths, then re-run "sinwan-ui init".`);
  }
  const file = source?.file ?? join(projectDir, config.tsx ? "tsconfig.json" : "jsconfig.json");
  const baseDir = source?.baseDir ?? projectDir;
  const target = srcTarget(projectDir, baseDir);
  const planned: AliasSource = {
    rootFile: source?.rootFile ?? file,
    file,
    baseDir,
    paths: { ...source?.paths, [AT_ALIAS]: [target] },
    ownPaths: true,
  };
  return { source: planned, apply: () => applyAtAlias(context, source, file, target) };
}

/**
 * Adds an `@` entry to `resolve.alias` of the first Vite config that has none (Vite ignores tsconfig
 * `paths`), asking first in a terminal. Prints the snippet when the config cannot be edited safely.
 */
export async function applyViteAlias(context: CommandContext): Promise<void> {
  const { io, options, projectDir } = context;
  const { colors } = context.deps;
  for (const name of VITE_CONFIGS) {
    const file = join(projectDir, name);
    const content = await readTextIfExists(file);
    if (content === null) continue;
    if (VITE_AT_ALIAS.test(content)) return;
    const next = addViteAtAlias(content);
    if (next === null) {
      io.stderr(
        `${colors.warn("warning:")} ${name} has no "@" entry in resolve.alias, so Vite cannot resolve "@/…" imports. Add:\n${VITE_ALIAS_SNIPPET}\n`,
      );
      return;
    }
    if (options.dryRun) {
      io.stdout(`Would add the "@" alias to resolve.alias in ${name}.\n`);
      return;
    }
    if (context.interactive && !(await context.deps.prompts.confirm(`Add the "@" alias to resolve.alias in ${name}?`, true))) {
      io.stdout(`${colors.warn("Next:")} add the "@" alias to resolve.alias in ${name}; Vite ignores tsconfig paths:\n${VITE_ALIAS_SNIPPET}\n`);
      return;
    }
    await writeFile(file, next);
    io.stdout(`${colors.success("Updated")} ${name}: added the "@" alias to resolve.alias.\n`);
    return;
  }
}
