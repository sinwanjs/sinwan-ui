/** An expected, user-facing failure: printed without a stack trace, exit code 1. */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

/** The user cancelled an interactive prompt. */
export class CancelledError extends CliError {
  constructor() {
    super("Cancelled.");
    this.name = "CancelledError";
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
