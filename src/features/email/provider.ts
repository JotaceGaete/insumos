import 'server-only';
import type { EmailProvider } from './types';
import { mockEmailProvider } from './providers/mockEmailProvider';
import { zeptoMailProvider } from './providers/zeptoMailProvider';

export const EMAIL_PROVIDERS = ['mock', 'zeptomail'] as const;
export type EmailProviderName = (typeof EMAIL_PROVIDERS)[number];

export function getConfiguredProviderName(): string {
  return (process.env.INSUMOS_EMAIL_PROVIDER || 'mock').trim().toLowerCase();
}

/**
 * The only place in the app that knows which concrete provider exists.
 * Everything else (sendTransactionalEmail, checkout) calls this and gets
 * back an EmailProvider — never a provider-specific type or import.
 */
export function getEmailProvider(): EmailProvider {
  const name = getConfiguredProviderName();
  switch (name) {
    case 'mock':
      return mockEmailProvider;
    case 'zeptomail':
      return zeptoMailProvider;
    default:
      console.error(`[email] Unknown INSUMOS_EMAIL_PROVIDER "${name}" — falling back to mock.`);
      return mockEmailProvider;
  }
}

export function getEmailFrom(): { email: string; name: string } {
  return {
    email: process.env.INSUMOS_EMAIL_FROM || 'no-reply@arteinsumos.local',
    name: process.env.INSUMOS_EMAIL_FROM_NAME || 'ArteInsumos',
  };
}
