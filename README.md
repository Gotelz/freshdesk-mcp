# freshdesk-mcp-server

MCP (Model Context Protocol) server for the Freshdesk API. Designed for use with Claude Code, Claude Desktop, and other MCP clients.

**Safety first**: Write operations (replying to tickets, updating data) are disabled by default and must be explicitly enabled via `--enable-writes`.

## Installation

```bash
# From GitHub (via npx)
npx github:YOUR_USERNAME/freshdesk-mcp

# Or clone and build
git clone https://github.com/YOUR_USERNAME/freshdesk-mcp.git
cd freshdesk-mcp
npm install && npm run build
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FRESHDESK_API_KEY` | Yes | Your Freshdesk API key (found in Profile Settings) |
| `FRESHDESK_DOMAIN` | Yes | Your Freshdesk subdomain (e.g. `mycompany` for mycompany.freshdesk.com) |

### CLI Flags

| Flag | Description |
|------|-------------|
| `--enable-writes` | Enable write operations (create, update, reply, delete) |
| `--enable-contacts` | Enable contact management tools |
| `--enable-companies` | Enable company management tools |
| `--enable-all-domains` | Enable all optional domains |
| `--help` | Show help |

## Usage with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "freshdesk": {
      "command": "npx",
      "args": ["github:YOUR_USERNAME/freshdesk-mcp"],
      "env": {
        "FRESHDESK_API_KEY": "your-api-key",
        "FRESHDESK_DOMAIN": "yourcompany"
      }
    }
  }
}
```

## Usage with Claude Code

```bash
claude mcp add freshdesk -- npx github:YOUR_USERNAME/freshdesk-mcp
```

Set environment variables in your shell profile or `.env`.

## Available Tools

### Always Available (Read-Only)

| Tool | Description |
|------|-------------|
| `freshdesk_list_tickets` | List tickets with filters and pagination |
| `freshdesk_get_ticket` | Get ticket by ID with optional includes (conversations, requester, stats) |
| `freshdesk_search_tickets` | Search tickets with Freshdesk query syntax |
| `freshdesk_list_conversations` | List all conversations for a ticket |
| `freshdesk_list_agents` | List all agents |
| `freshdesk_get_agent` | Get agent by ID |
| `freshdesk_get_current_agent` | Get the agent for the current API key |
| `freshdesk_list_groups` | List all groups |
| `freshdesk_get_group` | Get group by ID |

### Requires `--enable-writes`

| Tool | Description |
|------|-------------|
| `freshdesk_create_ticket` | Create a new ticket |
| `freshdesk_update_ticket` | Update an existing ticket |
| `freshdesk_delete_ticket` | Move a ticket to trash |
| `freshdesk_reply_to_ticket` | Send a reply (emails the customer) |
| `freshdesk_add_note` | Add a private or public note |

### Requires `--enable-contacts`

| Tool | Description |
|------|-------------|
| `freshdesk_list_contacts` | List contacts |
| `freshdesk_get_contact` | Get contact by ID |
| `freshdesk_search_contacts` | Search contacts |
| `freshdesk_create_contact` | Create contact (also needs `--enable-writes`) |
| `freshdesk_update_contact` | Update contact (also needs `--enable-writes`) |

### Requires `--enable-companies`

| Tool | Description |
|------|-------------|
| `freshdesk_list_companies` | List companies |
| `freshdesk_get_company` | Get company by ID |
| `freshdesk_search_companies` | Search companies |
| `freshdesk_create_company` | Create company (also needs `--enable-writes`) |
| `freshdesk_update_company` | Update company (also needs `--enable-writes`) |

## License

MIT
