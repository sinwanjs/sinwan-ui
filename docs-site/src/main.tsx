import { hydrate, mount } from "sinwan";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app element not found");

// Check if we should hydrate (SSR) or mount (client-side)
const initialPage = root.getAttribute("data-initial-page");
const initialContent = root.getAttribute("data-initial-content");

if (initialPage && initialContent) {
  // Hydrate after SSR
  hydrate(App, root, { initialPage, initialContent });
} else {
  // Client-side render
  mount(App, root);
}
