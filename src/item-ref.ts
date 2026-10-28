import { dirname, join, resolve } from "node:path";
import { CONFIG_FILE } from "./config";
import { CliError } from "./errors";
import { isHttpUrl } from "./registry-source";

export const ITEM_NAME = /^[a-z0-9][a-z0-9-]*$/;
const NAMESPACED = /^(@[^/\s]+)\/([^/\s]+)$/;

/** Where bare names and relative paths found in an item resolve. */
export interface RefScope {
  /** Location template for bare names, containing `{name}`. */
  template: string;
  /** Bare names here belong to the default registry (validated against its index). */
  isDefault: boolean;
  /** URL of the referring item, or a directory, that relative `./item.json` paths resolve against. */
  base: string;
}

/** A resolved reference to one registry item. */
export interface ItemRef {
  /** As written on the command line or in `registryDependencies`, for messages. */
  display: string;
  /** Absolute URL or file path; also the dedupe key. */
  location: string;
  /** Expected `name` of the item for name-based references. */
  name: string | undefined;
  /** Bare name in the default registry. */
  inDefaultRegistry: boolean;
  /** Scope for this item's own `registryDependencies`. */
  scope: RefScope;
}

export interface RefContext {
  /** `sinwan-ui.json` `registries`. */
  registries: Readonly<Record<string, string>>;
  /** Directory relative registry templates are resolved against. */
  projectDir: string;
}

function fill(template: string, name: string): string {
  return template.replaceAll("{name}", name);
}

function scopeOf(location: string): RefScope {
  if (isHttpUrl(location)) {
    return { template: `${location.slice(0, location.lastIndexOf("/") + 1)}{name}.json`, isDefault: false, base: location };
  }
  return { template: join(dirname(location), "{name}.json"), isDefault: false, base: dirname(location) };
}

function isPathRef(input: string): boolean {
  return /^\.{1,2}\//.test(input) || input.startsWith("/") || input.endsWith(".json");
}

function namespaceTemplate(namespace: string, input: string, context: RefContext): string {
  const template = context.registries[namespace];
  if (template === undefined) {
    const configured = Object.keys(context.registries);
    const hint =
      configured.length > 0
        ? `Configured registries: ${configured.join(", ")}.`
        : `No registries are configured; add "registries": { "${namespace}": "https://…/{name}.json" } to ${CONFIG_FILE}.`;
    throw new CliError(`Unknown registry "${namespace}" in "${input}". ${hint}`);
  }
  return isHttpUrl(template) ? template : resolve(context.projectDir, template);
}

function invalidName(input: string): CliError {
  return new CliError(
    `Invalid item "${input}": expected a name, @namespace/name, an http(s) URL or a path to an item JSON file.`,
  );
}

/** Parses a name, `@namespace/name`, http(s) URL or JSON path relative to `scope`. */
export function parseItemRef(input: string, scope: RefScope, context: RefContext): ItemRef {
  if (isHttpUrl(input)) {
    return { display: input, location: input, name: undefined, inDefaultRegistry: false, scope: scopeOf(input) };
  }
  const namespaced = NAMESPACED.exec(input);
  if (namespaced && !input.endsWith(".json")) {
    const [, namespace = "", name = ""] = namespaced;
    if (!ITEM_NAME.test(name)) throw invalidName(input);
    const template = namespaceTemplate(namespace, input, context);
    return { ...parseItemRef(name, { template, isDefault: false, base: context.projectDir }, context), display: input };
  }
  if (isPathRef(input)) {
    const location = isHttpUrl(scope.base) ? new URL(input, scope.base).href : resolve(scope.base, input);
    return { display: input, location, name: undefined, inDefaultRegistry: false, scope: scopeOf(location) };
  }
  if (!ITEM_NAME.test(input)) throw invalidName(input);
  const location = fill(scope.template, input);
  return {
    display: input,
    location,
    name: input,
    inDefaultRegistry: scope.isDefault,
    scope: { ...scope, base: isHttpUrl(location) ? location : dirname(location) },
  };
}
