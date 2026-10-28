import { chmod, rm } from "node:fs/promises";
import { checkCliBundle } from "./scripts/dist-check";

const ROOT = import.meta.dir;
const SRC = `${ROOT}/src`;
const DIST = `${ROOT}/dist`;

async function cleanDist(): Promise<void> {
  console.log("Cleaning dist/");
  await rm(DIST, { recursive: true, force: true });
}

async function buildCli(): Promise<void> {
  console.log("Bundling CLI -> dist/cli.js");
  const result = await Bun.build({
    entrypoints: [`${SRC}/bin.ts`],
    outdir: DIST,
    target: "bun",
    naming: "cli.js",
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("CLI Bun.build failed");
  }
  const problems = checkCliBundle(await Bun.file(`${DIST}/cli.js`).text());
  if (problems.length > 0) throw new Error(problems.join("\n"));
  await chmod(`${DIST}/cli.js`, 0o755);
}

async function main(): Promise<void> {
  await cleanDist();
  await buildCli();
  console.log("Build complete -> dist/");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
