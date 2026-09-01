import 'server-only';
import type { EmailProvider } from '../types';

// Adapter contract for ZeptoMail — intentionally not connected yet. No
// domain, no verified sender and no API credentials exist for this project,
// so there is nothing real to call. This stub exists so provider.ts already
// has a stable place to route to; the real HTTP request goes inside this
// send() body later, and nothing outside this file (checkout, templates,
// sendTransactionalEmail) will need to change when that happens.
export const zeptoMailProvider: EmailProvider = {
  async send() {
    throw new Error('ZeptoMail provider is not configured');
  },
};
