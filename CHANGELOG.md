# Changelog

All notable changes to **sinwan-ui** are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/) and sinwan-ui adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0]

`sinwan-ui` is now only the CLI of the sinwan-ui component registry, like the `shadcn` package. Components are no longer installed from npm: they are copied into your app from [`sinwan-ui-registry`](https://github.com/sinwanjs/sinwan-ui-registry), and their headless behaviour comes from the new [`sinwan-ui-core`](https://www.npmjs.com/package/sinwan-ui-core) package.

### Added

- **`sinwan-ui` CLI** (`bunx sinwan-ui`), with no runtime dependencies (`dist/cli.js`, runtime built-ins only):
  - `init`: creates `sinwan-ui.json`, makes sure the `@/*` alias resolves through tsconfig/jsconfig `paths` (and adds the `@` entry to `resolve.alias` in `vite.config.*`, asking first in a terminal, or prints the snippet when the config cannot be edited safely), installs `sinwan-ui-core`, writes `utils` and the theme and links the theme into your entry stylesheet.
  - `add [items...]`: names, `@namespace/name`, URLs or local JSON files, with registry dependencies; `--all`, `--path`, `--overwrite`, `--dry-run`, and an interactive picker without items. Imports are rewritten to your configured aliases, and only the npm packages the copied files import are installed.
  - `list`, `search <query>`, `view <items...>`, and `diff [item]` (installed items that differ upstream, or a unified diff for one item).
  - `build [registry.json]`: builds `public/r/*.json` and `index.json` for your own registry, detecting npm and registry dependencies from imports.
- **JavaScript projects**: with `"tsx": false` (picked automatically for projects with only a `jsconfig.json`), copied files become `.jsx`/`.js` with the JSX and Sinwan compiler comments kept. A conversion is written only if it compiles to the same code as the TypeScript source (adjacent text children stay separate nodes).
- **Namespaced registries** through `registries` in `sinwan-ui.json`.

### Removed

- **Every component, primitive and helper export** (`sinwan-ui`, `sinwan-ui/<component>`, `sinwan-ui/styles.css`, …) and the runtime dependencies. Migrate:
  - Run `bunx sinwan-ui init`, then `bunx sinwan-ui add <items...>` for the components you use, and import them from your alias (e.g. `import { Button } from "@/components/ui/button"`).
  - Primitives (`Presence`, `UiPortal`, overlays, floating, dismiss, menu-sub, `Slot`, `ThemeProvider`, `DirectionProvider`) now come from `sinwan-ui-core/<module>`.
  - Toasts are the `sonner` item; the stylesheet is the `style` item that `init` adds.
