/** Freshdesk Ticket */
export interface FreshdeskTicket {
  id: number;
  subject: string;
  description: string;
  description_text: string;
  status: number;
  priority: number;
  source: number;
  type: string | null;
  requester_id: number;
  responder_id: number | null;
  group_id: number | null;
  company_id: number | null;
  product_id: number | null;
  tags: string[];
  cc_emails: string[];
  fwd_emails: string[];
  reply_cc_emails: string[];
  to_emails: string[];
  spam: boolean;
  is_escalated: boolean;
  fr_escalated: boolean;
  due_by: string | null;
  fr_due_by: string | null;
  created_at: string;
  updated_at: string;
  custom_fields: Record<string, unknown>;
  association_type: number | null;
  associated_tickets_list: number[] | null;
  stats?: FreshdeskTicketStats;
  requester?: FreshdeskContact;
  company?: FreshdeskCompany;
  conversations?: FreshdeskConversation[];
}

export interface FreshdeskTicketStats {
  agent_responded_at: string | null;
  requester_responded_at: string | null;
  first_responded_at: string | null;
  status_updated_at: string | null;
  reopened_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
}

/** Freshdesk Conversation (reply/note) */
export interface FreshdeskConversation {
  id: number;
  body: string;
  body_text: string;
  incoming: boolean;
  private: boolean;
  user_id: number;
  source: number;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  attachments: FreshdeskAttachment[];
  created_at: string;
  updated_at: string;
}

export interface FreshdeskAttachment {
  id: number;
  name: string;
  content_type: string;
  size: number;
  attachment_url: string;
  created_at: string;
}

/** Freshdesk Contact */
export interface FreshdeskContact {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  twitter_id: string | null;
  facebook_id: string | null;
  unique_external_id: string | null;
  company_id: number | null;
  description: string | null;
  tags: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
  custom_fields: Record<string, unknown>;
}

/** Freshdesk Company */
export interface FreshdeskCompany {
  id: number;
  name: string;
  description: string | null;
  domains: string[];
  note: string | null;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Freshdesk Agent */
export interface FreshdeskAgent {
  id: number;
  contact: {
    name: string;
    email: string;
    phone: string | null;
    mobile: string | null;
    active: boolean;
  };
  type: string;
  signature: string | null;
  group_ids: number[];
  created_at: string;
  updated_at: string;
}

/** Freshdesk Group */
export interface FreshdeskGroup {
  id: number;
  name: string;
  description: string | null;
  agent_ids: number[];
  created_at: string;
  updated_at: string;
}

/** Enum maps for human-readable labels */
export const TICKET_STATUS: Record<number, string> = {
  2: "Open",
  3: "Pending",
  4: "Resolved",
  5: "Closed",
};

export const TICKET_PRIORITY: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

export const TICKET_SOURCE: Record<number, string> = {
  1: "Email",
  2: "Portal",
  3: "Phone",
  7: "Chat",
  9: "Feedback",
  10: "Outbound",
};
