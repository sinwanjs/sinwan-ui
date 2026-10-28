import type { SinwanUiConfig } from "../config";
import { mergeCssVars } from "../css-vars";
import type { RegistryCssVars, RegistryIndex, RegistryItem } from "../registry/schema";
import { type InstallTargets, planFiles, type PlannedFile } from "../write-files";
import type { CommandContext } from "./context";
import { fetchItemsOnly } from "./items";

export interface InstalledItem {
  item: RegistryItem;
  /** Planned files, compared with the local copies (imports already rewritten to the project's aliases). */
  files: PlannedFile[];
}

/**
 * The stylesheet as `add` leaves it: the registry content with `cssVars` merged in (without
 * overwriting), so variables the CLI added itself do not count as local changes.
 */
export function withCssVars(files: readonly PlannedFile[], css: string, cssVars: readonly RegistryCssVars[]): PlannedFile[] {
  return files.map((file) => {
    if (file.target !== css || cssVars.length === 0) return file;
    const content = cssVars.reduce((text, vars) => mergeCssVars(text, vars, false).content, file.content);
    const status = file.local === null ? "create" : file.local === content ? "identical" : "conflict";
    return { ...file, content, status };
  });
}

/** Index items that have files and whose destination files all exist in the project. */
export async function installedItems(
  context: CommandContext,
  config: SinwanUiConfig,
  targets: InstallTargets,
  index: RegistryIndex,
): Promise<InstalledItem[]> {
  const items = await fetchItemsOnly(
    context,
    config,
    index.items.map((entry) => entry.name),
  );
  const installed: InstalledItem[] = [];
  for (const item of items) {
    const files = await planFiles([item], targets, config);
    if (files.length > 0 && files.every((file) => file.local !== null)) installed.push({ item, files });
  }
  const cssVars = installed.flatMap(({ item }) => (item.cssVars ? [item.cssVars] : []));
  return installed.map(({ item, files }) => ({ item, files: withCssVars(files, targets.paths.css, cssVars) }));
}

export async function installedItemNames(
  context: CommandContext,
  config: SinwanUiConfig,
  targets: InstallTargets,
  index: RegistryIndex,
): Promise<Set<string>> {
  const items = await installedItems(context, config, targets, index);
  return new Set(items.map(({ item }) => item.name));
}
