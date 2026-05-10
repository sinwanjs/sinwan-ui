import { readFile } from "fs/promises";
import { join } from "path";
import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const doc = url.searchParams.get("doc") || "00-philosophy.md";

  // Validate doc parameter to prevent directory traversal
  if (
    !doc.match(/^[0-9a-zA-Z-]+\.md$/) &&
    doc !== "README.md" &&
    doc !== "CHANGELOG.md"
  ) {
    return new Response(
      JSON.stringify({ error: "Invalid document requested" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    // Build path relative to the repository root
    // From: docs-site/netlify/functions/render.ts
    // To: docs/v1/*.md
    const docPath = join(__dirname, "..", "..", "..", "docs", "v1", doc);
    const content = await readFile(docPath, "utf-8");

    return new Response(
      JSON.stringify({
        success: true,
        doc,
        content,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        },
      },
    );
  } catch (error) {
    console.error("Error loading doc:", error);
    return new Response(JSON.stringify({ error: "Document not found", doc }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
};
