import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CliError, errorMessage } from "./errors";
import { isRecord, pathExists } from "./fs-utils";

export const CONFIG_FILE = "sinwan-ui.json";
export const CONFIG_SCHEMA_URL =
  "https://raw.githubusercontent.com/sinwanjs/sinwan-ui-registry/main/schema.json";

export const PACKAGE_MANAGERS = ["bun", "npm", "pnpm", "yarn"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export const ALIAS_KEYS = ["components", "ui", "lib", "utils", "hooks"] as const;
export type AliasKey = (typeof ALIAS_KEYS)[number];
export type Aliases = Record<AliasKey, string>;

export interface SinwanUiConfig {
  $schema?: string;
  tsx: boolean;
  tailwind: { css: string };
  aliases: Aliases;
  /** `@namespace` → item URL (or local path) template containing `{name}`. */
  registries?: Record<string, string>;
  packageManager: PackageManager;
}

/** The Revision 1 format, recognised only to ask for a migration. */
export interface LegacyConfig {
  css: string | undefined;
  packageManager: PackageManager | undefined;
}

export type ConfigState =
  | { kind: "missing" }
  | { kind: "legacy"; legacy: LegacyConfig }
  | { kind: "current"; config: SinwanUiConfig };

export const DEFAULT_CSS_PATH = "src/styles/global.css";

export const DEFAULT_ALIASES: Aliases = {
  components: "@/components",
  ui: "@/components/ui",
  lib: "@/lib",
  utils: "@/lib/utils",
  hooks: "@/hooks",
};

export const NAMESPACE = /^@[a-z0-9][a-z0-9._-]*$/i;

/** Checked in order; the first lockfile found decides the package manager. */
const LOCKFILES: ReadonlyArray<readonly [string, PackageManager]> = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

export function isPackageManager(value: unknown): value is PackageManager {
  return typeof value === "string" && (PACKAGE_MANAGERS as readonly string[]).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function aliasProblems(value: unknown): string[] {
  if (!isRecord(value)) return ['"aliases" must be an object'];
  return ALIAS_KEYS.filter((key) => !isNonEmptyString(value[key])).map(
    (key) => `"aliases.${key}" must be a non-empty string`,
  );
}

function registriesProblems(value: unknown): string[] {
  if (value === undefined) return [];
  if (!isRecord(value)) return ['"registries" must be an object'];
  return Object.entries(value).flatMap(([namespace, template]) => {
    if (!NAMESPACE.test(namespace)) return [`registry namespace "${namespace}" must look like "@name"`];
    return typeof template === "string" && template.includes("{name}")
      ? []
      : [`"registries.${namespace}" must be a string containing {name}`];
  });
}

/** Every problem with a parsed `sinwan-ui.json`; empty when it is a valid v2 config. */
export function configProblems(value: unknown): string[] {
  if (!isRecord(value)) return ["expected a JSON object"];
  const problems: string[] = [];
  if (value.$schema !== undefined && typeof value.$schema !== "string") problems.push('"$schema" must be a string');
  if (typeof value.tsx !== "boolean") problems.push('"tsx" must be true or false');
  if (!isRecord(value.tailwind) || !isNonEmptyString(value.tailwind.css)) {
    problems.push('"tailwind.css" must be a non-empty string');
  }
  problems.push(...aliasProblems(value.aliases), ...registriesProblems(value.registries));
  if (!isPackageManager(value.packageManager)) {
    problems.push(`"packageManager" must be one of ${PACKAGE_MANAGERS.join(", ")}`);
  }
  return problems;
}

export function isSinwanUiConfig(value: unknown): value is SinwanUiConfig {
  return configProblems(value).length === 0;
}

function legacyConfig(value: unknown): LegacyConfig | null {
  if (!isRecord(value) || value.aliases !== undefined) return null;
  if (value.baseDir === undefined && value.css === undefined) return null;
  return {
    css: isNonEmptyString(value.css) ? value.css : undefined,
    packageManager: isPackageManager(value.packageManager) ? value.packageManager : undefined,
  };
}

/** Reads `sinwan-ui.json` without judging it: missing, Revision 1 (legacy) or a valid v2 config. */
export async function readConfigState(projectDir: string): Promise<ConfigState> {
  const path = join(projectDir, CONFIG_FILE);
  if (!(await pathExists(path))) return { kind: "missing" };
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new CliError(`Cannot parse ${path}: ${errorMessage(error)}`);
  }
  const legacy = legacyConfig(value);
  if (legacy) return { kind: "legacy", legacy };
  if (!isSinwanUiConfig(value)) {
    const problems = configProblems(value).map((problem) => `  - ${problem}`);
    throw new CliError(`Invalid ${CONFIG_FILE}:\n${problems.join("\n")}`);
  }
  return { kind: "current", config: value };
}

export const MIGRATE_HINT = `${CONFIG_FILE} uses the old format ("baseDir"/"css"). Run "sinwan-ui init" to migrate it.`;

/** Returns `null` when the project has no config file; throws when it is invalid or still v1. */
export async function readConfig(projectDir: string): Promise<SinwanUiConfig | null> {
  const state = await readConfigState(projectDir);
  if (state.kind === "legacy") throw new CliError(MIGRATE_HINT);
  return state.kind === "current" ? state.config : null;
}

export async function requireConfig(projectDir: string): Promise<SinwanUiConfig> {
  const config = await readConfig(projectDir);
  if (!config) {
    throw new CliError(`No ${CONFIG_FILE} found in ${projectDir}. Run "sinwan-ui init" first.`);
  }
  return config;
}

export async function writeConfig(projectDir: string, config: SinwanUiConfig): Promise<void> {
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
}

export async function detectPackageManager(projectDir: string): Promise<PackageManager> {
  for (const [lockfile, packageManager] of LOCKFILES) {
    if (await pathExists(join(projectDir, lockfile))) return packageManager;
  }
  return "bun";
}

export function createConfig(options: {
  tsx: boolean;
  css: string;
  aliases: Aliases;
  packageManager: PackageManager;
}): SinwanUiConfig {
  return {
    $schema: CONFIG_SCHEMA_URL,
    tsx: options.tsx,
    tailwind: { css: options.css },
    aliases: options.aliases,
    registries: {},
    packageManager: options.packageManager,
  };
}
