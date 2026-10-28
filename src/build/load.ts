import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CliError, errorMessage } from "../errors";
import type { RegistryBuildInput, RegistryFiles } from "./build";
import { parsePackageInfo, parseRegistryManifest } from "./manifest";

/** Files under `root`, addressed by `/`-separated relative paths. */
export function directoryFiles(root: string): RegistryFiles {
  return {
    async read(path) {
      try {
        return await readFile(join(root, path), "utf8");
      } catch {
        return undefined;
      }
    },
    async exists(path) {
      try {
        return (await stat(join(root, path))).isFile();
      } catch {
        return false;
      }
    },
  };
}

async function readJson(path: string, missing: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    throw new CliError(missing);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CliError(`${path} is not valid JSON: ${errorMessage(error)}`);
  }
}

/** Reads `registry.json` and the `package.json` beside it; `label` names the manifest in errors. */
export async function loadRegistryInput(manifestPath: string, label: string): Promise<RegistryBuildInput> {
  const root = dirname(manifestPath);
  const packagePath = join(root, "package.json");
  const manifest = parseRegistryManifest(
    await readJson(manifestPath, `Registry manifest not found: ${manifestPath}`),
    label,
  );
  const packageInfo = parsePackageInfo(
    await readJson(packagePath, `No package.json next to ${label}; its "version" is the registry version.`),
    packagePath,
  );
  return { manifest, packageInfo, files: directoryFiles(root), source: label };
}
