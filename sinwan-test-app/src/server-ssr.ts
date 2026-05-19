import { serve } from "bun";
import mongoose from "mongoose";
import { renderToString, renderToHydratableString } from "sinwan/server";
import { streamHydratablePage } from "sinwan/server";
import { IslandPage } from "./components/IslandPage";

// =========================
// CONNECT MONGODB
// =========================

await mongoose.connect("mongodb://127.0.0.1:27017", {
  user: "admin",
  pass: "secret123",
});
console.log("✅ Connected to MongoDB");

// =========================
// HTML SHELL
// =========================

const shell = (content: string, islandRegistryScript: string = "") => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sinwan SSR + Islands</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      .counter { padding: 16px; border: 2px solid #3498db; border-radius: 8px; }
      button { cursor: pointer; background: #3498db; color: white; border: none; border-radius: 4px; }
      button:hover { background: #2980b9; }
    </style>
  </head>
  <body>
    <div id="app">${content}</div>
    ${islandRegistryScript}
    <script type="module" src="./hydrate-islands.tsx"></script>
  </body>
</html>
`;

// =========================
// SERVER
// =========================

const server = serve({
  port: 3002,
  routes: {
    // =========================
    // GET / - Static SSR (no hydration)
    // =========================
    "/static": async () => {
      const admin = mongoose.connection.db!.admin();
      const result = await admin.listDatabases();
      const databases = result.databases.map((db) => ({
        name: db.name,
        sizeOnDisk: db.sizeOnDisk,
        empty: db.empty,
      }));

      // Render without hydration markers - completely static
      const html = await renderToString(
        IslandPage({ databases: databases as any }),
      );

      return new Response(shell(html), {
        headers: { "Content-Type": "text/html" },
      });
    },

    // =========================
    // GET /islands - SSR with hydration markers for islands
    // =========================
    "/": async () => {
      const admin = mongoose.connection.db!.admin();
      const result = await admin.listDatabases();
      const databases = result.databases.map((db) => ({
        name: db.name,
        sizeOnDisk: db.sizeOnDisk,
        empty: db.empty,
      }));

      // Render with hydration markers - islands can be hydrated
      const html = await renderToHydratableString(IslandPage, {
        databases: databases as any,
      });

      return new Response(shell(html), {
        headers: { "Content-Type": "text/html" },
      });
    },

    // =========================
    // GET /stream - Streaming SSR
    // =========================
    "/stream": async () => {
      const admin = mongoose.connection.db!.admin();
      const result = await admin.listDatabases();
      const databases = result.databases.map((db) => ({
        name: db.name,
        sizeOnDisk: db.sizeOnDisk,
        empty: db.empty,
      }));

      // For streaming, we need to wrap in shell but streaming complicates this
      // For now, use non-streaming hydratable render to ensure islands work
      const html = await renderToHydratableString(IslandPage, {
        databases: databases as any,
      });

      return new Response(shell(html), {
        headers: { "Content-Type": "text/html" },
      });
    },

    // =========================
    // SERVE CLIENT FILES (TRANSPILED TO JS)
    // =========================
    "/hydrate-islands.tsx": async () => {
      const result = await Bun.build({
        entrypoints: ["./src/hydrate-islands.tsx"],
        target: "browser",
        format: "esm",
      });
      if (!result.success) {
        return new Response("Build failed", { status: 500 });
      }
      const output = result.outputs[0];
      if (!output) return new Response("No output", { status: 500 });
      return new Response(await output.text(), {
        headers: { "Content-Type": "application/javascript" },
      });
    },

    "/components/Counter.tsx": async () => {
      const result = await Bun.build({
        entrypoints: ["./src/components/Counter.tsx"],
        target: "browser",
        format: "esm",
      });
      if (!result.success) {
        return new Response("Build failed", { status: 500 });
      }
      const output = result.outputs[0];
      if (!output) return new Response("No output", { status: 500 });
      return new Response(await output.text(), {
        headers: { "Content-Type": "application/javascript" },
      });
    },

    // =========================
    // API - Database info
    // =========================
    "/api/dbs": async () => {
      const admin = mongoose.connection.db!.admin();
      const result = await admin.listDatabases();
      return Response.json({
        success: true,
        databases: result.databases.map((db) => ({
          name: db.name,
          sizeOnDisk: db.sizeOnDisk,
          empty: db.empty,
        })),
      });
    },
  },

  development: {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 SSR Server running at ${server.url}`);
console.log(`   - Static:    ${server.url}static`);
console.log(`   - Islands:   ${server.url}`);
console.log(`   - Streaming: ${server.url}stream`);
