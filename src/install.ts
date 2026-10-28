import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PackageManager } from "./config";
import { CliError, errorMessage } from "./errors";
import { isRecord, pathExists } from "./fs-utils";

export interface InstallResult {
  exitCode: number;
  /** Captured stdout and stderr when run quietly; empty otherwise. */
  output: string;
}

/** Runs `command` in `cwd`. `quiet` captures its output (behind a spinner) instead of inheriting stdio. */
export type InstallRunner = (command: readonly string[], cwd: string, quiet: boolean) => Promise<InstallResult>;

const ADD_COMMANDS: Record<PackageManager, readonly string[]> = {
  bun: ["bun", "add"],
  npm: ["npm", "install"],
  pnpm: ["pnpm", "add"],
  yarn: ["yarn", "add"],
};

export function installCommand(packageManager: PackageManager, packages: readonly string[], dev = false): string[] {
  return [...ADD_COMMANDS[packageManager], ...(dev ? ["-D"] : []), ...packages];
}

/** `echarts@^6.1.0` → `echarts`, `@floating-ui/dom@^1.8.0` → `@floating-ui/dom`. */
export function packageName(specifier: string): string {
  const versionAt = specifier.indexOf("@", specifier.startsWith("@") ? 1 : 0);
  return versionAt > 0 ? specifier.slice(0, versionAt) : specifier;
}

/** Names declared in the project's `dependencies` and `devDependencies`, or `null` without a `package.json`. */
export async function readProjectDependencies(projectDir: string): Promise<Set<string> | null> {
  const path = join(projectDir, "package.json");
  if (!(await pathExists(path))) return null;
  let manifest: unknown;
  try {
    manifest = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new CliError(`Cannot parse ${path}: ${errorMessage(error)}`);
  }
  const names = new Set<string>();
  if (!isRecord(manifest)) return names;
  for (const field of [manifest.dependencies, manifest.devDependencies]) {
    if (isRecord(field)) for (const name of Object.keys(field)) names.add(name);
  }
  return names;
}

/** Specifiers whose package is neither installed nor in `exclude`, deduplicated by package name in first-seen order. */
export function missingDependencies(
  specifiers: readonly string[],
  installed: ReadonlySet<string> | null,
  exclude: readonly string[] = [],
): string[] {
  const seen = new Set<string>(exclude.map(packageName));
  const missing: string[] = [];
  for (const specifier of specifiers) {
    const name = packageName(specifier);
    if (seen.has(name) || installed?.has(name)) continue;
    seen.add(name);
    missing.push(specifier);
  }
  return missing;
}

export const runInstallCommand: InstallRunner = async (command, cwd, quiet) => {
  if (!quiet) {
    const child = Bun.spawn([...command], { cwd, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    return { exitCode: await child.exited, output: "" };
  }
  const child = Bun.spawn([...command], { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, output: `${stdout}${stderr}` };
};
