import { readFile } from "fs/promises";
import { resolve } from "path";
import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const doc = url.searchParams.get("doc") || "00-philosophy.md";

  console.log("[ssr] Rendering doc:", doc);

  // Validate doc parameter
  if (
    !doc.match(/^[0-9a-zA-Z-]+\.md$/) &&
    doc !== "README.md" &&
    doc !== "CHANGELOG.md"
  ) {
    return new Response("Invalid document requested", { status: 400 });
  }

  try {
    // Try multiple path strategies
    const possiblePaths = [
      resolve(__dirname, "..", "..", "..", "docs", "v1", doc),
      process.env.LAMBDA_TASK_ROOT
        ? resolve(process.env.LAMBDA_TASK_ROOT, "..", "..", "docs", "v1", doc)
        : null,
      resolve(process.cwd(), "..", "..", "docs", "v1", doc),
    ].filter((p): p is string => p !== null);

    let content: string | null = null;

    for (const docPath of possiblePaths) {
      try {
        console.log("[ssr] Trying:", docPath);
        content = await readFile(docPath, "utf-8");
        break;
      } catch {
        continue;
      }
    }

    if (!content) {
      console.error("[ssr] Not found:", doc);
      return new Response("Document not found", { status: 404 });
    }

    // Extract title from markdown
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const docTitle = titleMatch ? titleMatch[1] : doc;

    // Escape content for HTML attribute
    const escapedContent = content
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Return SSR HTML with hydration data
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${docTitle} - Sinwan Documentation</title>
    <meta name="description" content="${docTitle} - Sinwan reactive UI library documentation" />
    <meta property="og:title" content="${docTitle} - Sinwan" />
    <meta property="og:type" content="website" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <script type="module" crossorigin src="/assets/index-BHBhxa4d.js"><\\/script>
    <link rel="stylesheet" crossorigin href="/assets/index-Bl-z6hkM.css">
  </head>
  <body>
    <div id="app" data-initial-page="${doc}" data-initial-content="${escapedContent}"></div>
  </body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[ssr] Error:", error);
    return new Response("Server error", { status: 500 });
  }
};

