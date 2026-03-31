import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FreshdeskClient } from "../api-client.js";
import { handleApiError, truncateResponse } from "../api-client.js";
import type { FreshdeskContact } from "../types.js";

function formatContact(c: FreshdeskContact): string {
  const lines = [
    `## ${c.name} (ID: ${c.id})`,
    `- **Email**: ${c.email ?? "N/A"}`,
    `- **Phone**: ${c.phone ?? "N/A"}`,
    `- **Active**: ${c.active}`,
  ];
  if (c.mobile) lines.push(`- **Mobile**: ${c.mobile}`);
  if (c.company_id) lines.push(`- **Company ID**: ${c.company_id}`);
  if (c.description) lines.push(`- **Description**: ${c.description}`);
  if (c.tags?.length) lines.push(`- **Tags**: ${c.tags.join(", ")}`);
  lines.push(`- **Created**: ${c.created_at}`);
  return lines.join("\n");
}

export function registerContactReadTools(
  server: McpServer,
  client: FreshdeskClient
): void {
  server.registerTool(
    "freshdesk_list_contacts",
    {
      title: "List Freshdesk Contacts",
      description: `List contacts with optional state filter and pagination.

Args:
  - page: Page number (default: 1)
  - per_page: Results per page (default: 30)
  - state: Filter by state (active, deleted, blocked, unverified)`,
      inputSchema: {
        page: z.number().int().min(1).default(1).describe("Page number"),
        per_page: z.number().int().min(1).max(100).default(30).describe("Results per page"),
        state: z.enum(["active", "deleted", "blocked", "unverified"]).optional().describe("Filter by state"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const extraParams: Record<string, unknown> = {};
        if (params.state) extraParams.state = params.state;

        const result = await client.getWithPagination<FreshdeskContact>(
          "/contacts",
          params.page,
          params.per_page,
          extraParams
        );

        if (!result.items.length) {
          return { content: [{ type: "text" as const, text: "No contacts found." }] };
        }

        const lines = [
          `# Contacts (Page ${result.page}, ${result.items.length} results)`,
          "",
          ...result.items.map(formatContact),
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
    "freshdesk_get_contact",
    {
      title: "Get Freshdesk Contact",
      description: `Get a single contact by ID.`,
      inputSchema: {
        contact_id: z.number().int().describe("Contact ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const contact = await client.get<FreshdeskContact>(`/contacts/${params.contact_id}`);
        return { content: [{ type: "text" as const, text: formatContact(contact) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_search_contacts",
    {
      title: "Search Freshdesk Contacts",
      description: `Search contacts using Freshdesk query syntax. Max 10 pages, 30 results/page.

Query syntax: "(field:value AND field:'text')"
Supported fields: name, email, phone, created_at, updated_at, custom fields.

Examples:
  - "email:'user@example.com'" — Find by exact email
  - "name:'John'" — Find contacts named John`,
      inputSchema: {
        query: z.string().min(1).max(512).describe("Search query"),
        page: z.number().int().min(1).max(10).default(1).describe("Page number"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const result = await client.search<FreshdeskContact>("contacts", params.query, params.page);

        if (!result.results.length) {
          return { content: [{ type: "text" as const, text: `No contacts found for query: ${params.query}` }] };
        }

        const lines = [
          `# Contact Search (${result.total} total)`,
          "",
          ...result.results.map(formatContact),
        ];

        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}

export function registerContactWriteTools(
  server: McpServer,
  client: FreshdeskClient
): void {
  server.registerTool(
    "freshdesk_create_contact",
    {
      title: "Create Freshdesk Contact",
      description: `Create a new contact. Requires --enable-writes and --enable-contacts flags.`,
      inputSchema: {
        name: z.string().min(1).describe("Contact name"),
        email: z.string().email().optional().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
        mobile: z.string().optional().describe("Mobile number"),
        company_id: z.number().int().optional().describe("Primary company ID"),
        description: z.string().optional().describe("Contact description"),
        tags: z.array(z.string()).optional().describe("Tags"),
        custom_fields: z.record(z.unknown()).optional().describe("Custom field key-value pairs"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined) body[k] = v;
        }
        const contact = await client.post<FreshdeskContact>("/contacts", body);
        return { content: [{ type: "text" as const, text: `Contact created.\n\n${formatContact(contact)}` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_update_contact",
    {
      title: "Update Freshdesk Contact",
      description: `Update an existing contact. Requires --enable-writes and --enable-contacts flags.`,
      inputSchema: {
        contact_id: z.number().int().describe("Contact ID to update"),
        name: z.string().optional().describe("Contact name"),
        email: z.string().email().optional().describe("Email"),
        phone: z.string().optional().describe("Phone"),
        mobile: z.string().optional().describe("Mobile"),
        company_id: z.number().int().optional().describe("Primary company ID"),
        description: z.string().optional().describe("Description"),
        tags: z.array(z.string()).optional().describe("Tags (replaces existing)"),
        custom_fields: z.record(z.unknown()).optional().describe("Custom fields"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const { contact_id, ...fields } = params;
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (v !== undefined) body[k] = v;
        }
        const contact = await client.put<FreshdeskContact>(`/contacts/${contact_id}`, body);
        return { content: [{ type: "text" as const, text: `Contact updated.\n\n${formatContact(contact)}` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}
