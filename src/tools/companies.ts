import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FreshdeskClient } from "../api-client.js";
import { handleApiError, truncateResponse } from "../api-client.js";
import type { FreshdeskCompany } from "../types.js";

function formatCompany(c: FreshdeskCompany): string {
  const lines = [
    `## ${c.name} (ID: ${c.id})`,
  ];
  if (c.description) lines.push(`- **Description**: ${c.description}`);
  if (c.domains?.length) lines.push(`- **Domains**: ${c.domains.join(", ")}`);
  if (c.note) lines.push(`- **Note**: ${c.note}`);
  lines.push(`- **Created**: ${c.created_at}`);
  lines.push(`- **Updated**: ${c.updated_at}`);
  return lines.join("\n");
}

export function registerCompanyReadTools(
  server: McpServer,
  client: FreshdeskClient
): void {
  server.registerTool(
    "freshdesk_list_companies",
    {
      title: "List Freshdesk Companies",
      description: `List companies with pagination.`,
      inputSchema: {
        page: z.number().int().min(1).default(1).describe("Page number"),
        per_page: z.number().int().min(1).max(100).default(30).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const result = await client.getWithPagination<FreshdeskCompany>(
          "/companies",
          params.page,
          params.per_page
        );

        if (!result.items.length) {
          return { content: [{ type: "text" as const, text: "No companies found." }] };
        }

        const lines = [
          `# Companies (Page ${result.page}, ${result.items.length} results)`,
          "",
          ...result.items.map(formatCompany),
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
    "freshdesk_get_company",
    {
      title: "Get Freshdesk Company",
      description: `Get a single company by ID.`,
      inputSchema: {
        company_id: z.number().int().describe("Company ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const company = await client.get<FreshdeskCompany>(`/companies/${params.company_id}`);
        return { content: [{ type: "text" as const, text: formatCompany(company) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_search_companies",
    {
      title: "Search Freshdesk Companies",
      description: `Search companies using Freshdesk query syntax. Max 10 pages.

Examples:
  - "name:'Acme'" — Find companies named Acme
  - "domain:'example.com'" — Find by domain`,
      inputSchema: {
        query: z.string().min(1).max(512).describe("Search query"),
        page: z.number().int().min(1).max(10).default(1).describe("Page number"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const result = await client.search<FreshdeskCompany>("companies", params.query, params.page);

        if (!result.results.length) {
          return { content: [{ type: "text" as const, text: `No companies found for query: ${params.query}` }] };
        }

        const lines = [
          `# Company Search (${result.total} total)`,
          "",
          ...result.results.map(formatCompany),
        ];

        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}

export function registerCompanyWriteTools(
  server: McpServer,
  client: FreshdeskClient
): void {
  server.registerTool(
    "freshdesk_create_company",
    {
      title: "Create Freshdesk Company",
      description: `Create a new company. Requires --enable-writes and --enable-companies flags.`,
      inputSchema: {
        name: z.string().min(1).describe("Company name"),
        description: z.string().optional().describe("Description"),
        domains: z.array(z.string()).optional().describe("Company domains"),
        note: z.string().optional().describe("Additional notes"),
        custom_fields: z.record(z.unknown()).optional().describe("Custom fields"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined) body[k] = v;
        }
        const company = await client.post<FreshdeskCompany>("/companies", body);
        return { content: [{ type: "text" as const, text: `Company created.\n\n${formatCompany(company)}` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_update_company",
    {
      title: "Update Freshdesk Company",
      description: `Update an existing company. Requires --enable-writes and --enable-companies flags.`,
      inputSchema: {
        company_id: z.number().int().describe("Company ID to update"),
        name: z.string().optional().describe("Company name"),
        description: z.string().optional().describe("Description"),
        domains: z.array(z.string()).optional().describe("Domains (replaces existing)"),
        note: z.string().optional().describe("Notes"),
        custom_fields: z.record(z.unknown()).optional().describe("Custom fields"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const { company_id, ...fields } = params;
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (v !== undefined) body[k] = v;
        }
        const company = await client.put<FreshdeskCompany>(`/companies/${company_id}`, body);
        return { content: [{ type: "text" as const, text: `Company updated.\n\n${formatCompany(company)}` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}
