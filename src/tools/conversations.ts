import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FreshdeskClient } from "../api-client.js";
import { handleApiError, truncateResponse } from "../api-client.js";
import type { FreshdeskConversation } from "../types.js";

function formatConversation(c: FreshdeskConversation): string {
  const dir = c.incoming ? "Inbound" : "Outbound";
  const vis = c.private ? "Private" : "Public";
  const lines = [
    `### ${dir} ${vis} — ID: ${c.id}`,
    `- **User ID**: ${c.user_id}`,
    `- **Created**: ${c.created_at}`,
  ];
  if (c.to_emails?.length) lines.push(`- **To**: ${c.to_emails.join(", ")}`);
  if (c.cc_emails?.length) lines.push(`- **CC**: ${c.cc_emails.join(", ")}`);
  if (c.attachments?.length) {
    lines.push(`- **Attachments**: ${c.attachments.map((a) => `${a.name} (${a.size} bytes)`).join(", ")}`);
  }
  lines.push("", c.body_text || "(no text content)");
  return lines.join("\n");
}

export function registerConversationReadTools(
  server: McpServer,
  client: FreshdeskClient
): void {
  server.registerTool(
    "freshdesk_list_conversations",
    {
      title: "List Ticket Conversations",
      description: `List all conversations (replies and notes) for a ticket.

Args:
  - ticket_id: The ticket ID
  - page: Page number (default: 1)
  - per_page: Results per page, 1-100 (default: 30)`,
      inputSchema: {
        ticket_id: z.number().int().describe("Ticket ID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        per_page: z.number().int().min(1).max(100).default(30).describe("Results per page"),
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
        const result = await client.getWithPagination<FreshdeskConversation>(
          `/tickets/${params.ticket_id}/conversations`,
          params.page,
          params.per_page
        );

        if (!result.items.length) {
          return { content: [{ type: "text" as const, text: `No conversations found for ticket #${params.ticket_id}.` }] };
        }

        const lines = [
          `# Conversations for Ticket #${params.ticket_id} (Page ${result.page})`,
          "",
          ...result.items.map(formatConversation),
        ];
        if (result.has_more) {
          lines.push("", `---`, `*More conversations available. Use page=${result.page + 1}.*`);
        }

        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}

export function registerConversationWriteTools(
  server: McpServer,
  client: FreshdeskClient
): void {
  server.registerTool(
    "freshdesk_reply_to_ticket",
    {
      title: "Reply to Freshdesk Ticket",
      description: `Send a public reply to a ticket. The reply is sent as an email to the requester.
Requires --enable-writes flag.

WARNING: This sends an actual email to the customer.`,
      inputSchema: {
        ticket_id: z.number().int().describe("Ticket ID"),
        body: z.string().min(1).describe("HTML reply content"),
        cc_emails: z.array(z.string().email()).optional().describe("CC recipients"),
        bcc_emails: z.array(z.string().email()).optional().describe("BCC recipients"),
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
        const { ticket_id, ...body } = params;
        const data: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(body)) {
          if (v !== undefined) data[k] = v;
        }

        const conv = await client.post<FreshdeskConversation>(
          `/tickets/${ticket_id}/reply`,
          data
        );
        return {
          content: [{ type: "text" as const, text: `Reply sent on ticket #${ticket_id}.\n\n${formatConversation(conv)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "freshdesk_add_note",
    {
      title: "Add Note to Freshdesk Ticket",
      description: `Add a note (internal or public) to a ticket. Requires --enable-writes flag.

Private notes are only visible to agents. Public notes are visible to the requester.`,
      inputSchema: {
        ticket_id: z.number().int().describe("Ticket ID"),
        body: z.string().min(1).describe("HTML note content"),
        private: z.boolean().default(true).describe("true = internal/agent-only note (default), false = public"),
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
        const conv = await client.post<FreshdeskConversation>(
          `/tickets/${params.ticket_id}/notes`,
          { body: params.body, private: params.private }
        );
        const vis = conv.private ? "private" : "public";
        return {
          content: [{ type: "text" as const, text: `${vis} note added to ticket #${params.ticket_id}.\n\n${formatConversation(conv)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}
