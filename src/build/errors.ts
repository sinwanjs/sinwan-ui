import { CliError } from "../errors";

/** Every problem found while reading or building a registry, reported together. */
export class RegistryBuildError extends CliError {
  readonly problems: readonly string[];

  constructor(subject: string, problems: readonly string[]) {
    super(
      `${subject} has ${problems.length} problem(s):\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
    );
    this.name = "RegistryBuildError";
    this.problems = problems;
  }
}

export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
