import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runSearchCaseArchive, runFlagComplianceTriggers, type ToolContext } from "../lib/tools";

const server = new McpServer({
  name: "caseflow",
  version: "0.1.0",
});

// Stdio MCP transport spins up one process per client connection (Claude
// Desktop or Claude Code), so one requestId per process is the right scope —
// it groups every tool call in this session in the audit trail without
// merging unrelated sessions. See lib/tools.ts / lib/audit.ts for why this
// matters: it's what lets a case be reconstructed after the fact.
const requestId = randomUUID();
const ctx: ToolContext = { requestId };
let lastCase: { reference?: string; title?: string } = {};

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
    const result = await runSearchCaseArchive(query, ctx);
    if (result.found && result.cases) {
      lastCase = { reference: result.cases[0]?.reference, title: result.cases[0]?.title };
    }
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
    const result = await runFlagComplianceTriggers(caseText, ctx, {
      caseReference: lastCase.reference,
      caseTitle: lastCase.title,
    });
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
