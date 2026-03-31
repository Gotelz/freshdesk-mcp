import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FreshdeskClient } from "../api-client.js";
import { handleApiError, truncateResponse } from "../api-client.js";
import type { FreshdeskAgent, FreshdeskGroup } from "../types.js";

function formatAgent(a: FreshdeskAgent): string {
  const lines = [
    `## ${a.contact.name} (ID: ${a.id})`,
    `- **Email**: ${a.contact.email}`,
    `- **Active**: ${a.contact.active}`,
    `- **Type**: ${a.type}`,
  ];
  if (a.contact.phone) lines.push(`- **Phone**: ${a.contact.phone}`);
  if (a.group_ids?.length) lines.push(`- **Group IDs**: ${a.group_ids.join(", ")}`);
  lines.push(`- **Created**: ${a.created_at}`);
  return lines.join("\n");
}

function formatGroup(g: FreshdeskGroup): string {
  const lines = [
    `## ${g.name} (ID: ${g.id})`,
  ];
  if (g.description) lines.push(`- **Description**: ${g.description}`);
  if (g.agent_ids?.length) lines.push(`- **Agent IDs**: ${g.agent_ids.join(", ")}`);
  lines.push(`- **Created**: ${g.created_at}`);
  return lines.join("\n");
}

export function registerAgentGroupReadTools(
  server: McpServer,
  client: FreshdeskClient
): void {
  server.registerTool(
    "freshdesk_list_agents",
    {
      title: "List Freshdesk Agents",
      description: `List all agents. Useful for understanding ticket assignments.`,
      inputSchema: {
        page: z.number().int().min(1).default(1).describe("Page number"),
        per_page: z.number().int().min(1).max(100).default(30).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const result = await client.getWithPagination<FreshdeskAgent>(
          "/agents",
          params.page,
          params.per_page
        );

        if (!result.items.length) {
          return { content: [{ type: "text" as const, text: "No agents found." }] };
        }

        const lines = [
          `# Agents (Page ${result.page}, ${result.items.length} results)`,
          "",
          ...result.items.map(formatAgent),
        ];
        if (result.has_more) {
          lines.push("", `---`, `*More results available. Use page=${result.page + 1}.*`);
        }

        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_get_agent",
    {
      title: "Get Freshdesk Agent",
      description: `Get a single agent by ID.`,
      inputSchema: {
        agent_id: z.number().int().describe("Agent ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const agent = await client.get<FreshdeskAgent>(`/agents/${params.agent_id}`);
        return { content: [{ type: "text" as const, text: formatAgent(agent) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_get_current_agent",
    {
      title: "Get Current Freshdesk Agent",
      description: `Get the agent associated with the current API key. Useful for identifying who you are authenticated as.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const agent = await client.get<FreshdeskAgent>("/agents/me");
        return { content: [{ type: "text" as const, text: `# Current Agent\n\n${formatAgent(agent)}` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_list_groups",
    {
      title: "List Freshdesk Groups",
      description: `List all groups. Useful for understanding ticket routing and assignments.`,
      inputSchema: {
        page: z.number().int().min(1).default(1).describe("Page number"),
        per_page: z.number().int().min(1).max(100).default(30).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const result = await client.getWithPagination<FreshdeskGroup>(
          "/groups",
          params.page,
          params.per_page
        );

        if (!result.items.length) {
          return { content: [{ type: "text" as const, text: "No groups found." }] };
        }

        const lines = [
          `# Groups (Page ${result.page}, ${result.items.length} results)`,
          "",
          ...result.items.map(formatGroup),
        ];
        if (result.has_more) {
          lines.push("", `---`, `*More results available. Use page=${result.page + 1}.*`);
        }

        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_get_group",
    {
      title: "Get Freshdesk Group",
      description: `Get a single group by ID.`,
      inputSchema: {
        group_id: z.number().int().describe("Group ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const group = await client.get<FreshdeskGroup>(`/groups/${params.group_id}`);
        return { content: [{ type: "text" as const, text: formatGroup(group) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}
