import { parseArgs } from "node:util";
import { CliError, errorMessage } from "./errors";

export interface CliOptions {
  cwd: string | undefined;
  yes: boolean;
  defaults: boolean;
  overwrite: boolean;
  all: boolean;
  path: string | undefined;
  output: string | undefined;
  registry: string | undefined;
  ref: string | undefined;
  dryRun: boolean;
  help: boolean;
  version: boolean;
}

export interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  options: CliOptions;
}

export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        cwd: { type: "string" },
        yes: { type: "boolean", short: "y", default: false },
        defaults: { type: "boolean", short: "d", default: false },
        overwrite: { type: "boolean", default: false },
        all: { type: "boolean", short: "a", default: false },
        path: { type: "string", short: "p" },
        output: { type: "string" },
        registry: { type: "string" },
        ref: { type: "string" },
        "dry-run": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
    });
  } catch (error) {
    throw new CliError(`${errorMessage(error)}\nRun "sinwan-ui --help" for usage.`);
  }
  const [command, ...positionals] = parsed.positionals;
  const { values } = parsed;
  return {
    command,
    positionals,
    options: {
      cwd: values.cwd,
      yes: values.yes,
      defaults: values.defaults,
      overwrite: values.overwrite,
      all: values.all,
      path: values.path,
      output: values.output,
      registry: values.registry,
      ref: values.ref,
      dryRun: values["dry-run"],
      help: values.help,
      version: values.version,
    },
  };
}
