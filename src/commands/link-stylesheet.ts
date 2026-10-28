import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { ENTRY_STYLESHEETS, findEntryStylesheet, importSpecifier } from "../stylesheet-link";
import type { CommandContext } from "./context";

/**
 * Makes the app load the theme: the theme already imports Tailwind, so it
 * replaces `@import "tailwindcss"` in the project's entry stylesheet.
 */
export async function linkThemeStylesheet(context: CommandContext, themePath: string): Promise<void> {
  const { io, options, projectDir } = context;
  const { colors } = context.deps;
  const theme = relative(projectDir, themePath);
  const entry = await findEntryStylesheet(projectDir, themePath);

  if (entry?.status === "linked") {
    io.stdout(colors.dim(`${relative(projectDir, entry.path)} already imports ${theme}.`) + "\n");
    return;
  }
  if (entry) {
    const change = `@import "tailwindcss" in ${relative(projectDir, entry.path)} with @import "${entry.specifier}";`;
    if (options.dryRun) {
      io.stdout(`Would replace ${change}\n`);
      return;
    }
    if (!context.interactive || (await context.deps.prompts.confirm(`Replace ${change}?`, true))) {
      await writeFile(entry.path, entry.content);
      io.stdout(`${colors.success("Replaced")} ${change} (the theme loads Tailwind).\n`);
      return;
    }
  }

  const [reference] = ENTRY_STYLESHEETS;
  const specifier = importSpecifier(join(projectDir, reference), themePath);
  io.stdout(
    `${colors.warn("Next:")} in your main stylesheet, replace @import "tailwindcss"; with @import "${specifier}"; ` +
      `(path relative to ${reference}). ${theme} already loads Tailwind.\n`,
  );
}
