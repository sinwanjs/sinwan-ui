export interface PromptOption<Value extends string> {
  value: Value;
  label: string;
  hint?: string;
}

/** Interactive questions. Implementations throw `CancelledError` when the user cancels. */
export interface CliPrompts {
  confirm(message: string, initialValue: boolean): Promise<boolean>;
  /** Resolves with `defaultValue` when the answer is empty. */
  text(message: string, defaultValue: string): Promise<string>;
  select<Value extends string>(
    message: string,
    options: readonly PromptOption<Value>[],
    initialValue: Value,
  ): Promise<Value>;
  /** Requires at least one selection. */
  multiselect<Value extends string>(message: string, options: readonly PromptOption<Value>[]): Promise<Value[]>;
}

export interface Spinner {
  start(message: string): void;
  stop(message: string): void;
  fail(message: string): void;
}

export type SpinnerFactory = () => Spinner;

export type Paint = (text: string) => string;

export interface Colors {
  success: Paint;
  warn: Paint;
  error: Paint;
  heading: Paint;
  accent: Paint;
  dim: Paint;
}
