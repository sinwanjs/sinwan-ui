export const REGISTRY_ITEM_TYPES = [
  "registry:ui",
  "registry:lib",
  "registry:hook",
  "registry:style",
  "registry:block",
  "registry:file",
] as const;

export type RegistryItemType = (typeof REGISTRY_ITEM_TYPES)[number];

export interface RegistryFile {
  /** Path relative to the consumer alias directory for `type` (e.g. `button.tsx`, `select/select.tsx`). */
  path: string;
  type: RegistryItemType;
  content: string;
  /** Explicit project-relative destination; required for `registry:file`, optional otherwise. */
  target?: string;
}

/** CSS custom properties per scope, e.g. `{ light: { primary: "oklch(...)" }, dark: { ... } }`. */
export type RegistryCssVars = Record<string, Record<string, string>>;

export interface RegistryItem {
  $schema?: string;
  name: string;
  type: RegistryItemType;
  title?: string;
  description: string;
  /** npm specifiers with a version range, e.g. `echarts@^6.1.0`, `sinwan-ui-core@^1.0.0`. */
  dependencies: string[];
  devDependencies: string[];
  /** Bare item names (same registry), `@namespace/name`, or full URLs. */
  registryDependencies: string[];
  files: RegistryFile[];
  cssVars?: RegistryCssVars;
  docs?: string;
}

export type RegistryIndexEntry = Pick<
  RegistryItem,
  "name" | "type" | "title" | "description" | "registryDependencies"
>;

export interface RegistryIndex {
  name: string;
  homepage?: string;
  version: string;
  items: RegistryIndexEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function isRegistryItemType(value: unknown): value is RegistryItemType {
  return (
    typeof value === "string" &&
    (REGISTRY_ITEM_TYPES as readonly string[]).includes(value)
  );
}

export function isRegistryFile(value: unknown): value is RegistryFile {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    value.path.length > 0 &&
    isRegistryItemType(value.type) &&
    typeof value.content === "string" &&
    isOptionalString(value.target) &&
    (value.type !== "registry:file" || typeof value.target === "string")
  );
}

export function isRegistryCssVars(value: unknown): value is RegistryCssVars {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (scope) => isRecord(scope) && Object.values(scope).every((entry) => typeof entry === "string"),
    )
  );
}

function hasIndexEntryFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.name === "string" &&
    value.name.length > 0 &&
    isRegistryItemType(value.type) &&
    isOptionalString(value.title) &&
    typeof value.description === "string" &&
    isStringArray(value.registryDependencies)
  );
}

function isRegistryIndexEntry(value: unknown): value is RegistryIndexEntry {
  return isRecord(value) && hasIndexEntryFields(value);
}

export function isRegistryItem(value: unknown): value is RegistryItem {
  return (
    isRecord(value) &&
    hasIndexEntryFields(value) &&
    isOptionalString(value.$schema) &&
    isStringArray(value.dependencies) &&
    isStringArray(value.devDependencies) &&
    Array.isArray(value.files) &&
    value.files.every(isRegistryFile) &&
    (value.cssVars === undefined || isRegistryCssVars(value.cssVars)) &&
    isOptionalString(value.docs)
  );
}

export function isRegistryIndex(value: unknown): value is RegistryIndex {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    isOptionalString(value.homepage) &&
    typeof value.version === "string" &&
    Array.isArray(value.items) &&
    value.items.every(isRegistryIndexEntry)
  );
}
