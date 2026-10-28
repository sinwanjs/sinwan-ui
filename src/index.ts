import { resolve } from "node:path";
import { parseCliArgs } from "./args";
import { clackPrompts, clackSpinner, koloristColors } from "./clack";
import { addCommand } from "./commands/add";
import { buildCommand } from "./commands/build";
import type { CliDeps, CommandHandler } from "./commands/context";
import { diffCommand } from "./commands/diff";
import { initCommand } from "./commands/init";
import { listCommand } from "./commands/list";
import { searchCommand } from "./commands/search";
import { viewCommand } from "./commands/view";
import { CancelledError, CliError, errorMessage } from "./errors";
import { runInstallCommand } from "./install";
import type { CliIo } from "./io";
import { createRegistrySource } from "./registry-source";
import { closeMatches } from "./suggest";
import type { Colors } from "./ui";
import { CLI_VERSION, DEFAULT_REGISTRY_REF, defaultRegistryUrl } from "./version";

export type { CliDeps } from "./commands/context";
export type { CliIo } from "./io";
export type { CliPrompts, Colors, PromptOption, Spinner, SpinnerFactory } from "./ui";

const COMMANDS = new Map<string, CommandHandler>([
  ["init", initCommand],
  ["add", addCommand],
  ["list", listCommand],
  ["search", searchCommand],
  ["view", viewCommand],
  ["diff", diffCommand],
  ["build", buildCommand],
]);

export function helpText(colors: Colors): string {
  return `${colors.accent(`sinwan-ui ${CLI_VERSION}`)} — copy sinwan-ui components into your project

${colors.heading("Usage:")}
  sinwan-ui init                 Create sinwan-ui.json, check the @/* path alias, install
                                 sinwan-ui-core and add the "utils" and "style" items
  sinwan-ui add [items...]       Add items and their registry dependencies, then install npm packages;
                                 items are names, @namespace/name, item URLs or ./local/item.json;
                                 without items, pick interactively
  sinwan-ui list                 List registry items; ✓ marks installed ones
  sinwan-ui search <query>       Find registry items by name, title or description
  sinwan-ui view <items...>      Print item JSON (files included)
  sinwan-ui diff [item]          Without an item: list installed items that differ from the registry;
                                 with an item: show a unified diff (exit code 1 when they differ)
  sinwan-ui build [registry.json] Build registry JSON from a registry.json manifest
  sinwan-ui help                 Show this help

${colors.heading("Options:")}
  --cwd <dir>                    Project directory (default: current directory)
  -y, --yes                      Skip prompts; keep local files that differ unless --overwrite is set
  -d, --defaults                 init: use the default config without prompting
  --overwrite                    Overwrite local files (and CSS variables) that differ from the registry
  -a, --all                      add: add every item of the registry
  -p, --path <dir>               add: install registry:ui files into this directory
  --output <dir>                 build: output directory (default: public/r)
  --registry <url-or-dir>        Registry base URL or local directory
                                 (default: ${defaultRegistryUrl("<ref>")})
  --ref <tag-or-branch>          Git ref of the default registry (default: ${DEFAULT_REGISTRY_REF})
  --dry-run                      Print planned writes and the install command; change nothing
  -h, --help                     Show this help
  -v, --version                  Print the version

Prompts and spinners need a terminal; without one the CLI behaves as with --yes.
`;
}

function unknownCommandMessage(command: string): string {
  const matches = closeMatches(command, [...COMMANDS.keys()]);
  const hint = matches.length > 0 ? ` Did you mean: ${matches.join(", ")}?` : "";
  return `Unknown command "${command}".${hint} Run "sinwan-ui --help" for usage.`;
}

/** CLI entry point. Returns the process exit code; never calls `process.exit`. */
export async function run(
  argv: readonly string[],
  io: CliIo,
  deps: Partial<CliDeps> = {},
): Promise<number> {
  const colors = deps.colors ?? koloristColors;
  try {
    const { command, positionals, options } = parseCliArgs(argv);
    if (options.version) {
      io.stdout(`${CLI_VERSION}\n`);
      return 0;
    }
    if (options.help || command === undefined || command === "help") {
      io.stdout(helpText(colors));
      return 0;
    }
    const handler = COMMANDS.get(command);
    if (!handler) throw new CliError(unknownCommandMessage(command));

    const resolved: CliDeps = {
      fetch: deps.fetch ?? fetch,
      install: deps.install ?? runInstallCommand,
      cwd: deps.cwd ?? process.cwd(),
      prompts: deps.prompts ?? clackPrompts,
      spinner: deps.spinner ?? clackSpinner,
      colors,
      isTTY: deps.isTTY ?? (process.stdin.isTTY === true && process.stdout.isTTY === true),
    };
    return await handler({
      io,
      options,
      args: positionals,
      deps: resolved,
      interactive: resolved.isTTY && !options.yes,
      projectDir: resolve(resolved.cwd, options.cwd ?? "."),
      source: createRegistrySource({
        registry: options.registry,
        ref: options.ref,
        cwd: resolved.cwd,
        fetch: resolved.fetch,
      }),
    });
  } catch (error) {
    if (error instanceof CancelledError) {
      io.stderr(`${colors.warn(error.message)}\n`);
      return 1;
    }
    const prefix = error instanceof CliError ? "" : "unexpected error: ";
    io.stderr(`${colors.error("sinwan-ui:")} ${prefix}${errorMessage(error)}\n`);
    return 1;
  }
}
