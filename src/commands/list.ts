import { readConfig } from "../config";
import { loadProjectPaths } from "../project-paths";
import type { RegistryIndexEntry } from "../registry/schema";
import type { Colors } from "../ui";
import { expectNoArgs, type CommandContext } from "./context";
import { installTargets } from "./install-items";
import { installedItemNames } from "./installed";
import { fetchIndex } from "./progress";

/** One aligned row per entry: `✓`/blank marker, name, dimmed description. */
export function itemRows(
  entries: readonly RegistryIndexEntry[],
  installed: ReadonlySet<string>,
  colors: Colors,
): string {
  const width = Math.max(0, ...entries.map((entry) => entry.name.length));
  return entries
    .map((entry) => {
      const marker = installed.has(entry.name) ? colors.success("✓") : " ";
      return `  ${marker} ${entry.name.padEnd(width)}  ${colors.dim(entry.description)}`.trimEnd();
    })
    .join("\n");
}

export async function listCommand(context: CommandContext): Promise<number> {
  expectNoArgs(context, "list");
  const { io, projectDir, source } = context;
  const { colors } = context.deps;
  const config = await readConfig(projectDir);
  const index = await fetchIndex(context);
  const installed = config
    ? await installedItemNames(context, config, installTargets(context, await loadProjectPaths(projectDir, config)), index)
    : new Set<string>();

  io.stdout(
    `${colors.heading(`${index.name} ${index.version}`)} (${source.location})\n\n${itemRows(index.items, installed, colors)}\n`,
  );
  io.stdout(
    config
      ? `\n${installed.size} of ${index.items.length} installed (✓).\n`
      : '\nRun "sinwan-ui init" to set up this project.\n',
  );
  return 0;
}
