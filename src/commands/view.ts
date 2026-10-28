import { readConfigState } from "../config";
import { CliError } from "../errors";
import type { CommandContext } from "./context";
import { fetchItemsOnly } from "./items";

/** Prints the item JSON (files included): one object for one item, an array for several. */
export async function viewCommand(context: CommandContext): Promise<number> {
  if (context.args.length === 0) throw new CliError("Usage: sinwan-ui view <items...>");
  const state = await readConfigState(context.projectDir);
  const items = await fetchItemsOnly(context, state.kind === "current" ? state.config : null, context.args);
  context.io.stdout(`${JSON.stringify(items.length === 1 ? items[0] : items, null, 2)}\n`);
  return 0;
}
