# sinwan-ui

Sinwan-native UI components (shadcn-inspired) with light / dark / system theming.

## Install

```bash
bun add sinwan-ui sinwan
```

Peer dependency: `sinwan` `>=1.3 <2`.

## Setup

1. Import styles in your app entry:

```ts
import "sinwan-ui/styles.css";
```

2. Wrap the app with `ThemeProvider`:

```tsx
import { ThemeProvider, Button, ThemeToggle } from "sinwan-ui";
import { mount } from "sinwan/renderer";

const App = () => (
  <ThemeProvider defaultTheme="system">
    <Button variant="gradient">Hello</Button>
    <ThemeToggle />
  </ThemeProvider>
);

mount(App, document.getElementById("app")!);
```

3. Build / serve with **`bun-plugin-sinwan`** so the Sinwan compiler runs (JSX, reactivity hoisting):

```ts
import { sinwan } from "bun-plugin-sinwan";

await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: "./dist",
  plugins: [sinwan()],
  external: ["sinwan", "sinwan-ui"],
});
```

## Theming

- CSS variables in `sinwan-ui/styles.css` (`.dark` / `.light` on `<html>`)
- `ThemeProvider` + `useTheme()` — `theme`, `resolved`, `setTheme("light" | "dark" | "system")`
- `DirectionProvider` / `useDirection()` for RTL/LTR

## Notes

- Use `class` (not `className`) and DOM event names (`onclick`, …)
- Icons: Lucide icon nodes via `<Icon icon={Loader2} />` from `sinwan-ui`
- Toasts: `toast.success("Saved")` + `<Toaster />`
- No React / Radix — all primitives are Sinwan-native

## Scripts

```bash
bun run typecheck
bun run test
bun run build
```
