import type { RegistryIndex } from "../registry/schema";
import type { CommandContext } from "./context";

/** Spinners need a terminal; `--dry-run` output stays plain so it can be read as a plan. */
export function usesSpinner(context: CommandContext): boolean {
  return context.deps.isTTY && !context.options.dryRun;
}

/** Runs `task` behind a spinner when `usesSpinner`, silently otherwise. */
export async function withProgress<T>(
  context: CommandContext,
  startMessage: string,
  task: () => Promise<T>,
  doneMessage: (result: T) => string,
): Promise<T> {
  if (!usesSpinner(context)) return task();
  const spinner = context.deps.spinner();
  spinner.start(startMessage);
  try {
    const result = await task();
    spinner.stop(doneMessage(result));
    return result;
  } catch (error) {
    spinner.fail(startMessage);
    throw error;
  }
}

export function fetchIndex(context: CommandContext): Promise<RegistryIndex> {
  return withProgress(
    context,
    `Fetching registry index from ${context.source.location}`,
    () => context.source.getIndex(),
    (index) => `Registry ${index.name} ${index.version}: ${index.items.length} items`,
  );
}
