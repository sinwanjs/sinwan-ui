import { isAbsolute, relative, resolve } from "node:path";
import { buildRegistry } from "../build/build";
import { loadRegistryInput } from "../build/load";
import { serializeRegistry, writeRegistryOutput } from "../build/output";
import { CliError } from "../errors";
import type { CommandContext } from "./context";

const DEFAULT_MANIFEST = "registry.json";
const DEFAULT_OUTPUT = "public/r";

function displayPath(projectDir: string, path: string): string {
  const fromProject = relative(projectDir, path);
  return fromProject === "" || fromProject.startsWith("..") || isAbsolute(fromProject) ? path : fromProject;
}

/** `sinwan-ui build [registry.json] [--output <dir>]`: builds registry JSON from a manifest. */
export async function buildCommand(context: CommandContext): Promise<number> {
  const { io, options, args, projectDir } = context;
  const { colors } = context.deps;
  if (args.length > 1) {
    throw new CliError(`"sinwan-ui build" takes at most one manifest path (got: ${args.join(" ")}).`);
  }
  const manifestPath = resolve(projectDir, args[0] ?? DEFAULT_MANIFEST);
  const outDir = resolve(projectDir, options.output ?? DEFAULT_OUTPUT);
  const shown = (path: string): string => displayPath(projectDir, path);

  const build = await buildRegistry(await loadRegistryInput(manifestPath, shown(manifestPath)));
  const { written, removed } = await writeRegistryOutput(outDir, serializeRegistry(build), options.dryRun);
  const fileCount = build.items.reduce((count, item) => count + item.files.length, 0);
  const built = `${build.items.length} items (${fileCount} files) and index.json`;

  if (options.dryRun) {
    for (const path of written) io.stdout(`${colors.dim("would write")} ${shown(path)}\n`);
    for (const path of removed) io.stdout(`${colors.dim("would remove")} ${shown(path)}\n`);
    io.stdout(
      `${colors.warn("Dry run:")} would write ${built} to ${shown(outDir)} and remove ${removed.length} stale file(s).\n`,
    );
    return 0;
  }
  for (const path of removed) io.stdout(`${colors.dim("removed")} ${shown(path)}\n`);
  io.stdout(`${colors.success("Built")} ${built} into ${shown(outDir)}; removed ${removed.length} stale file(s).\n`);
  return 0;
}
