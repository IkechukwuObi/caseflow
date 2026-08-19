import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runSearchRegulatoryGuidance } from "../lib/tools";

/**
 * Standalone MCP server exposing the exact same retrieval tool used by the
 * web app's /api/chat route (see lib/tools.ts — single source of truth).
 * This lets Claude Desktop or Claude Code connect directly to the corpus
 * without going through the web UI, which is the actual point of building
 * this as an MCP server rather than just a function call inside the app.
 *
 * Run with: npm run mcp
 * Then point Claude Desktop / Claude Code's MCP config at this stdio command.
 */

const server = new McpServer({
  name: "reglens",
  version: "0.1.0",
});

server.registerTool(
  "search_regulatory_guidance",
  {
    title: "Search SA financial regulatory guidance",
    description:
      "Search the ingested corpus of South African financial regulation " +
      "(FICA, SARB Prudential Authority guidance, POPIA) for passages " +
      "relevant to a compliance question. Returns cited passages, not answers.",
    inputSchema: {
      query: z.string().describe("The compliance or regulatory question to search for."),
    },
  },
  async ({ query }) => {
    const result = await runSearchRegulatoryGuidance(query);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RegLens MCP server running on stdio");
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
