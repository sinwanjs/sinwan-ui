import type { SinwanUiConfig } from "../config";
import { CliError } from "../errors";
import { type ItemRef, parseItemRef, type RefContext, type RefScope } from "../item-ref";
import { isRegistryItem, type RegistryItem } from "../registry/schema";
import { assertKnownItems, type ItemResolver, type ResolvedItem, resolveItems } from "../resolve";
import type { CommandContext } from "./context";
import { withProgress } from "./progress";

function refContext(context: CommandContext, config: SinwanUiConfig | null): RefContext {
  return { registries: config?.registries ?? {}, projectDir: context.projectDir };
}

/** Scope of command-line items: bare names use the default registry, paths resolve against the working directory. */
function commandLineScope(context: CommandContext): RefScope {
  return { template: context.source.itemTemplate, isDefault: true, base: context.deps.cwd };
}

export function parseRequestedRefs(
  context: CommandContext,
  config: SinwanUiConfig | null,
  inputs: readonly string[],
): ItemRef[] {
  const scope = commandLineScope(context);
  const refs = refContext(context, config);
  return inputs.map((input) => parseItemRef(input, scope, refs));
}

export async function loadItem(context: CommandContext, ref: ItemRef): Promise<RegistryItem> {
  const value = await context.source.readJson(ref.location);
  if (!isRegistryItem(value) || (ref.name !== undefined && value.name !== ref.name)) {
    throw new CliError(`Invalid registry item "${ref.display}" at ${ref.location}.`);
  }
  return value;
}

function itemResolver(context: CommandContext, config: SinwanUiConfig | null): ItemResolver {
  const refs = refContext(context, config);
  return {
    index: () => context.source.getIndex(),
    load: (ref) => loadItem(context, ref),
    child: (dependency, parent) => parseItemRef(dependency, parent.scope, refs),
  };
}

/** Resolves `inputs` and their registry dependencies (dependencies first) behind a spinner. */
export function fetchResolvedItems(
  context: CommandContext,
  config: SinwanUiConfig | null,
  inputs: readonly string[],
): Promise<ResolvedItem[]> {
  const refs = parseRequestedRefs(context, config, inputs);
  return withProgress(
    context,
    `Fetching ${inputs.join(", ")} and dependencies`,
    () => resolveItems(refs, itemResolver(context, config)),
    (items) => `Fetched ${items.length} items`,
  );
}

/** Fetches `inputs` without their dependencies; unknown default-registry names suggest close matches. */
export function fetchItemsOnly(
  context: CommandContext,
  config: SinwanUiConfig | null,
  inputs: readonly string[],
): Promise<RegistryItem[]> {
  const refs = parseRequestedRefs(context, config, inputs);
  return withProgress(
    context,
    `Fetching ${refs.length} items`,
    async () => {
      await assertKnownItems(refs, () => context.source.getIndex());
      return Promise.all(refs.map((ref) => loadItem(context, ref)));
    },
    (items) => `Fetched ${items.length} items`,
  );
}

/** Fetches one item without its dependencies. */
export function fetchItem(context: CommandContext, config: SinwanUiConfig | null, input: string): Promise<RegistryItem> {
  const ref = parseItemRef(input, commandLineScope(context), refContext(context, config));
  return withProgress(
    context,
    `Fetching ${input}`,
    async () => {
      await assertKnownItems([ref], () => context.source.getIndex());
      return loadItem(context, ref);
    },
    () => `Fetched ${input}`,
  );
}
