import { beforeEach, describe, expect, mock, test } from "bun:test";
import { CancelledError } from "../src/errors";

const CANCEL = Symbol("clack:cancel");
const replies: unknown[] = [];
const calls: Array<{ fn: string; options: unknown }> = [];
const spinnerEvents: Array<[string, string | undefined, number | undefined]> = [];

function reply(fn: string, options: unknown): Promise<unknown> {
  calls.push({ fn, options });
  return Promise.resolve(replies.shift());
}

mock.module("@clack/prompts", () => ({
  isCancel: (value: unknown): value is symbol => value === CANCEL,
  confirm: (options: unknown) => reply("confirm", options),
  text: (options: unknown) => reply("text", options),
  select: (options: unknown) => reply("select", options),
  multiselect: (options: unknown) => reply("multiselect", options),
  spinner: () => ({
    start: (message?: string) => spinnerEvents.push(["start", message, undefined]),
    stop: (message?: string, code?: number) => spinnerEvents.push(["stop", message, code]),
    message: () => {},
  }),
}));

const { clackPrompts, clackSpinner, koloristColors } = await import("../src/clack");

const OPTIONS = [
  { value: "skip", label: "Keep" },
  { value: "overwrite", label: "Overwrite", hint: "replace" },
] as const;

beforeEach(() => {
  replies.length = 0;
  calls.length = 0;
  spinnerEvents.length = 0;
});

describe("clack adapter", () => {
  test("confirm and text forward options and return answers", async () => {
    replies.push(false, "app");
    expect(await clackPrompts.confirm("Link?", true)).toBe(false);
    expect(await clackPrompts.text("Dir?", "src")).toBe("app");
    expect(calls).toEqual([
      { fn: "confirm", options: { message: "Link?", initialValue: true } },
      { fn: "text", options: { message: "Dir?", placeholder: "src", defaultValue: "src" } },
    ]);
  });

  test("select and multiselect map answers back to the typed options", async () => {
    replies.push("overwrite", "unknown", ["overwrite", "stray", "skip"]);
    expect(await clackPrompts.select("Conflict", OPTIONS, "skip")).toBe("overwrite");
    expect(await clackPrompts.select("Conflict", OPTIONS, "skip")).toBe("skip");
    expect(await clackPrompts.multiselect("Items", OPTIONS)).toEqual(["skip", "overwrite"]);
    expect(calls[0]).toEqual({
      fn: "select",
      options: { message: "Conflict", options: [...OPTIONS], initialValue: "skip" },
    });
    expect(calls[2]).toEqual({ fn: "multiselect", options: { message: "Items", options: [...OPTIONS], required: true } });
  });

  test("cancelling any prompt throws CancelledError", async () => {
    replies.push(CANCEL, CANCEL, CANCEL, CANCEL);
    await expect(clackPrompts.confirm("a", true)).rejects.toBeInstanceOf(CancelledError);
    await expect(clackPrompts.text("b", "x")).rejects.toThrow("Cancelled.");
    await expect(clackPrompts.select("c", OPTIONS, "skip")).rejects.toBeInstanceOf(CancelledError);
    await expect(clackPrompts.multiselect("d", OPTIONS)).rejects.toBeInstanceOf(CancelledError);
  });

  test("spinner start, stop and fail", () => {
    const spinner = clackSpinner();
    spinner.start("Fetching");
    spinner.stop("Fetched");
    spinner.fail("Fetching");
    expect(spinnerEvents).toEqual([
      ["start", "Fetching", undefined],
      ["stop", "Fetched", undefined],
      ["stop", "Fetching", 2],
    ]);
  });

  test("kolorist colours keep the text", () => {
    for (const paint of Object.values(koloristColors)) {
      expect(paint("text").replace(/\u001b\[[0-9;]*m/g, "")).toBe("text");
    }
  });
});
