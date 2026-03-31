#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseArgs } from "./config.js";
import { createApiClient } from "./api-client.js";
import { registerTicketReadTools, registerTicketWriteTools } from "./tools/tickets.js";
import { registerConversationReadTools, registerConversationWriteTools } from "./tools/conversations.js";
import { registerContactReadTools, registerContactWriteTools } from "./tools/contacts.js";
import { registerCompanyReadTools, registerCompanyWriteTools } from "./tools/companies.js";
import { registerAgentGroupReadTools } from "./tools/agents.js";

async function main(): Promise<void> {
  const config = parseArgs(process.argv);
  const client = createApiClient(config);

  const server = new McpServer({
    name: "freshdesk-mcp-server",
    version: "1.0.0",
  });

  // --- Always registered: core ticketing read tools ---
  registerTicketReadTools(server, client);
  registerConversationReadTools(server, client);
  registerAgentGroupReadTools(server, client);

  // --- Conditionally registered: optional domain read tools ---
  if (config.enabledDomains.has("contacts")) {
    registerContactReadTools(server, client);
  }
  if (config.enabledDomains.has("companies")) {
    registerCompanyReadTools(server, client);
  }

  // --- Write tools (only if --enable-writes) ---
  if (config.enableWrites) {
    registerTicketWriteTools(server, client);
    registerConversationWriteTools(server, client);

    if (config.enabledDomains.has("contacts")) {
      registerContactWriteTools(server, client);
    }
    if (config.enabledDomains.has("companies")) {
      registerCompanyWriteTools(server, client);
    }
  }

  // --- Log enabled features to stderr (stdio servers must not log to stdout) ---
  const domains = ["tickets (default)"];
  if (config.enabledDomains.has("contacts")) domains.push("contacts");
  if (config.enabledDomains.has("companies")) domains.push("companies");

  console.error(`freshdesk-mcp-server v1.0.0`);
  console.error(`  Domain: ${config.domain}.freshdesk.com`);
  console.error(`  Enabled domains: ${domains.join(", ")}`);
  console.error(`  Write operations: ${config.enableWrites ? "ENABLED" : "disabled (use --enable-writes)"}`);

  // --- Start stdio transport ---
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
