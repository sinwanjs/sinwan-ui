import { serve } from "bun";
import mongoose from "mongoose";
import { renderToHydratableString } from "sinwan/server";
import { App } from "./App.tsx";

// Connect MongoDB
await mongoose.connect("mongodb://127.0.0.1:27017", {
  user: "admin",
  pass: "secret123",
});
console.log("✅ Connected to MongoDB");

// HTML shell
const shell = (content: string, initialPath: string, data: any) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sinwan SPA</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      nav span:hover { opacity: 0.7; }
    </style>
  </head>
  <body>
    <div id="app">${content}</div>
    <script>window.__INITIAL_PATH__ = "${initialPath}"; window.__INITIAL_DATA__ = ${JSON.stringify(data)};</script>
    <script type="module" src="/spa/client.tsx"></script>
  </body>
</html>
`;

async function renderRoute(path: string) {
  let data = {};
  if (path === "/") {
    try {
      const admin = mongoose.connection.db!.admin();
      const result = await admin.listDatabases();
      data = {
        databases: result.databases.map((db) => ({
          name: db.name,
          sizeOnDisk: db.sizeOnDisk ?? 0,
          empty: db.empty ?? false,
        })),
      };
    } catch (e) {
      console.error("Data load error:", e);
    }
  }
  const html = await renderToHydratableString(App, { initialPath: path });
  return { html, data };
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // API routes
  if (path === "/api/dbs") {
    const admin = mongoose.connection.db!.admin();
    const result = await admin.listDatabases();
    return Response.json({
      success: true,
      databases: result.databases.map((db) => ({
        name: db.name,
        sizeOnDisk: db.sizeOnDisk ?? 0,
        empty: db.empty ?? false,
      })),
    });
  }

  // Client bundle
  if (path === "/spa/client.tsx") {
    const result = await Bun.build({
      entrypoints: ["./src/spa/client.tsx"],
      target: "browser",
      format: "esm",
    });
    if (!result.success || !result.outputs[0]) {
      return new Response("Build failed", { status: 500 });
    }
    return new Response(await result.outputs[0].text(), {
      headers: { "Content-Type": "application/javascript" },
    });
  }

  // Skip static file requests (favicon, etc.)
  if (path.includes(".") && !path.endsWith(".tsx")) {
    return new Response("Not found", { status: 404 });
  }

  // SSR catch-all
  const { html, data } = await renderRoute(path);
  return new Response(shell(html, path, data), {
    headers: { "Content-Type": "text/html" },
  });
}

const server = serve({
  port: 3004,
  fetch: handleRequest,
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 SPA Server running at ${server.url}`);
console.log(`   Routes: /, /about, /counter`);
