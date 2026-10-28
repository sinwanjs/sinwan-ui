import { CliError } from "../errors";
import type { RegistryIndex, RegistryIndexEntry } from "../registry/schema";
import type { CommandContext } from "./context";
import { itemRows } from "./list";
import { fetchIndex } from "./progress";

/** Lower rank sorts first: exact name, name prefix, name substring, title, description. */
function rank(entry: RegistryIndexEntry, query: string): number | null {
  const name = entry.name.toLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (entry.title?.toLowerCase().includes(query)) return 3;
  return entry.description.toLowerCase().includes(query) ? 4 : null;
}

/** Case-insensitive match of `query` against name, title and description; name matches first, then by name. */
export function searchIndex(index: RegistryIndex, query: string): RegistryIndexEntry[] {
  const needle = query.trim().toLowerCase();
  return index.items
    .flatMap((entry) => {
      const score = rank(entry, needle);
      return score === null ? [] : [{ entry, score }];
    })
    .sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name))
    .map(({ entry }) => entry);
}

export async function searchCommand(context: CommandContext): Promise<number> {
  const query = context.args.join(" ").trim();
  if (query === "") throw new CliError("Usage: sinwan-ui search <query>");
  const { io } = context;
  const { colors } = context.deps;
  const matches = searchIndex(await fetchIndex(context), query);
  if (matches.length === 0) {
    io.stdout(`No items match "${query}". Run "sinwan-ui list" to see all items.\n`);
    return 0;
  }
  const count = matches.length === 1 ? "1 item matches" : `${matches.length} items match`;
  io.stdout(`${colors.heading(`${count} "${query}"`)}\n\n${itemRows(matches, new Set(), colors)}\n`);
  return 0;
}
