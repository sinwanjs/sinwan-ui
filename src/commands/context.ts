import type { CliOptions } from "../args";
import { CliError } from "../errors";
import type { InstallRunner } from "../install";
import type { CliIo } from "../io";
import type { FetchLike, RegistrySource } from "../registry-source";
import type { CliPrompts, Colors, SpinnerFactory } from "../ui";

/** Side effects the CLI performs; injectable so tests never touch the network, a terminal or a package manager. */
export interface CliDeps {
  fetch: FetchLike;
  install: InstallRunner;
  /** Directory `--cwd` and local `--registry` paths are resolved against. */
  cwd: string;
  prompts: CliPrompts;
  spinner: SpinnerFactory;
  colors: Colors;
  /** Whether stdin and stdout are terminals; prompts and spinners need one. */
  isTTY: boolean;
}

export interface CommandContext {
  io: CliIo;
  options: CliOptions;
  /** Arguments after the command name. */
  args: string[];
  deps: CliDeps;
  /** Prompts are allowed: a TTY and no `--yes`. */
  interactive: boolean;
  /** Absolute project directory (`--cwd`). */
  projectDir: string;
  source: RegistrySource;
}

export type CommandHandler = (context: CommandContext) => Promise<number>;

export function expectNoArgs(context: CommandContext, command: string): void {
  if (context.args.length > 0) {
    throw new CliError(`"sinwan-ui ${command}" takes no arguments (got: ${context.args.join(" ")}).`);
  }
}
