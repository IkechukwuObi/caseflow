import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runSearchCaseArchive, runFlagComplianceTriggers } from "../lib/tools";

const server = new McpServer({
  name: "caseflow",
  version: "0.1.0",
});

server.registerTool(
  "search_case_archive",
  {
    title: "Search case archive",
    description:
      "Search the ingested case archive (loan applications, account openings, " +
      "customer disputes) for a matching case. Returns case text, not conclusions.",
    inputSchema: {
      query: z.string().describe("What case or case detail to search for."),
    },
  },
  async ({ query }) => {
    const result = await runSearchCaseArchive(query);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "flag_compliance_triggers",
  {
    title: "Flag compliance trigger patterns",
    description:
      "Rule-based scan of case text for known compliance-relevant patterns. " +
      "Not a judgment call — flags patterns worth human review only.",
    inputSchema: {
      caseText: z.string().describe("The case text to scan."),
    },
  },
  async ({ caseText }) => {
    const result = runFlagComplianceTriggers(caseText);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CaseFlow MCP server running on stdio");
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
