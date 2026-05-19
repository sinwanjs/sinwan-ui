import { cc, For } from "sinwan/component";
import { island } from "sinwan/component";
import { Counter } from "./Counter";

/**
 * Create an island from the Counter component
 * This marks it as a hydration boundary - the server renders it,
 * but only the client hydrates it (adds interactivity)
 */
const CounterIsland = island(Counter, { name: "Counter", tag: "div" });

interface DbInfo {
  name: string;
  sizeOnDisk: number;
  empty: boolean;
}

/**
 * Server-rendered page with interactive islands
 * The database list is static (no JS), but counters are interactive
 */
export const IslandPage = cc<{ databases: DbInfo[] }>(({ databases }) => {
  return (
    <div class="page" style="padding: 20px; font-family: system-ui;">
      <h1>SSR with Islands Architecture</h1>

      {/* Static content - never hydrated */}
      <section style="margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px;">
        <h2>Static Database List (SSR only)</h2>
        <p>This section is server-rendered and never hydrated. No JS overhead.</p>
        <ul>
          <For each={databases}>
            {(db) => (
              <li>
                {db.name} - {(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB
              </li>
            )}
          </For>
        </ul>
      </section>

      {/* Island - hydrated on client */}
      <section style="margin: 20px 0; padding: 20px; background: #e8f4f8; border-radius: 8px;">
        <h2>Interactive Islands</h2>
        <p>These counters are islands - server rendered, client hydrated.</p>
        <div style="display: flex; gap: 20px;">
          <CounterIsland initial={5} />
          <CounterIsland initial={10} />
        </div>
      </section>

      {/* Another static section */}
      <section style="margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px;">
        <h2>More Static Content</h2>
        <p>Server timestamp: {new Date().toISOString()}</p>
        <p>This was rendered on the server and will never change.</p>
      </section>
    </div>
  );
});
