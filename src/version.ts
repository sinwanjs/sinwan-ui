import packageJson from "../package.json" with { type: "json" };

export const CLI_VERSION: string = packageJson.version;

export const DEFAULT_REGISTRY_REF = `v${CLI_VERSION}`;

export function defaultRegistryUrl(ref: string): string {
  return `https://raw.githubusercontent.com/sinwanjs/sinwan-ui-registry/${ref}/public/r`;
}
