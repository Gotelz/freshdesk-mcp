import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FreshdeskClient } from "../api-client.js";
import { handleApiError, truncateResponse } from "../api-client.js";
import type { FreshdeskTicket } from "../types.js";
import { TICKET_STATUS, TICKET_PRIORITY, TICKET_SOURCE } from "../types.js";
import type { ServerConfig } from "../config.js";

function formatTicket(t: FreshdeskTicket): string {
  const lines = [
    `## Ticket #${t.id}: ${t.subject}`,
    `- **Status**: ${TICKET_STATUS[t.status] ?? t.status}`,
    `- **Priority**: ${TICKET_PRIORITY[t.priority] ?? t.priority}`,
    `- **Source**: ${TICKET_SOURCE[t.source] ?? t.source}`,
    `- **Requester ID**: ${t.requester_id}`,
  ];
  if (t.responder_id) lines.push(`- **Assigned Agent ID**: ${t.responder_id}`);
  if (t.group_id) lines.push(`- **Group ID**: ${t.group_id}`);
  if (t.company_id) lines.push(`- **Company ID**: ${t.company_id}`);
  if (t.type) lines.push(`- **Type**: ${t.type}`);
  if (t.tags.length) lines.push(`- **Tags**: ${t.tags.join(", ")}`);
  if (t.due_by) lines.push(`- **Due By**: ${t.due_by}`);
  lines.push(`- **Created**: ${t.created_at}`);
  lines.push(`- **Updated**: ${t.updated_at}`);
  if (t.is_escalated) lines.push(`- **Escalated**: Yes`);
  return lines.join("\n");
}

export function registerTicketReadTools(
  server: McpServer,
  client: FreshdeskClient
): void {
  server.registerTool(
    "freshdesk_list_tickets",
    {
      title: "List Freshdesk Tickets",
      description: `List tickets from Freshdesk with optional filters and pagination.

Args:
  - page: Page number starting from 1 (default: 1)
  - per_page: Results per page, 1-100 (default: 30)
  - filter: Predefined filter (new_and_my_open, watching, spam, deleted)
  - requester_id: Filter by requester user ID
  - email: Filter by requester email
  - company_id: Filter by company ID
  - updated_since: Only tickets updated after this ISO 8601 date
  - order_by: Sort by created_at, due_by, updated_at, or status
  - order_type: asc or desc
  - include: Embed extra data (stats, requester, description)`,
      inputSchema: {
        page: z.number().int().min(1).default(1).describe("Page number (starts at 1)"),
        per_page: z.number().int().min(1).max(100).default(30).describe("Results per page"),
        filter: z.enum(["new_and_my_open", "watching", "spam", "deleted"]).optional().describe("Predefined filter"),
        requester_id: z.number().int().optional().describe("Filter by requester user ID"),
        email: z.string().email().optional().describe("Filter by requester email"),
        company_id: z.number().int().optional().describe("Filter by company ID"),
        updated_since: z.string().optional().describe("ISO 8601 date — only tickets updated after this"),
        order_by: z.enum(["created_at", "due_by", "updated_at", "status"]).optional().describe("Sort field"),
        order_type: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
        include: z.string().optional().describe("Comma-separated: stats, requester, description"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { page, per_page, ...filters } = params;
        const extraParams: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(filters)) {
          if (v !== undefined) extraParams[k] = v;
        }

        const result = await client.getWithPagination<FreshdeskTicket>(
          "/tickets",
          page,
          per_page,
          extraParams
        );

        if (!result.items.length) {
          return { content: [{ type: "text" as const, text: "No tickets found matching the criteria." }] };
        }

        const lines = [
          `# Freshdesk Tickets (Page ${result.page}, ${result.items.length} results)`,
          "",
          ...result.items.map(formatTicket),
        ];
        if (result.has_more) {
          lines.push("", `---`, `*More results available. Use page=${result.page + 1} to see next page.*`);
        }

        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_get_ticket",
    {
      title: "Get Freshdesk Ticket",
      description: `Get a single ticket by ID with optional embedded data.

Args:
  - ticket_id: The ticket ID
  - include: Comma-separated embed options: conversations, requester, company, stats
    Note: 'conversations' embeds up to 10 conversations (costs 2 API credits)`,
      inputSchema: {
        ticket_id: z.number().int().describe("Ticket ID"),
        include: z.string().optional().describe("Comma-separated: conversations, requester, company, stats"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const queryParams: Record<string, unknown> = {};
        if (params.include) queryParams.include = params.include;

        const ticket = await client.get<FreshdeskTicket>(
          `/tickets/${params.ticket_id}`,
          queryParams
        );

        const lines = [formatTicket(ticket)];

        if (ticket.description_text) {
          lines.push("", "### Description", ticket.description_text);
        }

        if (ticket.stats) {
          lines.push("", "### Stats");
          for (const [k, v] of Object.entries(ticket.stats)) {
            if (v) lines.push(`- **${k}**: ${v}`);
          }
        }

        if (ticket.requester) {
          lines.push("", `### Requester: ${ticket.requester.name} (${ticket.requester.email ?? "no email"})`);
        }

        if (ticket.conversations?.length) {
          lines.push("", "### Recent Conversations");
          for (const c of ticket.conversations) {
            const dir = c.incoming ? "Inbound" : "Outbound";
            const vis = c.private ? "Private" : "Public";
            lines.push(
              "",
              `#### ${dir} ${vis} — ${c.created_at} (User ${c.user_id})`,
              c.body_text || "(no text content)"
            );
          }
        }

        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_search_tickets",
    {
      title: "Search Freshdesk Tickets",
      description: `Search tickets using Freshdesk query syntax. Max 10 pages, 30 results/page.

Query syntax: "(field:value AND field:'text') OR field:>date"
Supported fields: agent_id, group_id, priority (1-4), status (2-5), tag, type,
  due_by, fr_due_by, created_at, updated_at, plus custom fields.
Operators: : (equals), :> (gte), :< (lte) for dates/numbers.

Examples:
  - "status:2 AND priority:4" — Open + Urgent tickets
  - "tag:'billing' AND created_at:>'2024-01-01'" — Billing tickets since Jan 2024
  - "agent_id:123 AND status:2" — Open tickets assigned to agent 123`,
      inputSchema: {
        query: z.string().min(1).max(512).describe("Freshdesk search query string"),
        page: z.number().int().min(1).max(10).default(1).describe("Page number (max 10)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const result = await client.search<FreshdeskTicket>("tickets", params.query, params.page);

        if (!result.results.length) {
          return { content: [{ type: "text" as const, text: `No tickets found for query: ${params.query}` }] };
        }

        const lines = [
          `# Search Results (${result.total} total, showing ${result.results.length})`,
          "",
          ...result.results.map(formatTicket),
        ];

        if (result.total > params.page * 30) {
          lines.push("", `---`, `*More results available. Use page=${params.page + 1}.*`);
        }

        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}

export function registerTicketWriteTools(
  server: McpServer,
  client: FreshdeskClient
): void {
  server.registerTool(
    "freshdesk_create_ticket",
    {
      title: "Create Freshdesk Ticket",
      description: `Create a new ticket. Requires --enable-writes flag.

At least one requester identifier is required: email, phone, or requester_id.`,
      inputSchema: {
        subject: z.string().min(1).describe("Ticket subject"),
        description: z.string().min(1).describe("HTML content of the ticket"),
        email: z.string().email().optional().describe("Requester email"),
        phone: z.string().optional().describe("Requester phone"),
        requester_id: z.number().int().optional().describe("Requester user ID"),
        status: z.number().int().min(2).max(5).default(2).describe("Status: 2=Open, 3=Pending, 4=Resolved, 5=Closed"),
        priority: z.number().int().min(1).max(4).default(1).describe("Priority: 1=Low, 2=Medium, 3=High, 4=Urgent"),
        type: z.string().optional().describe("Ticket type"),
        responder_id: z.number().int().optional().describe("Assigned agent ID"),
        group_id: z.number().int().optional().describe("Assigned group ID"),
        company_id: z.number().int().optional().describe("Associated company ID"),
        tags: z.array(z.string()).optional().describe("Tags"),
        cc_emails: z.array(z.string().email()).optional().describe("CC email addresses"),
        due_by: z.string().optional().describe("Resolution due date (ISO 8601)"),
        fr_due_by: z.string().optional().describe("First response due date (ISO 8601)"),
        custom_fields: z.record(z.unknown()).optional().describe("Custom field key-value pairs"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined) body[k] = v;
        }

        const ticket = await client.post<FreshdeskTicket>("/tickets", body);
        return {
          content: [{ type: "text" as const, text: `Ticket #${ticket.id} created successfully.\n\n${formatTicket(ticket)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_update_ticket",
    {
      title: "Update Freshdesk Ticket",
      description: `Update an existing ticket. Requires --enable-writes flag. Only provide fields you want to change.`,
      inputSchema: {
        ticket_id: z.number().int().describe("Ticket ID to update"),
        subject: z.string().optional().describe("New subject"),
        description: z.string().optional().describe("New HTML description"),
        status: z.number().int().min(2).max(5).optional().describe("Status: 2=Open, 3=Pending, 4=Resolved, 5=Closed"),
        priority: z.number().int().min(1).max(4).optional().describe("Priority: 1=Low, 2=Medium, 3=High, 4=Urgent"),
        type: z.string().optional().describe("Ticket type"),
        responder_id: z.number().int().optional().describe("Assigned agent ID"),
        group_id: z.number().int().optional().describe("Assigned group ID"),
        tags: z.array(z.string()).optional().describe("Tags (replaces existing)"),
        custom_fields: z.record(z.unknown()).optional().describe("Custom field key-value pairs"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { ticket_id, ...fields } = params;
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (v !== undefined) body[k] = v;
        }

        const ticket = await client.put<FreshdeskTicket>(`/tickets/${ticket_id}`, body);
        return {
          content: [{ type: "text" as const, text: `Ticket #${ticket.id} updated.\n\n${formatTicket(ticket)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_delete_ticket",
    {
      title: "Delete Freshdesk Ticket",
      description: `Move a ticket to trash. Requires --enable-writes flag. Can be restored later.`,
      inputSchema: {
        ticket_id: z.number().int().describe("Ticket ID to delete"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        await client.delete(`/tickets/${params.ticket_id}`);
        return { content: [{ type: "text" as const, text: `Ticket #${params.ticket_id} moved to trash.` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}
