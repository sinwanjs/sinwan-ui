import { requireConfig, type SinwanUiConfig } from "../config";
import { CliError } from "../errors";
import { loadProjectPaths, type ProjectPaths } from "../project-paths";
import type { CommandContext } from "./context";
import { applyCssVars, applyFiles, installPackages, installTargets, planInstall } from "./install-items";
import { installedItemNames } from "./installed";
import { fetchIndex } from "./progress";

async function pickItems(context: CommandContext, config: SinwanUiConfig, paths: ProjectPaths): Promise<string[]> {
  const index = await fetchIndex(context);
  const installed = await installedItemNames(context, config, installTargets(context, paths), index);
  const options = index.items.map((entry) => ({
    value: entry.name,
    label: entry.title ?? entry.name,
    hint: installed.has(entry.name) ? `installed · ${entry.description}` : entry.description,
  }));
  return context.deps.prompts.multiselect("Which items do you want to add?", options);
}

async function requestedItems(context: CommandContext, config: SinwanUiConfig, paths: ProjectPaths): Promise<string[]> {
  if (context.options.all) return (await fetchIndex(context)).items.map((entry) => entry.name);
  return context.args.length > 0 ? context.args : pickItems(context, config, paths);
}

export async function addCommand(context: CommandContext): Promise<number> {
  const { args, options, projectDir } = context;
  if (options.all && args.length > 0) {
    throw new CliError("Pass item names or --all, not both.");
  }
  if (!options.all && args.length === 0 && !context.interactive) {
    throw new CliError('add requires at least one item, or --all (run "sinwan-ui list" to see all items).');
  }
  const config = await requireConfig(projectDir);
  const paths = await loadProjectPaths(projectDir, config);
  const plan = await planInstall(context, config, paths, await requestedItems(context, config, paths));
  await applyFiles(context, plan);
  await applyCssVars(context, plan);
  await installPackages(context, config, plan);
  return 0;
}
