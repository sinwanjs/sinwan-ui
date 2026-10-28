import { join } from "node:path";
import {
  type Aliases,
  CONFIG_FILE,
  type ConfigState,
  createConfig,
  DEFAULT_ALIASES,
  DEFAULT_CSS_PATH,
  detectPackageManager,
  readConfigState,
  type SinwanUiConfig,
  writeConfig,
} from "../config";
import { CliError } from "../errors";
import { pathExists } from "../fs-utils";
import { readProjectDependencies } from "../install";
import { resolveProjectPaths } from "../project-paths";
import { expectNoArgs, type CommandContext } from "./context";
import { applyCssVars, applyFiles, installPackages, planInstall } from "./install-items";
import { linkThemeStylesheet } from "./link-stylesheet";
import { applyViteAlias, planPathAlias } from "./path-alias";

export const INIT_ITEMS = ["utils", "style"] as const;
export const CORE_PACKAGE = "sinwan-ui-core@^1.0.0";
const REQUIRED_PACKAGES = ["sinwan", "tailwindcss"] as const;

type ConfigOrigin = "existing" | "created" | "migrated";

/** Prompts are skipped without a terminal, with `--yes` and with `--defaults`. */
function asksForConfig(context: CommandContext): boolean {
  return context.interactive && !context.options.defaults;
}

async function ask(context: CommandContext, question: string, fallback: string): Promise<string> {
  if (!asksForConfig(context)) return fallback;
  return (await context.deps.prompts.text(question, fallback)).trim() || fallback;
}

async function askAliases(context: CommandContext): Promise<Aliases> {
  const defaults = Object.values(DEFAULT_ALIASES).join(", ");
  if (!asksForConfig(context) || !(await context.deps.prompts.confirm(`Customize import aliases (${defaults})?`, false))) {
    return DEFAULT_ALIASES;
  }
  const components = await ask(context, "Import alias for components?", DEFAULT_ALIASES.components);
  const ui = await ask(context, "Import alias for UI components?", `${components}/ui`);
  const lib = await ask(context, "Import alias for lib?", DEFAULT_ALIASES.lib);
  const hooks = await ask(context, "Import alias for hooks?", DEFAULT_ALIASES.hooks);
  return { components, ui, lib, utils: `${lib}/utils`, hooks };
}

/**
 * `false` without asking for a JavaScript project (a `jsconfig.json` and no `tsconfig.json`);
 * otherwise asks when `prompt` is set, defaulting to whether a `tsconfig.json` exists.
 */
async function usesTypeScript(context: CommandContext, prompt: boolean): Promise<boolean> {
  const hasTsconfig = await pathExists(join(context.projectDir, "tsconfig.json"));
  if (!hasTsconfig && (await pathExists(join(context.projectDir, "jsconfig.json")))) return false;
  if (!prompt || !asksForConfig(context)) return hasTsconfig;
  return context.deps.prompts.confirm("Use TypeScript (copy .tsx/.ts files instead of .jsx/.js)?", hasTsconfig);
}

async function newConfig(context: CommandContext, css: string, tsx: boolean, aliases: Aliases): Promise<SinwanUiConfig> {
  return createConfig({ tsx, css, aliases, packageManager: await detectPackageManager(context.projectDir) });
}

async function initConfig(
  context: CommandContext,
  state: ConfigState,
): Promise<{ config: SinwanUiConfig; origin: ConfigOrigin }> {
  if (state.kind === "current") return { config: state.config, origin: "existing" };
  if (state.kind === "missing") {
    const css = await ask(context, "Path of the global stylesheet (the theme)?", DEFAULT_CSS_PATH);
    const tsx = await usesTypeScript(context, true);
    return { config: await newConfig(context, css, tsx, await askAliases(context)), origin: "created" };
  }
  const question = `${CONFIG_FILE} uses the old format ("baseDir"/"css"). Replace it with the new format (default aliases, same stylesheet)?`;
  if (context.interactive && !(await context.deps.prompts.confirm(question, true))) {
    throw new CliError(`${CONFIG_FILE} was left unchanged; the CLI needs the new format to continue.`);
  }
  const config = await newConfig(
    context,
    state.legacy.css ?? DEFAULT_CSS_PATH,
    await usesTypeScript(context, false),
    DEFAULT_ALIASES,
  );
  return { config: { ...config, packageManager: state.legacy.packageManager ?? config.packageManager }, origin: "migrated" };
}

async function saveConfig(context: CommandContext, config: SinwanUiConfig, origin: ConfigOrigin): Promise<void> {
  const { io, options, projectDir } = context;
  const { colors } = context.deps;
  if (origin === "existing") {
    io.stdout(`Using existing ${CONFIG_FILE}.\n`);
    return;
  }
  const verb = origin === "created" ? "create" : "migrate";
  if (options.dryRun) {
    io.stdout(`Would ${verb} ${CONFIG_FILE}:\n${JSON.stringify(config, null, 2)}\n`);
    return;
  }
  await writeConfig(projectDir, config);
  io.stdout(origin === "created" ? `${colors.success("Created")} ${CONFIG_FILE}.\n` : `${colors.success("Migrated")} ${CONFIG_FILE} to the new format.\n`);
}

async function warnAboutRequiredPackages(context: CommandContext): Promise<void> {
  const installed = await readProjectDependencies(context.projectDir);
  const warning = context.deps.colors.warn("warning:");
  if (!installed) {
    context.io.stderr(
      `${warning} no package.json in ${context.projectDir}; sinwan-ui needs ${REQUIRED_PACKAGES.join(" and ")}.\n`,
    );
    return;
  }
  for (const name of REQUIRED_PACKAGES) {
    if (!installed.has(name)) {
      context.io.stderr(`${warning} "${name}" is not in package.json; sinwan-ui components need it.\n`);
    }
  }
}

/**
 * `init`: creates (or migrates) `sinwan-ui.json`, makes sure its aliases resolve through tsconfig/jsconfig
 * `paths`, writes the `utils` and `style` items, links the theme and installs `sinwan-ui-core` with their
 * dependencies. Everything is planned (and the registry validated) before the first write.
 */
export async function initCommand(context: CommandContext): Promise<number> {
  expectNoArgs(context, "init");
  const { io, projectDir } = context;
  const { colors } = context.deps;
  const { config, origin } = await initConfig(context, await readConfigState(projectDir));
  const alias = await planPathAlias(context, config);
  const paths = resolveProjectPaths(projectDir, config, alias.source);
  const plan = await planInstall(context, config, paths, INIT_ITEMS, [CORE_PACKAGE]);

  await saveConfig(context, config, origin);
  await alias.apply();
  await applyViteAlias(context);
  await warnAboutRequiredPackages(context);
  await applyFiles(context, plan);
  await applyCssVars(context, plan);
  await linkThemeStylesheet(context, paths.css);
  await installPackages(context, config, plan);
  io.stdout(`${colors.success("Done.")} Add components with "sinwan-ui add <items...>".\n`);
  return 0;
}
