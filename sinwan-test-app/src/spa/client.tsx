import { hydrate } from "sinwan/hydration";
import { App } from "./App.tsx";

/**
 * Hybrid SSR strategy:
 * 1. Try hydrate() first - preserves server HTML, no flash
 * 2. If routing doesn't work (reactive control flow issue),
 *    fallback to mount() on next navigation
 *
 * For now, we use mount() because Sinwan's hydration of Key/Show
 * doesn't create reactive effects (see src/hydration/walk.ts:473)
 */

/**
 * Use hydrate() with reactive control flow support
 * (Sinwan's walk.ts now creates effects for Key/Show/Dynamic)
 */

const initialPath =
  (window as any).__INITIAL_PATH__ || window.location.pathname;

const container = document.getElementById("app")!;

const app = hydrate(App, container, { initialPath });

console.log("✅ App hydrated at path:", initialPath);
