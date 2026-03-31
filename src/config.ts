export interface ServerConfig {
  /** Freshdesk subdomain (e.g. "mycompany" for mycompany.freshdesk.com) */
  domain: string;
  /** Freshdesk API key */
  apiKey: string;
  /** Base URL constructed from domain */
  baseUrl: string;
  /** Whether write operations are enabled */
  enableWrites: boolean;
  /** Enabled feature domains beyond basic ticketing */
  enabledDomains: Set<FeatureDomain>;
}

export type FeatureDomain = "contacts" | "companies";

export function parseArgs(argv: string[]): ServerConfig {
  const args = argv.slice(2);

  let enableWrites = false;
  const enabledDomains = new Set<FeatureDomain>();

  for (const arg of args) {
    switch (arg) {
      case "--enable-writes":
        enableWrites = true;
        break;
      case "--enable-contacts":
        enabledDomains.add("contacts");
        break;
      case "--enable-companies":
        enabledDomains.add("companies");
        break;
      case "--enable-all-domains":
        enabledDomains.add("contacts");
        enabledDomains.add("companies");
        break;
      case "--help":
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown argument: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  const apiKey = process.env.FRESHDESK_API_KEY;
  const domain = process.env.FRESHDESK_DOMAIN;

  if (!apiKey) {
    console.error("ERROR: FRESHDESK_API_KEY environment variable is required");
    process.exit(1);
  }

  if (!domain) {
    console.error("ERROR: FRESHDESK_DOMAIN environment variable is required (e.g. 'mycompany' for mycompany.freshdesk.com)");
    process.exit(1);
  }

  return {
    domain,
    apiKey,
    baseUrl: `https://${domain}.freshdesk.com/api/v2`,
    enableWrites,
    enabledDomains,
  };
}

function printHelp(): void {
  console.error(`
freshdesk-mcp-server - MCP server for Freshdesk API

Environment variables:
  FRESHDESK_API_KEY    Freshdesk API key (required)
  FRESHDESK_DOMAIN     Freshdesk subdomain (required)

Flags:
  --enable-writes      Enable write operations (create, update, reply, delete)
  --enable-contacts    Enable contact management tools
  --enable-companies   Enable company management tools
  --enable-all-domains Enable all optional domains (contacts, companies)
  --help               Show this help message

By default, only read-only ticket operations are available.
Write operations require --enable-writes to prevent accidental changes.
  `);
}
