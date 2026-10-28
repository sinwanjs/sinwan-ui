import { requireConfig, type SinwanUiConfig } from "../config";
import { colorizeDiff, unifiedDiff } from "../diff";
import { CliError } from "../errors";
import { loadProjectPaths } from "../project-paths";
import { type InstallTargets, planFiles } from "../write-files";
import type { CommandContext } from "./context";
import { installTargets } from "./install-items";
import { installedItems, withCssVars } from "./installed";
import { fetchItem } from "./items";
import { fetchIndex } from "./progress";

async function diffItem(
  context: CommandContext,
  config: SinwanUiConfig,
  targets: InstallTargets,
  input: string,
): Promise<number> {
  const { io } = context;
  const { colors } = context.deps;
  const item = await fetchItem(context, config, input);
  let files = await planFiles([item], targets, config);
  if (files.some((file) => file.target === targets.paths.css)) {
    const installed = await installedItems(context, config, targets, await fetchIndex(context));
    files = withCssVars(files, targets.paths.css, installed.flatMap(({ item: entry }) => (entry.cssVars ? [entry.cssVars] : [])));
  }
  let changed = false;
  for (const file of files) {
    if (file.local === null) {
      changed = true;
      io.stdout(`${colors.warn(file.display)}: missing locally (run "sinwan-ui add ${input}")\n`);
      continue;
    }
    const patch = unifiedDiff(file.local, file.content, `${file.display} (local)`, `${file.display} (registry)`);
    if (patch) {
      changed = true;
      io.stdout(colorizeDiff(patch, colors));
    }
  }
  if (!changed) io.stdout(`${colors.success(input)} matches the registry.\n`);
  return changed ? 1 : 0;
}

async function diffInstalled(context: CommandContext, config: SinwanUiConfig, targets: InstallTargets): Promise<number> {
  const { io } = context;
  const { colors } = context.deps;
  const installed = await installedItems(context, config, targets, await fetchIndex(context));
  if (installed.length === 0) {
    io.stdout('No registry items are installed. Add some with "sinwan-ui add <items...>".\n');
    return 0;
  }
  const changed = installed.flatMap(({ item, files }) => {
    const differing = files.filter((file) => file.status === "conflict").map((file) => file.display);
    return differing.length > 0 ? [`  ${colors.warn(item.name)}: ${differing.join(", ")}`] : [];
  });
  if (changed.length === 0) {
    io.stdout(`${colors.success(`${installed.length} installed items match the registry.`)}\n`);
    return 0;
  }
  io.stdout(
    `${colors.heading("Installed items that differ from the registry:")}\n${changed.join("\n")}\n` +
      `Run "sinwan-ui diff <item>" to see the changes.\n`,
  );
  return 1;
}

/**
 * `diff [item]`: with an item, prints a unified diff of each file; without, lists installed items whose
 * files differ. Registry content is compared after rewriting imports to the project's aliases.
 * Exit code 0 when everything matches, 1 otherwise.
 */
export async function diffCommand(context: CommandContext): Promise<number> {
  const [input, ...extra] = context.args;
  if (extra.length > 0) throw new CliError("Usage: sinwan-ui diff [item]");
  const config = await requireConfig(context.projectDir);
  const targets = installTargets(context, await loadProjectPaths(context.projectDir, config));
  return input === undefined
    ? diffInstalled(context, config, targets)
    : diffItem(context, config, targets, input);
}
