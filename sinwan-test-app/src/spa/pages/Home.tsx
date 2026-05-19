import { cc, For } from "sinwan/component";
import { signal } from "sinwan/reactivity";
import { Link } from "../Router.tsx";

interface Database {
  name: string;
  sizeOnDisk: number;
}

// Get initial data from SSR if available
const getInitialData = (): { databases: Database[] } => {
  if (typeof window !== "undefined" && (window as any).__INITIAL_DATA__) {
    return (window as any).__INITIAL_DATA__;
  }
  return { databases: [] };
};

export const Home = cc(() => {
  const data = signal<{ databases: Database[] }>(getInitialData());

  return (
    <div style="padding: 20px;">
      <h1>SPA with Full Hydration</h1>
      <p>Server-rendered, fully hydrated single page app</p>

      <nav style="margin: 20px 0; display: flex; gap: 20px;">
        <Link href="/">
          <span style="color: blue; text-decoration: underline; cursor: pointer;">
            Home
          </span>
        </Link>
        <Link href="/about">
          <span style="color: blue; text-decoration: underline; cursor: pointer;">
            About
          </span>
        </Link>
        <Link href="/counter">
          <span style="color: blue; text-decoration: underline; cursor: pointer;">
            Counter
          </span>
        </Link>
      </nav>

      <h2>Databases from Server</h2>
      <ul>
        <For each={() => data.value.databases}>
          {(db) => (
            <li>
              {db.name} - {(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB
            </li>
          )}
        </For>
      </ul>
    </div>
  );
});

export async function homeLoader() {
  const res = await fetch("/api/dbs");
  const data = await res.json();
  return { databases: data.databases || [] };
}
