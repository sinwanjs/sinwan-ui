import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import type { SinwanUiConfig } from "../config";
import { mergeCssVars } from "../css-vars";
import { CliError, errorMessage } from "../errors";
import { readTextIfExists, resolveInside } from "../fs-utils";
import { installCommand, type InstallResult, missingDependencies, readProjectDependencies } from "../install";
import type { ProjectPaths } from "../project-paths";
import type { ResolvedItem } from "../resolve";
import { type InstallTargets, planFiles, type PlannedFile, writePlannedFiles } from "../write-files";
import type { CommandContext } from "./context";
import { fetchResolvedItems } from "./items";
import { usesSpinner, withProgress } from "./progress";

export interface InstallPlan {
  /** Items with dependencies first. */
  items: ResolvedItem[];
  targets: InstallTargets;
  files: PlannedFile[];
  /** npm specifiers the project does not declare yet. */
  packages: string[];
  devPackages: string[];
}

/** `--path <dir>` (project-relative) or the `ui` alias directory. */
export function installTargets(context: CommandContext, paths: ProjectPaths): InstallTargets {
  const option = context.options.path;
  if (option === undefined) return { paths, uiDir: paths.dirs.ui };
  const uiDir = resolveInside(paths.projectDir, option, true);
  if (uiDir === null) throw new CliError(`--path must be a relative directory inside the project (got "${option}").`);
  return { paths, uiDir };
}

/**
 * Resolves `inputs` with their transitive registry dependencies, then fetches, validates, rewrites
 * and plans every file. Nothing is written.
 */
export async function planInstall(
  context: CommandContext,
  config: SinwanUiConfig,
  paths: ProjectPaths,
  inputs: readonly string[],
  extraPackages: readonly string[] = [],
): Promise<InstallPlan> {
  const targets = installTargets(context, paths);
  const items = await fetchResolvedItems(context, config, inputs);
  const installed = await readProjectDependencies(context.projectDir);
  const packages = missingDependencies(
    [...extraPackages, ...items.flatMap(({ item }) => item.dependencies)],
    installed,
  );
  return {
    items,
    targets,
    files: await planFiles(
      items.map(({ item }) => item),
      targets,
      config,
    ),
    packages,
    devPackages: missingDependencies(
      items.flatMap(({ item }) => item.devDependencies),
      installed,
      packages,
    ),
  };
}

export async function applyFiles(context: CommandContext, plan: InstallPlan): Promise<void> {
  const { io, options } = context;
  io.stdout(`${context.deps.colors.heading("Items:")} ${plan.items.map(({ item }) => item.name).join(", ")}\n`);
  await writePlannedFiles(plan.files, {
    overwrite: options.overwrite,
    interactive: context.interactive,
    dryRun: options.dryRun,
    prompts: context.deps.prompts,
    colors: context.deps.colors,
    io,
  });
}

/** Merges every item's `cssVars` into `tailwind.css`; existing values change only with `--overwrite`. */
export async function applyCssVars(context: CommandContext, plan: InstallPlan): Promise<void> {
  const { io, options, projectDir } = context;
  const { colors } = context.deps;
  const scopes = plan.items.flatMap(({ item }) => (item.cssVars ? [item.cssVars] : []));
  if (scopes.length === 0) return;
  const { css } = plan.targets.paths;
  const display = relative(projectDir, css);
  const planned = plan.files.find((file) => file.target === css);
  const current = (await readTextIfExists(css)) ?? planned?.content ?? "";
  let content = current;
  let added = 0;
  let updated = 0;
  for (const cssVars of scopes) {
    const result = mergeCssVars(content, cssVars, options.overwrite);
    content = result.content;
    added += result.added;
    updated += result.updated;
  }
  if (content === current) {
    io.stdout(`${colors.dim(`CSS variables already in ${display}.`)}\n`);
    return;
  }
  const summary = `${added} added, ${updated} updated`;
  if (options.dryRun) {
    io.stdout(`Would update CSS variables in ${display} (${summary})\n`);
    return;
  }
  await mkdir(dirname(css), { recursive: true });
  await writeFile(css, content);
  io.stdout(`${colors.success("Updated")} CSS variables in ${display} (${summary})\n`);
}

async function runInstall(context: CommandContext, command: readonly string[], count: number): Promise<void> {
  const { io, options, projectDir } = context;
  const display = command.join(" ");
  if (options.dryRun) {
    io.stdout(`Would run: ${display}\n`);
    return;
  }
  const quiet = usesSpinner(context);
  if (!quiet) io.stdout(`Running: ${display}\n`);
  const install = async (): Promise<void> => {
    let result: InstallResult;
    try {
      result = await context.deps.install(command, projectDir, quiet);
    } catch (error) {
      throw new CliError(`Cannot run "${display}": ${errorMessage(error)}`);
    }
    if (result.exitCode !== 0) {
      const output = result.output.trim();
      throw new CliError(
        `"${display}" exited with code ${result.exitCode}; install the packages manually.${output ? `\n${output}` : ""}`,
      );
    }
  };
  await withProgress(context, `Running ${display}`, install, () => `Installed ${count} packages`);
}

/** Installs the plan's missing npm packages: one command for dependencies, one for devDependencies. */
export async function installPackages(
  context: CommandContext,
  config: SinwanUiConfig,
  plan: InstallPlan,
): Promise<void> {
  if (plan.packages.length === 0 && plan.devPackages.length === 0) {
    context.io.stdout("No new npm packages to install.\n");
    return;
  }
  if (plan.packages.length > 0) {
    await runInstall(context, installCommand(config.packageManager, plan.packages), plan.packages.length);
  }
  if (plan.devPackages.length > 0) {
    await runInstall(context, installCommand(config.packageManager, plan.devPackages, true), plan.devPackages.length);
  }
}
