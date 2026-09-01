import 'server-only';
import { randomUUID } from 'node:crypto';
import type { EmailProvider } from '../types';

// Development/default provider: sends nothing, just proves the pipeline
// works end to end. Logs enough to verify a real send would have happened
// (recipient, subject, event) without dumping the full HTML body into the
// server console.
export const mockEmailProvider: EmailProvider = {
  async send(message) {
    console.log('[email:mock] would send', {
      to: message.to.email,
      subject: message.subject,
      eventType: message.metadata?.eventType,
      orderId: message.metadata?.orderId,
    });
    return { providerMessageId: `mock_${randomUUID()}` };
  },
};
