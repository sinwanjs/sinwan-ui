import { hydrateIslands } from "sinwan/hydration";
import { Counter } from "./components/Counter";

/**
 * Client-side entry point for islands hydration
 * 
 * This script runs on the client after the server-rendered HTML arrives.
 * It finds all [data-sinwan-island] elements and hydrates them with
 * their corresponding components.
 */

// Registry mapping island names to their components
const islandRegistry = {
  Counter,
};

// Hydrate all islands on the page
const hydrated = hydrateIslands(islandRegistry, document, {
  onMissing: (name) => {
    console.warn(`Island "${name}" not found in registry`);
  },
  onError: (name, err) => {
    console.error(`Failed to hydrate island "${name}":`, err);
  },
});

console.log(`✅ Hydrated ${hydrated.length} island(s):`, hydrated.map(h => h.name));
