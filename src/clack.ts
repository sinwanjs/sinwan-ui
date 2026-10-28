import * as clack from "@clack/prompts";
import { bold, cyan, dim, green, red, yellow } from "kolorist";
import { CancelledError } from "./errors";
import type { CliPrompts, Colors, Spinner } from "./ui";

function unwrap<T>(value: T | symbol): T {
  if (clack.isCancel(value)) throw new CancelledError();
  return value;
}

export const clackPrompts: CliPrompts = {
  async confirm(message, initialValue) {
    return unwrap(await clack.confirm({ message, initialValue }));
  },
  async text(message, defaultValue) {
    return unwrap(await clack.text({ message, placeholder: defaultValue, defaultValue }));
  },
  async select(message, options, initialValue) {
    const picked = unwrap(await clack.select<string>({ message, options: [...options], initialValue }));
    return options.find((option) => option.value === picked)?.value ?? initialValue;
  },
  async multiselect(message, options) {
    const picked = unwrap(await clack.multiselect<string>({ message, options: [...options], required: true }));
    return options.filter((option) => picked.includes(option.value)).map((option) => option.value);
  },
};

export function clackSpinner(): Spinner {
  const spinner = clack.spinner();
  return {
    start: (message) => spinner.start(message),
    stop: (message) => spinner.stop(message),
    fail: (message) => spinner.stop(message, 2),
  };
}

/** kolorist disables itself for `NO_COLOR` and non-TTY output. */
export const koloristColors: Colors = {
  success: green,
  warn: yellow,
  error: red,
  heading: bold,
  accent: cyan,
  dim,
};
