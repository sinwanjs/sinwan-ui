import { CliError } from "./errors";
import type { ItemRef } from "./item-ref";
import type { RegistryIndex, RegistryItem } from "./registry/schema";
import { closeMatches } from "./suggest";

export interface ResolvedItem {
  ref: ItemRef;
  item: RegistryItem;
}

/** Registry access needed to resolve a dependency graph. */
export interface ItemResolver {
  /** The default registry's index (only requested when a default-registry name is involved). */
  index(): Promise<RegistryIndex>;
  /** Fetches and validates the item at `ref.location`. */
  load(ref: ItemRef): Promise<RegistryItem>;
  /** Parses one `registryDependencies` entry of `parent`. */
  child(dependency: string, parent: ItemRef): ItemRef;
}

export function unknownItemMessage(name: string, index: RegistryIndex): string {
  const matches = closeMatches(
    name,
    index.items.map((item) => item.name),
  );
  const hint = matches.length > 0 ? ` Did you mean: ${matches.join(", ")}?` : "";
  return `Unknown item "${name}".${hint} Run "sinwan-ui list" to see all items.`;
}

/** Rejects default-registry names missing from its index, suggesting close matches. */
export async function assertKnownItems(
  requested: readonly ItemRef[],
  loadIndex: () => Promise<RegistryIndex>,
): Promise<void> {
  const names = requested.filter((ref) => ref.inDefaultRegistry).map((ref) => ref.display);
  if (names.length === 0) return;
  const index = await loadIndex();
  const known = new Set(index.items.map((entry) => entry.name));
  const unknown = names.filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new CliError(unknown.map((name) => unknownItemMessage(name, index)).join("\n"));
  }
}

/**
 * Expands `requested` with transitive `registryDependencies`, deduplicated by location. Dependencies
 * come before their dependents; order is otherwise first-seen. Cycles are tolerated. Items are
 * prefetched as soon as they are known, so independent fetches overlap.
 */
export async function resolveItems(requested: readonly ItemRef[], resolver: ItemResolver): Promise<ResolvedItem[]> {
  await assertKnownItems(requested, () => resolver.index());
  const loads = new Map<string, Promise<RegistryItem>>();
  const load = (ref: ItemRef): Promise<RegistryItem> => {
    const existing = loads.get(ref.location);
    if (existing) return existing;
    const started = resolver.load(ref);
    started.catch(() => undefined);
    loads.set(ref.location, started);
    return started;
  };
  for (const ref of requested) load(ref);

  const ordered: ResolvedItem[] = [];
  const visited = new Set<string>();
  const visit = async (ref: ItemRef, dependent: RegistryItem | undefined): Promise<void> => {
    if (visited.has(ref.location)) return;
    visited.add(ref.location);
    if (dependent && ref.inDefaultRegistry) {
      const index = await resolver.index();
      if (!index.items.some((entry) => entry.name === ref.name)) {
        throw new CliError(`Registry item "${dependent.name}" depends on unknown item "${ref.display}".`);
      }
    }
    const item = await load(ref);
    const children = item.registryDependencies.map((dependency) => resolver.child(dependency, ref));
    for (const child of children) load(child);
    for (const child of children) await visit(child, item);
    ordered.push({ ref, item });
  };
  for (const ref of requested) await visit(ref, undefined);
  return ordered;
}
