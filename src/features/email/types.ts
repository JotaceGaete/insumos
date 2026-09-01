// Provider-agnostic email contract. Nothing outside this module (checkout
// route, templates, tests) should ever import a specific provider directly —
// they depend on this interface only, so swapping mock → ZeptoMail → anything
// else later is a one-file change in provider.ts, never a call-site change.

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailMessage {
  from: EmailAddress;
  to: EmailAddress;
  subject: string;
  html: string;
  text?: string;
  /** Non-secret tags for logs/audit only (e.g. eventType, orderId) — never
   * put credentials or PII beyond what's already in to/subject here. */
  metadata?: Record<string, string>;
}

export interface EmailSendResult {
  providerMessageId: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
