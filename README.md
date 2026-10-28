# sinwan-ui

The CLI of the sinwan-ui component registry. Like `shadcn`, it copies component source into your
Sinwan app instead of installing a component library. You own the copied files and can edit them
freely. Only the npm packages those files import get installed.

- Components live in [`sinwan-ui-registry`](https://github.com/sinwanjs/sinwan-ui-registry) and are served as JSON from raw GitHub, by tag.
- Headless behaviour (Presence, portals, dismiss, floating positioning, submenus, theme and direction) comes from the [`sinwan-ui-core`](https://www.npmjs.com/package/sinwan-ui-core) npm package, which `init` installs.

## Quick start

```bash
bunx sinwan-ui init                # sinwan-ui.json, @/* alias, sinwan-ui-core, utils + theme
bunx sinwan-ui add button dialog   # items plus their registry dependencies
bunx sinwan-ui add                 # pick items interactively
bunx sinwan-ui add --all           # every item
```

`init` adds the `@/*` alias when it is missing: `compilerOptions.paths` in tsconfig/jsconfig and, for Vite, the `@` entry in `resolve.alias` of `vite.config.*`. It asks before each edit in a terminal; `--yes` applies them.

## Commands

| Command | What it does |
| --- | --- |
| `init [--yes] [--defaults]` | Creates `sinwan-ui.json`, makes sure `@/*` resolves through `tsconfig.json`/`jsconfig.json` `paths`, installs `sinwan-ui-core`, writes `utils` and the theme stylesheet and links it into your entry CSS |
| `add [items...]` | Adds items by name, `@namespace/name`, URL or local `./item.json`, with their registry dependencies; `--all`, `--path <dir>`, `--overwrite`, `--dry-run` |
| `list` / `search <query>` | Lists registry items (✓ marks installed ones) / filters them by name, title and description |
| `view <items...>` | Prints item JSON, files included |
| `diff [item]` | Without an item: installed items that differ upstream. With an item: a unified diff (exit code 1 when it differs) |
| `build [registry.json] [--output <dir>]` | Builds `public/r/*.json` and `index.json` from a `registry.json` manifest, for your own registry |

Run `bunx sinwan-ui --help` for every flag, including `--cwd`, `--registry <url-or-dir>` and `--ref <tag-or-branch>`.

## `sinwan-ui.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/sinwanjs/sinwan-ui-registry/main/schema.json",
  "tsx": true,
  "tailwind": { "css": "src/styles/global.css" },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "utils": "@/lib/utils",
    "hooks": "@/hooks"
  },
  "registries": { "@acme": "https://acme.dev/r/{name}.json" },
  "packageManager": "bun"
}
```

- **`aliases`**: where items land. Imports in copied files are rewritten to these aliases, and each alias is resolved to a directory through your tsconfig/jsconfig `paths`.
- **`tsx: false`**: copies `.jsx`/`.js` instead of `.tsx`/`.ts`. `init` picks it automatically for projects that only have a `jsconfig.json`.
- **`registries`**: extra namespaced registries for `add @acme/name`.

## Development

```bash
bun run typecheck
bun run test       # 100% line and function coverage required
bun run build      # dist/cli.js: one file, runtime built-ins only
```

Build the local registry with this CLI from `sinwan-ui-registry` (`bun run registry:build`), then try it with
`bunx sinwan-ui add button --registry ../sinwan-ui-registry/public/r`.
