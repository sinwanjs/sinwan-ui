import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CliError, errorMessage } from "./errors";
import { isRegistryIndex, type RegistryIndex } from "./registry/schema";
import { DEFAULT_REGISTRY_REF, defaultRegistryUrl } from "./version";

export type FetchLike = (url: string) => Promise<Response>;

export interface RegistrySource {
  /** URL or directory of the default registry, for messages. */
  readonly location: string;
  /** Location template of default-registry items, containing `{name}`. */
  readonly itemTemplate: string;
  /** The default registry's `index.json`, fetched once. */
  getIndex(): Promise<RegistryIndex>;
  /** Reads and parses JSON from an http(s) URL or a local file. */
  readJson(location: string): Promise<unknown>;
}

export interface RegistrySourceOptions {
  registry: string | undefined;
  ref: string | undefined;
  /** Directory relative local registry paths are resolved against. */
  cwd: string;
  fetch: FetchLike;
}

const GIT_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const REGISTRY_HINT =
  "Check the registry location, or pass --registry <url-or-local-dir> (for example --registry ../sinwan-ui-registry/public/r).";

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseJson(text: string, location: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CliError(`Invalid JSON at ${location}: ${errorMessage(error)}`);
  }
}

async function fetchJson(url: string, fetchFn: FetchLike): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url);
  } catch (error) {
    throw new CliError(`Failed to fetch ${url}: ${errorMessage(error)}\n${REGISTRY_HINT}`);
  }
  if (!response.ok) {
    throw new CliError(`Failed to fetch ${url}: HTTP ${response.status}\n${REGISTRY_HINT}`);
  }
  return parseJson(await response.text(), url);
}

async function readLocalJson(path: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new CliError(`Cannot read ${path}: ${errorMessage(error)}\n${REGISTRY_HINT}`);
  }
  return parseJson(text, path);
}

function resolveLocation(options: RegistrySourceOptions): string {
  if (options.registry !== undefined) {
    if (options.ref !== undefined) {
      throw new CliError("--ref only applies to the default registry; remove it when using --registry.");
    }
    return isHttpUrl(options.registry)
      ? options.registry.replace(/\/+$/, "")
      : resolve(options.cwd, options.registry);
  }
  const ref = options.ref ?? DEFAULT_REGISTRY_REF;
  if (!GIT_REF.test(ref) || ref.includes("..")) {
    throw new CliError(`Invalid --ref "${ref}": expected a Git tag or branch name.`);
  }
  return defaultRegistryUrl(ref);
}

/** Joins a registry base (URL or directory) and a file name. */
function registryFile(location: string, file: string): string {
  return isHttpUrl(location) ? `${location}/${file}` : join(location, file);
}

export function createRegistrySource(options: RegistrySourceOptions): RegistrySource {
  const location = resolveLocation(options);
  const readJson = (from: string): Promise<unknown> =>
    isHttpUrl(from) ? fetchJson(from, options.fetch) : readLocalJson(from);
  let index: Promise<RegistryIndex> | undefined;
  const loadIndex = async (): Promise<RegistryIndex> => {
    const from = registryFile(location, "index.json");
    const value = await readJson(from);
    if (!isRegistryIndex(value)) throw new CliError(`Invalid registry index at ${from}.`);
    return value;
  };
  return {
    location,
    itemTemplate: registryFile(location, "{name}.json"),
    getIndex() {
      index ??= loadIndex();
      return index;
    },
    readJson,
  };
}
